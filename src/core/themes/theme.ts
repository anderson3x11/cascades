/**
 * A theme: a name, a base type (light or dark palette) and the CSS
 * variables it overrides, without their leading "--" ("bg", "syn-keyword").
 */
export interface Theme {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: Record<string, string>;
}

const COLOR_KEY = /^[a-z][a-z0-9-]*$/;
/** Values end up in style.setProperty; this keeps them to plain CSS values. */
const UNSAFE_VALUE = /[;{}<>]/;

/**
 * Parses a theme file. Throws an Error with a readable message when the
 * file is not a valid theme.
 */
export function parseTheme(id: string, json: string): Theme {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`JSON invalide : ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('le fichier doit contenir un objet');
  }
  const { name, type, colors } = raw as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim() === '') throw new Error('"name" manquant');
  if (type !== 'light' && type !== 'dark') throw new Error('"type" doit valoir "light" ou "dark"');
  if (typeof colors !== 'object' || colors === null || Array.isArray(colors)) {
    throw new Error('"colors" doit être un objet');
  }
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    if (!COLOR_KEY.test(key)) throw new Error(`nom de couleur invalide : "${key}"`);
    if (typeof value !== 'string' || UNSAFE_VALUE.test(value) || value.length > 200) {
      throw new Error(`valeur invalide pour "${key}"`);
    }
    clean[key] = value;
  }
  return { id, name, type, colors: clean };
}
