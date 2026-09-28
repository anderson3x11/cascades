import { getNodeValue, type Node } from 'jsonc-parser';
import { parseJsoncTree, problemAt, type ConfigProblem } from './file';
import type { SettingSchema, SettingType } from './registry';

const TYPE_NAMES: Record<SettingType, string> = {
  string: 'un texte entre guillemets',
  number: 'un nombre',
  boolean: 'true ou false',
  array: 'une liste [ … ]',
  object: 'un objet { … }',
};

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  return value === null ? 'null' : typeof value;
}

/** Why `value` does not fit the setting, or null. */
function valueProblem(schema: SettingSchema, value: unknown): string | null {
  if (typeOf(value) !== schema.type) return `attendu : ${TYPE_NAMES[schema.type]}`;
  if (schema.enum && !schema.enum.includes(value)) {
    return `valeurs possibles : ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`;
  }
  return null;
}

/** Mistakes in settings.json: syntax, unknown settings, wrong values. */
export function checkSettings(
  text: string,
  schemaOf: (key: string) => SettingSchema | undefined,
): ConfigProblem[] {
  const { tree, problems } = parseJsoncTree(text);
  if (!tree) return problems;
  if (tree.type !== 'object') {
    return [...problems, problemAt(tree, 'error', 'le fichier doit contenir un objet { … }')];
  }

  const checkObject = (object: Node, inLanguageBlock: boolean) => {
    for (const property of object.children ?? []) {
      const [keyNode, valueNode] = property.children ?? [];
      if (!keyNode) continue;
      const key = String(keyNode.value);
      if (!inLanguageBlock && /^\[.+\]$/.test(key)) {
        if (valueNode?.type === 'object') checkObject(valueNode, true);
        else if (valueNode)
          problems.push(problemAt(valueNode, 'error', 'attendu : un objet { … }'));
        continue;
      }
      const schema = schemaOf(key);
      if (!schema) {
        problems.push(problemAt(keyNode, 'warning', `réglage inconnu : ${key}`));
        continue;
      }
      const message = valueNode ? valueProblem(schema, getNodeValue(valueNode)) : null;
      if (valueNode && message) problems.push(problemAt(valueNode, 'error', message));
    }
  };
  checkObject(tree, false);
  return problems;
}
