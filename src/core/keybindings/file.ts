import { parseWhen } from '../context/when';
import { parseJsonc } from '../settings/file';
import { parseKeySequence } from './keys';
import type { KeybindingSpec } from './registry';

export interface KeybindingsFile {
  bindings: KeybindingSpec[];
  /** One message per ignored entry. */
  errors: string[];
}

/**
 * Reads keybindings.json, in the VS Code format: an array of
 * { "key", "command", "when"?, "args"? }. A "-" before the command removes a
 * shortcut. Invalid entries are skipped and reported, the others still apply.
 * Throws when the file itself cannot be read.
 */
export function parseKeybindings(text: string | null): KeybindingsFile {
  if (text === null || text.trim() === '') return { bindings: [], errors: [] };
  const value = parseJsonc(text);
  if (!Array.isArray(value)) throw new Error('le fichier doit contenir une liste [ … ]');

  const bindings: KeybindingSpec[] = [];
  const errors: string[] = [];
  value.forEach((item: unknown, index) => {
    try {
      bindings.push(toSpec(item));
    } catch (err) {
      errors.push(`entrée ${index + 1} : ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  return { bindings, errors };
}

function toSpec(item: unknown): KeybindingSpec {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new Error('un objet { "key", "command" } est attendu');
  }
  const { key, command, when, args } = item as Record<string, unknown>;
  if (typeof command !== 'string' || command.replace(/^-/, '') === '') {
    throw new Error('"command" manquant');
  }
  const removal = command.startsWith('-');
  if (typeof key !== 'string' || (!removal && key.trim() === '')) {
    throw new Error('"key" manquant');
  }
  if (key.trim() !== '') parseKeySequence(key);
  if (when !== undefined) {
    if (typeof when !== 'string') throw new Error('"when" doit être un texte');
    parseWhen(when);
  }
  const spec: KeybindingSpec = { key, command };
  if (when !== undefined) spec.when = when;
  // VS Code passes a single argument; a list gives several.
  if (args !== undefined) spec.args = Array.isArray(args) ? args : [args];
  return spec;
}
