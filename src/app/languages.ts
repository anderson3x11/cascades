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

/** Interpreters of a "#!" first line, and the language they run. */
const SHEBANGS: [RegExp, string][] = [
  [/\bpython[\d.]*\b/, 'Python'],
  [/\b(?:node|deno|bun)\b/, 'JavaScript'],
  [/\b(?:bash|sh|zsh|dash|ksh)\b/, 'Shell'],
  [/\bruby\b/, 'Ruby'],
  [/\bperl\b/, 'Perl'],
  [/\bphp\b/, 'PHP'],
  [/\blua\b/, 'Lua'],
];

/** The name of the language the start of a text shows, when its file name does not tell. */
export function languageNameFromContent(text: string): string | null {
  const start = text.slice(0, 1000);
  const firstLine = start.split('\n', 1)[0] ?? '';
  if (firstLine.startsWith('#!')) {
    return SHEBANGS.find(([pattern]) => pattern.test(firstLine))?.[1] ?? null;
  }
  if (/^\s*<\?xml\b/.test(start)) return 'XML';
  if (/^\s*(?:<!doctype html|<html[\s>])/i.test(start)) return 'HTML';
  return null;
}

/** A language by its name ("Python"), or null. */
export function languageByName(name: string): LanguageDescription | null {
  return LanguageDescription.matchLanguageName(languages, name, false);
}

/** Names of every language that can be chosen, sorted. */
export function languageNames(): string[] {
  return languages.map((l) => l.name).sort((a, b) => a.localeCompare(b));
}

/**
 * The language of a document: the one chosen by hand ("plaintext" for plain
 * text), else from its file name, else from its first lines.
 */
export function resolveLanguage(
  path: string | null,
  text: string,
  chosen: string | null,
): LanguageDescription | null {
  if (chosen === PLAINTEXT) return null;
  if (chosen) return languageByName(chosen);
  const byName = findLanguage(path);
  if (byName) return byName;
  const fromContent = languageNameFromContent(text);
  return fromContent ? languageByName(fromContent) : null;
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
