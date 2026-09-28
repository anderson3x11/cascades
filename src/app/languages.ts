import { LanguageDescription, type LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';

export const PLAINTEXT = 'plaintext';

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function findLanguage(path: string | null): LanguageDescription | null {
  if (!path) return null;
  return LanguageDescription.matchFilename(languages, basename(path));
}

/** Language id used for settings overrides and `when` clauses, e.g. "markdown". */
export function languageId(description: LanguageDescription | null): string {
  return description ? description.name.toLowerCase() : PLAINTEXT;
}

export async function loadLanguage(
  description: LanguageDescription | null,
): Promise<LanguageSupport | null> {
  return description ? await description.load() : null;
}
