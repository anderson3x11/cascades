export interface LanguageChoice {
  /** Base language tag, the value of the spellcheck.language setting ("fr"). */
  tag: string;
  label: string;
}

/**
 * One choice per language from the dictionaries Windows reports ("fr-FR",
 * "fr-BE"… make one "French"), named in `locale`. Technical tags
 * ("zh-Latn-CN-x-ext") are left out.
 */
export function languageChoices(installed: readonly string[], locale = 'en'): LanguageChoice[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'language' });
  } catch {
    // Without names, the tags are shown as they are.
  }
  const choices = new Map<string, LanguageChoice>();
  for (const full of installed) {
    if (/-x-/i.test(full)) continue;
    const tag = full.split('-')[0]?.toLowerCase() ?? '';
    if (!/^[a-z]{2,3}$/.test(tag) || choices.has(tag)) continue;
    let label = tag;
    try {
      label = names?.of(tag) ?? tag;
    } catch {
      // An unknown tag keeps its code as name.
    }
    choices.set(tag, { tag, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return [...choices.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
}
