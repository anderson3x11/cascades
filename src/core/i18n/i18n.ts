import { toDisposable, type Disposable } from '../disposable';

/** English text -> text in another language. */
export type Catalog = Record<string, string>;

/** Languages the interface is translated into, English first. */
export const UI_LANGUAGES = ['en', 'fr'] as const;

let current = 'en';
const catalogs = new Map<string, Catalog[]>();

/** Language of the interface ("en", "fr"). */
export function language(): string {
  return current;
}

/** Sets the language of the interface; strings translated afterwards follow it. */
export function setLanguage(tag: string): void {
  current = tag;
}

/**
 * Adds translations for a language. Later catalogs win over earlier ones, so
 * a plugin can also correct a built-in translation.
 */
export function addTranslations(tag: string, catalog: Catalog): Disposable {
  const list = catalogs.get(tag) ?? [];
  list.push(catalog);
  catalogs.set(tag, list);
  return toDisposable(() => {
    const index = list.indexOf(catalog);
    if (index >= 0) list.splice(index, 1);
  });
}

/**
 * The English `text` in the language of the interface. `{name}` placeholders
 * are replaced by `params.name`, after translation, so the translated text
 * can place them anywhere: the text "Close {file}?" with params { file }.
 */
export function t(text: string, params?: Record<string, string | number>): string {
  let out = text;
  const list = catalogs.get(current);
  if (list) {
    for (let i = list.length - 1; i >= 0; i--) {
      const translated = list[i]?.[text];
      if (translated !== undefined) {
        out = translated;
        break;
      }
    }
  }
  if (!params) return out;
  return out.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * The interface language for the `workbench.language` setting: a language of
 * `available`, or with "auto", the first system language that is available
 * (English when none is).
 */
export function pickLanguage(
  setting: unknown,
  system: readonly string[],
  available: readonly string[] = UI_LANGUAGES,
): string {
  if (typeof setting === 'string' && available.includes(setting)) return setting;
  for (const tag of system) {
    const base = tag.split('-')[0]?.toLowerCase() ?? '';
    if (available.includes(base)) return base;
  }
  return 'en';
}
