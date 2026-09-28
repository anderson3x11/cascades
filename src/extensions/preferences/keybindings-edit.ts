import { applyEdits, getNodeValue, modify, parseTree, type ParseError } from 'jsonc-parser';
import { isEmpty, KEYBINDINGS_TEMPLATE } from './templates';

/** A shortcut as listed by ctx.keybindings.list(). */
export interface Shortcut {
  key: string;
  command: string;
  when: string | undefined;
  source: 'default' | 'user';
}

interface FileEntry {
  key?: unknown;
  command?: unknown;
  when?: unknown;
}

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' } };

/** The entries of keybindings.json. Refuses a file that cannot be read safely. */
function entriesOf(text: string): FileEntry[] {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true });
  if (errors.length > 0 || root?.type !== 'array') {
    throw new Error('keybindings.json contient une erreur, corrige-la d’abord.');
  }
  return (root.children ?? []).map((node) => getNodeValue(node) as FileEntry);
}

function removeWhere(text: string, test: (entry: FileEntry) => boolean): string {
  const entries = entriesOf(text);
  // From the end, so that the indexes of the entries left do not move.
  for (let i = entries.length - 1; i >= 0; i--) {
    if (test(entries[i] as FileEntry))
      text = applyEdits(text, modify(text, [i], undefined, FORMAT));
  }
  return text;
}

function append(text: string, entry: Shortcut | FileEntry): string {
  const { key, command, when } = entry;
  const value = when === undefined ? { key, command } : { key, command, when };
  const index = entriesOf(text).length;
  return applyEdits(text, modify(text, [index], value, { ...FORMAT, isArrayInsertion: true }));
}

const isEntryOf = (shortcut: Shortcut) => (entry: FileEntry) =>
  entry.key === shortcut.key && entry.command === shortcut.command && entry.when === shortcut.when;

/** A default shortcut is removed by a "-command" rule; a user one by deleting its entry. */
function without(text: string, shortcut: Shortcut): string {
  if (shortcut.source === 'user') return removeWhere(text, isEntryOf(shortcut));
  return append(text, { ...shortcut, command: `-${shortcut.command}` });
}

const start = (text: string | null) =>
  text === null || isEmpty(text) ? KEYBINDINGS_TEMPLATE : text;

/** Gives `command` the shortcut `key`, in place of `previous` when given. */
export function setShortcut(
  text: string | null,
  command: string,
  key: string,
  previous?: Shortcut,
): string {
  let next = start(text);
  if (previous) next = without(next, previous);
  return append(next, { key, command, when: previous?.when });
}

/** Removes one shortcut. */
export function removeShortcut(text: string | null, shortcut: Shortcut): string {
  return without(start(text), shortcut);
}

/** Forgets every change made to the shortcuts of `command`. */
export function resetCommand(text: string | null, command: string): string {
  return removeWhere(start(text), (e) => e.command === command || e.command === `-${command}`);
}

/** Whether keybindings.json changes the shortcuts of `command`. */
export function isCustomized(text: string | null, command: string): boolean {
  if (text === null || isEmpty(text)) return false;
  try {
    return entriesOf(text).some((e) => e.command === command || e.command === `-${command}`);
  } catch {
    return false;
  }
}

/** Shortcuts by command, in their order. */
export function groupByCommand<T extends { command: string }>(shortcuts: T[]): Map<string, T[]> {
  const byCommand = new Map<string, T[]>();
  for (const shortcut of shortcuts) {
    byCommand.set(shortcut.command, [...(byCommand.get(shortcut.command) ?? []), shortcut]);
  }
  return byCommand;
}
