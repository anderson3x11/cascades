import { parseWhen } from '../context/when';
import { parseJsonc } from '../settings/file';
import { t } from '../i18n/i18n';
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
  if (!Array.isArray(value)) throw new Error(t('the file must hold a list [ … ]'));

  const bindings: KeybindingSpec[] = [];
  const errors: string[] = [];
  value.forEach((item: unknown, index) => {
    try {
      bindings.push(toSpec(item));
    } catch (err) {
      errors.push(
        t('entry {number}: {problem}', {
          number: index + 1,
          problem: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  });
  return { bindings, errors };
}

function toSpec(item: unknown): KeybindingSpec {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new Error(t('expected: {type}', { type: '{ "key", "command" }' }));
  }
  const { key, command, when, args } = item as Record<string, unknown>;
  if (typeof command !== 'string' || command.replace(/^-/, '') === '') {
    throw new Error(t('missing "{name}"', { name: 'command' }));
  }
  const removal = command.startsWith('-');
  if (typeof key !== 'string' || (!removal && key.trim() === '')) {
    throw new Error(t('missing "{name}"', { name: 'key' }));
  }
  if (key.trim() !== '') parseKeySequence(key);
  if (when !== undefined) {
    if (typeof when !== 'string') throw new Error(t('"{name}" must be a text', { name: 'when' }));
    parseWhen(when);
  }
  const spec: KeybindingSpec = { key, command };
  if (when !== undefined) spec.when = when;
  // VS Code passes a single argument; a list gives several.
  if (args !== undefined) spec.args = Array.isArray(args) ? args : [args];
  return spec;
}
