import type { Node } from 'jsonc-parser';
import { parseWhen } from '../context/when';
import { parseJsoncTree, problemAt, type ConfigProblem } from '../settings/file';
import { parseKeySequence } from './keys';

const PROPERTIES = ['key', 'command', 'when', 'args'];
const NOT_TEXT = 'attendu : un texte entre guillemets';

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Mistakes in keybindings.json: syntax, invalid keys or conditions, unknown commands. */
export function checkKeybindings(
  text: string,
  hasCommand: (id: string) => boolean,
): ConfigProblem[] {
  const { tree, problems } = parseJsoncTree(text);
  if (!tree) return problems;
  if (tree.type !== 'array') {
    return [...problems, problemAt(tree, 'error', 'le fichier doit contenir une liste [ … ]')];
  }

  for (const item of tree.children ?? []) {
    if (item.type !== 'object') {
      problems.push(problemAt(item, 'error', 'attendu : { "key": …, "command": … }'));
      continue;
    }
    const values = new Map<string, Node>();
    for (const property of item.children ?? []) {
      const [keyNode, valueNode] = property.children ?? [];
      if (!keyNode) continue;
      const name = String(keyNode.value);
      if (!PROPERTIES.includes(name)) {
        problems.push(
          problemAt(keyNode, 'warning', `propriété inconnue (${PROPERTIES.join(', ')})`),
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
      problems.push(problemAt(brace, 'error', '"command" manquant'));
    } else if (command.type !== 'string') {
      problems.push(problemAt(command, 'error', NOT_TEXT));
    } else {
      const id = String(command.value);
      removal = id.startsWith('-');
      const name = id.replace(/^-/, '');
      if (!hasCommand(name)) {
        problems.push(problemAt(command, 'warning', `commande inconnue : ${name}`));
      }
    }

    const key = values.get('key');
    if (!key) {
      if (!removal) problems.push(problemAt(brace, 'error', '"key" manquant'));
    } else if (key.type !== 'string') {
      problems.push(problemAt(key, 'error', NOT_TEXT));
    } else if (String(key.value).trim() === '') {
      if (!removal) problems.push(problemAt(key, 'error', 'raccourci vide'));
    } else {
      try {
        parseKeySequence(String(key.value));
      } catch (err) {
        problems.push(problemAt(key, 'error', messageOf(err)));
      }
    }

    const when = values.get('when');
    if (when && when.type !== 'string') {
      problems.push(problemAt(when, 'error', NOT_TEXT));
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
