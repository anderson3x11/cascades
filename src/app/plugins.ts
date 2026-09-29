import type { ExtensionContext, PluginInfo, PluginPermission } from '../api';
import type { ExtensionHost } from '../core/extensions/host';
import { Emitter } from '../core/events/emitter';
import { t } from '../core/i18n/i18n';
import type { SettingsRegistry } from '../core/settings/registry';
import * as fs from '../platform/fs';
import { loadUserScript } from './user-script';

/** What a plugin may ask for in its manifest. */
export const PLUGIN_PERMISSIONS: readonly PluginPermission[] = ['files'];

/** Setting that lists the ids of the plugins turned on. */
export const PLUGINS_SETTING = 'plugins.enabled';
const FOLDER = 'plugins';

/** The content of a plugin's manifest.json. */
export interface PluginManifest {
  /** Lower case words joined by dashes: "writing-time". */
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  permissions: PluginPermission[];
  /** The module to load, in the plugin folder. */
  main: string;
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FILE = /^[\w.-]+\.js$/;

const text = (value: unknown, field: string, required: boolean): string | undefined => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(t('"{name}" must be a text', { name: field }));
  }
  return value;
};

/** Reads manifest.json. Throws with a message for the user when it is not valid. */
export function parseManifest(source: string): PluginManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (err) {
    throw new Error(
      t('invalid JSON: {problem}', { problem: err instanceof Error ? err.message : String(err) }),
      { cause: err },
    );
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(t('the file must hold an object { … }'));
  }
  const m = raw as Record<string, unknown>;
  const id = text(m.id, 'id', true) ?? '';
  if (!ID.test(id)) {
    throw new Error(t('"id" must be lower case words joined by dashes: "word-count"'));
  }
  const permissions = m.permissions ?? [];
  if (
    !Array.isArray(permissions) ||
    !permissions.every((p) => (PLUGIN_PERMISSIONS as readonly unknown[]).includes(p))
  ) {
    throw new Error(
      t('"permissions" must be a list among: {values}', { values: PLUGIN_PERMISSIONS.join(', ') }),
    );
  }
  const main = text(m.main, 'main', false) ?? 'main.js';
  if (!FILE.test(main)) throw new Error(t('"main" must name a .js file of the plugin folder'));
  return {
    id,
    name: text(m.name, 'name', true) ?? id,
    version: text(m.version, 'version', true) ?? '',
    author: text(m.author, 'author', false),
    description: text(m.description, 'description', false),
    permissions: permissions as PluginPermission[],
    main,
  };
}

interface Plugin {
  info: PluginInfo;
  main: string;
}

/**
 * The plugins of the config folder: plugins/FOLDER/manifest.json and its
 * module. A plugin runs like a built-in extension, under the id
 * "plugin.ID", once its id is in the plugins.enabled setting.
 */
export class PluginService {
  readonly onDidChange = new Emitter<void>();
  private plugins: Plugin[] = [];

  constructor(
    private readonly host: ExtensionHost<ExtensionContext>,
    private readonly settings: SettingsRegistry,
    private readonly update: (key: string, value: unknown) => Promise<void>,
  ) {}

  static hostId(id: string): string {
    return `plugin.${id}`;
  }

  list(): PluginInfo[] {
    return this.plugins.map((p) => ({ ...p.info, permissions: [...p.info.permissions] }));
  }

  /** Permissions of the plugin running as `extensionId`, or null for other extensions. */
  permissionsOf(extensionId: string): readonly PluginPermission[] | null {
    const plugin = this.plugins.find((p) => PluginService.hostId(p.info.id) === extensionId);
    return plugin ? plugin.info.permissions : null;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const others = this.enabledIds().filter((other) => other !== id);
    const next = enabled ? [...others, id] : others;
    await this.update(PLUGINS_SETTING, next.length > 0 ? next : undefined);
  }

  /** Reads the plugin folders again, then turns each plugin on or off. */
  async reload(): Promise<void> {
    for (const plugin of this.plugins) this.stop(plugin);
    this.plugins = await this.scan();
    await this.sync();
  }

  /** Turns plugins on or off to match the setting. */
  async sync(): Promise<void> {
    const enabled = new Set(this.enabledIds());
    for (const plugin of this.plugins) {
      plugin.info.enabled = enabled.has(plugin.info.id);
      if (plugin.info.enabled && !plugin.info.active && plugin.main) await this.start(plugin);
      else if (!plugin.info.enabled && plugin.info.active) this.stop(plugin);
    }
    this.onDidChange.fire();
  }

  private enabledIds(): string[] {
    return this.settings.get<string[]>(PLUGINS_SETTING);
  }

  private async scan(): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    const folders = await fs.listConfigSubfolders(FOLDER).catch(() => []);
    for (const folder of folders) {
      const blank = { id: folder, name: folder, version: '', permissions: [], folder };
      const state = { enabled: false, active: false, error: null };
      try {
        const source = await fs.readConfigFile(`${FOLDER}/${folder}/manifest.json`);
        if (source === null) throw new Error(t('manifest.json is missing'));
        const { main, ...manifest } = parseManifest(source);
        if (plugins.some((p) => p.info.id === manifest.id)) {
          throw new Error(t('another plugin already has the id "{id}"', { id: manifest.id }));
        }
        plugins.push({ info: { ...manifest, folder, ...state }, main });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        plugins.push({ info: { ...blank, ...state, error }, main: '' });
      }
    }
    return plugins;
  }

  private async start(plugin: Plugin): Promise<void> {
    const { info } = plugin;
    try {
      const source = await fs.readConfigFile(`${FOLDER}/${info.folder}/${plugin.main}`);
      if (source === null) throw new Error(t('{file} is missing', { file: plugin.main }));
      const extension = await loadUserScript(source, PluginService.hostId(info.id), plugin.main);
      await this.host.activate(extension);
      info.active = true;
      info.error = null;
    } catch (err) {
      console.error(err);
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause : err;
      info.error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  private stop(plugin: Plugin): void {
    if (!plugin.info.active) return;
    this.host.deactivate(PluginService.hostId(plugin.info.id));
    plugin.info.active = false;
  }
}
