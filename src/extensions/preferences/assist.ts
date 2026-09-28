import { getLocation, type Location } from 'jsonc-parser';
import type { SettingSchema } from '../../api';

export type ConfigFileName = 'settings.json' | 'keybindings.json';

/** What the app knows, to help write the config files. */
export interface ConfigKnowledge {
  settings: (SettingSchema & { key: string })[];
  commands: { id: string; title?: string; category?: string }[];
}

export interface Suggestion {
  /** Text matched against what was typed, quotes included. */
  label: string;
  displayLabel: string;
  apply: string;
  detail?: string;
  info?: string;
}

export interface Suggestions {
  from: number;
  to: number;
  options: Suggestion[];
}

const KEYBINDING_PROPERTIES: [string, string][] = [
  ['key', 'Raccourci : "Ctrl+Shift+N", "Leader X"…'],
  ['command', 'Commande lancée ; "-commande" retire un raccourci'],
  ['when', 'Condition : "editorFocus"…'],
  ['args', 'Argument passé à la commande'],
];

const isLanguageBlock = (segment: unknown) =>
  typeof segment === 'string' && /^\[.+\]$/.test(segment);

/** The setting a location is about ("editor.tabSize"), in or out of a language block. */
function settingKeyOf(path: Location['path']): string | null {
  if (path.length === 1) return typeof path[0] === 'string' ? path[0] : null;
  if (path.length === 2 && isLanguageBlock(path[0])) {
    return typeof path[1] === 'string' ? path[1] : null;
  }
  return null;
}

/**
 * Range of the word being typed: from the start of the string under the cursor
 * (or of a partial word) to the end of the word. An unclosed string runs to
 * the end of the line, so its node cannot give the end: in `"edi}` the brace
 * is not part of the word.
 */
function rangeAt(text: string, pos: number, location: Location): { from: number; to: number } {
  const node = location.previousNode;
  const before = /"?[\w.[\]-]*$/.exec(text.slice(0, pos))?.[0] ?? '';
  const inNode = node && node.offset <= pos && pos <= node.offset + node.length;
  const from = inNode ? node.offset : pos - before.length;
  const after = /^[\w.[\]-]*"?/.exec(text.slice(pos))?.[0] ?? '';
  return { from, to: pos + after.length };
}

const describe = (schema: SettingSchema) =>
  [schema.description, `Par défaut : ${JSON.stringify(schema.default)}`].filter(Boolean).join('\n');

const valueSuggestions = (values: readonly unknown[]): Suggestion[] =>
  values.map((value) => {
    const text = JSON.stringify(value);
    return { label: text, displayLabel: text, apply: text };
  });

/** Completions at `pos` in the text of a config file, or null. */
export function suggest(
  file: ConfigFileName,
  text: string,
  pos: number,
  knowledge: ConfigKnowledge,
): Suggestions | null {
  const location = getLocation(text, pos);
  const range = rangeAt(text, pos, location);
  // A key typed where a value already follows only needs its name.
  const hasValue = /^\s*:/.test(text.slice(range.to));
  const { path } = location;

  if (file === 'settings.json') {
    const key = settingKeyOf(path);
    if (location.isAtPropertyKey && (path.length === 1 || isLanguageBlock(path[0]))) {
      const options = knowledge.settings.map((schema) => {
        const name = JSON.stringify(schema.key);
        return {
          label: name,
          displayLabel: schema.key,
          apply: hasValue ? name : `${name}: ${JSON.stringify(schema.default)}`,
          info: describe(schema),
        };
      });
      return { ...range, options };
    }
    const schema = key ? knowledge.settings.find((s) => s.key === key) : undefined;
    if (!location.isAtPropertyKey && schema) {
      const values = schema.enum ?? (schema.type === 'boolean' ? [true, false] : null);
      return values ? { ...range, options: valueSuggestions(values) } : null;
    }
    return null;
  }

  if (location.isAtPropertyKey && path.length === 2 && typeof path[0] === 'number') {
    const options = KEYBINDING_PROPERTIES.map(([name, info]) => ({
      label: JSON.stringify(name),
      displayLabel: name,
      apply: hasValue ? JSON.stringify(name) : `${JSON.stringify(name)}: `,
      info,
    }));
    return { ...range, options };
  }
  if (!location.isAtPropertyKey && path.length === 2 && path[1] === 'command') {
    // Removal rules only once a "-" is typed, to keep the list short.
    const removal = /^"?-/.test(text.slice(range.from, pos));
    const options = knowledge.commands.map((command) => {
      const id = `${removal ? '-' : ''}${command.id}`;
      return {
        label: JSON.stringify(id),
        displayLabel: id,
        apply: JSON.stringify(id),
        detail: command.title,
      };
    });
    return { ...range, options };
  }
  return null;
}

/** What to show when hovering `pos`: a setting's description or a command's title. */
export function explain(
  file: ConfigFileName,
  text: string,
  pos: number,
  knowledge: ConfigKnowledge,
): { from: number; to: number; text: string } | null {
  const location = getLocation(text, pos);
  const node = location.previousNode;
  // A property name comes as a "property" node, a value as a "string" one.
  const isText = node?.type === 'string' || node?.type === 'property';
  if (!node || !isText || pos < node.offset || pos > node.offset + node.length) return null;
  const range = { from: node.offset, to: node.offset + node.length };

  if (file === 'settings.json' && location.isAtPropertyKey) {
    const key = settingKeyOf(location.path);
    const schema = knowledge.settings.find((s) => s.key === key);
    return schema ? { ...range, text: `${schema.key}\n${describe(schema)}` } : null;
  }
  if (file === 'keybindings.json' && location.path[1] === 'command' && !location.isAtPropertyKey) {
    const id = String(node.value).replace(/^-/, '');
    const command = knowledge.commands.find((c) => c.id === id);
    if (!command?.title) return null;
    const title = command.category ? `${command.category} : ${command.title}` : command.title;
    return { ...range, text: title };
  }
  return null;
}
