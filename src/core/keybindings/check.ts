import type { Node } from 'jsonc-parser';
import { parseWhen } from '../context/when';
import { parseJsoncTree, problemAt, type ConfigProblem } from '../settings/file';
import { t } from '../i18n/i18n';
import { parseKeySequence } from './keys';

const PROPERTIES = ['key', 'command', 'when', 'args'];
const notText = () => t('expected: {type}', { type: t('a text in quotes') });

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Mistakes in keybindings.json: syntax, invalid keys or conditions, unknown commands. */
export function checkKeybindings(
  text: string,
  hasCommand: (id: string) => boolean,
): ConfigProblem[] {
  const { tree, problems } = parseJsoncTree(text);
  if (!tree) return problems;
  if (tree.type !== 'array') {
    return [...problems, problemAt(tree, 'error', t('the file must hold a list [ … ]'))];
  }

  for (const item of tree.children ?? []) {
    if (item.type !== 'object') {
      problems.push(
        problemAt(item, 'error', t('expected: {type}', { type: '{ "key": …, "command": … }' })),
      );
      continue;
    }
    const values = new Map<string, Node>();
    for (const property of item.children ?? []) {
      const [keyNode, valueNode] = property.children ?? [];
      if (!keyNode) continue;
      const name = String(keyNode.value);
      if (!PROPERTIES.includes(name)) {
        problems.push(
          problemAt(
            keyNode,
            'warning',
            t('unknown property ({known})', { known: PROPERTIES.join(', ') }),
          ),
        );
      } else if (valueNode) {
        values.set(name, valueNode);
      }
    }
    // Missing properties are reported on the opening brace.
    const brace = { offset: item.offset, length: 1 };

    const command = values.get('command');
    let removal = false;
    if (!command) {
      problems.push(problemAt(brace, 'error', t('missing "{name}"', { name: 'command' })));
    } else if (command.type !== 'string') {
      problems.push(problemAt(command, 'error', notText()));
    } else {
      const id = String(command.value);
      removal = id.startsWith('-');
      const name = id.replace(/^-/, '');
      if (!hasCommand(name)) {
        problems.push(problemAt(command, 'warning', t('unknown command: {name}', { name })));
      }
    }

    const key = values.get('key');
    if (!key) {
      if (!removal)
        problems.push(problemAt(brace, 'error', t('missing "{name}"', { name: 'key' })));
    } else if (key.type !== 'string') {
      problems.push(problemAt(key, 'error', notText()));
    } else if (String(key.value).trim() === '') {
      if (!removal) problems.push(problemAt(key, 'error', t('empty shortcut')));
    } else {
      try {
        parseKeySequence(String(key.value));
      } catch (err) {
        problems.push(problemAt(key, 'error', messageOf(err)));
      }
    }

    const when = values.get('when');
    if (when && when.type !== 'string') {
      problems.push(problemAt(when, 'error', notText()));
    } else if (when) {
      try {
        parseWhen(String(when.value));
      } catch (err) {
        problems.push(problemAt(when, 'error', messageOf(err)));
      }
    }
  }
  return problems;
}
