import { toDisposable, type Disposable } from '../disposable';
import { Emitter } from '../events/emitter';

export type SettingType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface SettingSchema {
  type: SettingType;
  default: unknown;
  description?: string;
  enum?: readonly unknown[];
}

export interface SettingsChange {
  /** Full keys ("editor.tabSize") whose value may have changed. */
  keys: string[];
}

type Values = Record<string, unknown>;

/** `settings.json` shape: flat keys plus `"[language]": { ... }` override blocks. */
export type RawSettings = Record<string, unknown>;

const LANGUAGE_BLOCK = /^\[(.+)\]$/;

function matchesType(value: unknown, schema: SettingSchema): boolean {
  if (schema.enum && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return typeof value === schema.type;
  }
}

/**
 * Layered settings: schema defaults < user settings < per-language overrides.
 * Each extension contributes the schema for its own namespace.
 */
export class SettingsRegistry {
  private schemas = new Map<string, SettingSchema>();
  private user: Values = {};
  private languages = new Map<string, Values>();
  private raw: RawSettings = {};
  readonly onDidChange = new Emitter<SettingsChange>();

  registerSchema(namespace: string, properties: Record<string, SettingSchema>): Disposable {
    const keys = Object.keys(properties).map((k) => `${namespace}.${k}`);
    for (const key of keys) {
      if (this.schemas.has(key)) throw new Error(`Setting already registered: ${key}`);
    }
    for (const [k, schema] of Object.entries(properties)) {
      this.schemas.set(`${namespace}.${k}`, schema);
    }
    this.onDidChange.fire({ keys });
    return toDisposable(() => {
      for (const key of keys) this.schemas.delete(key);
    });
  }

  schema(key: string): SettingSchema | undefined {
    return this.schemas.get(key);
  }

  allSchemas(): [string, SettingSchema][] {
    return [...this.schemas];
  }

  /** Effective value. Invalid user values fall back to the next layer. */
  get<T>(key: string, language?: string): T {
    const schema = this.schemas.get(key);
    if (!schema) throw new Error(`Unknown setting: ${key}`);
    const layers: (Values | undefined)[] = [
      language ? this.languages.get(language) : undefined,
      this.user,
    ];
    for (const layer of layers) {
      if (layer && key in layer && matchesType(layer[key], schema)) {
        return layer[key] as T;
      }
    }
    return schema.default as T;
  }

  /** Copy of the user layer as last set, in settings.json shape. */
  userSettings(): RawSettings {
    return structuredClone(this.raw);
  }

  /** Replaces the user layer (the parsed content of settings.json). */
  setUserSettings(raw: RawSettings): void {
    this.raw = structuredClone(raw);
    const before = this.snapshot();
    this.user = {};
    this.languages.clear();
    for (const [key, value] of Object.entries(raw)) {
      const lang = LANGUAGE_BLOCK.exec(key)?.[1];
      if (lang && typeof value === 'object' && value !== null) {
        this.languages.set(lang, { ...(value as Values) });
      } else {
        this.user[key] = value;
      }
    }
    const after = this.snapshot();
    const changed = new Set<string>();
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(id) !== after.get(id)) changed.add(id.slice(id.indexOf(' ') + 1));
    }
    if (changed.size > 0) this.onDidChange.fire({ keys: [...changed] });
  }

  /** Every user-set value keyed by "LANGUAGE KEY" (empty language for global), serialized. */
  private snapshot(): Map<string, string> {
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(this.user)) out.set(` ${k}`, JSON.stringify(v));
    for (const [lang, values] of this.languages) {
      for (const [k, v] of Object.entries(values)) out.set(`${lang} ${k}`, JSON.stringify(v));
    }
    return out;
  }
}
