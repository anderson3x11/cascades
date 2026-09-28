import type { RawSettings } from './registry';

type Values = Record<string, unknown>;

/** `values` with `key` set to `value`, or without `key` when `value` is undefined. */
function set(values: Values, key: string, value: unknown): Values {
  const rest = Object.fromEntries(Object.entries(values).filter(([k]) => k !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}

/**
 * Returns `raw` (settings.json content) with `key` set to `value`, globally
 * or in the "[language]" block. `undefined` removes the key, and an emptied
 * language block is removed too.
 */
export function withSetting(
  raw: RawSettings,
  key: string,
  value: unknown,
  language?: string,
): RawSettings {
  const next = structuredClone(raw);
  if (!language) return set(next, key, value);
  const blockKey = `[${language}]`;
  const current = next[blockKey];
  const block =
    typeof current === 'object' && current !== null && !Array.isArray(current)
      ? (current as Values)
      : {};
  const updated = set(block, key, value);
  return set(next, blockKey, Object.keys(updated).length > 0 ? updated : undefined);
}
