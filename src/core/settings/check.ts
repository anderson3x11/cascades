import { getNodeValue, type Node } from 'jsonc-parser';
import { parseJsoncTree, problemAt, type ConfigProblem } from './file';
import { t } from '../i18n/i18n';
import type { SettingSchema, SettingType } from './registry';

const typeNames = (): Record<SettingType, string> => ({
  string: t('a text in quotes'),
  number: t('a number'),
  boolean: t('true or false'),
  array: t('a list [ … ]'),
  object: t('an object { … }'),
});

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  return value === null ? 'null' : typeof value;
}

/** Why `value` does not fit the setting, or null. */
function valueProblem(schema: SettingSchema, value: unknown): string | null {
  if (typeOf(value) !== schema.type)
    return t('expected: {type}', { type: typeNames()[schema.type] });
  if (schema.enum && !schema.enum.includes(value)) {
    return t('possible values: {values}', {
      values: schema.enum.map((v) => JSON.stringify(v)).join(', '),
    });
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
    return [...problems, problemAt(tree, 'error', t('the file must hold an object { … }'))];
  }

  const checkObject = (object: Node, inLanguageBlock: boolean) => {
    for (const property of object.children ?? []) {
      const [keyNode, valueNode] = property.children ?? [];
      if (!keyNode) continue;
      const key = String(keyNode.value);
      if (!inLanguageBlock && /^\[.+\]$/.test(key)) {
        if (valueNode?.type === 'object') checkObject(valueNode, true);
        else if (valueNode)
          problems.push(
            problemAt(valueNode, 'error', t('expected: {type}', { type: t('an object { … }') })),
          );
        continue;
      }
      const schema = schemaOf(key);
      if (!schema) {
        problems.push(problemAt(keyNode, 'warning', t('unknown setting: {key}', { key })));
        continue;
      }
      const message = valueNode ? valueProblem(schema, getNodeValue(valueNode)) : null;
      if (valueNode && message) problems.push(problemAt(valueNode, 'error', message));
    }
  };
  checkObject(tree, false);
  return problems;
}
