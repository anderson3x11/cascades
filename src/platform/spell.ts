import { invoke, isTauri } from '@tauri-apps/api/core';

/** A misspelled word in a line, in JavaScript string units. */
export interface Misspelling {
  start: number;
  length: number;
}

// In a browser (dev server, e2e tests): a tiny stand-in dictionary.
const FAKE_MISSPELLED = new Set(['chocola', 'fote', 'exemlpe']);
const FAKE_SUGGESTIONS: Record<string, string[]> = {
  chocola: ['chocolat', 'chocolats'],
  fote: ['faute', 'fête'],
};

function fakeCheck(lines: string[]): Misspelling[][] {
  return lines.map((line) =>
    [...line.matchAll(/\p{L}+/gu)]
      .filter((m) => FAKE_MISSPELLED.has(m[0].toLowerCase()))
      .map((m) => ({ start: m.index, length: m[0].length })),
  );
}

/** Misspellings of each line, with the system's dictionary for `language` ("fr"). */
export async function checkSpelling(language: string, lines: string[]): Promise<Misspelling[][]> {
  if (!isTauri()) return fakeCheck(lines);
  return await invoke<Misspelling[][]>('spell_check', { language, lines });
}

export async function suggestSpelling(language: string, word: string): Promise<string[]> {
  if (!isTauri()) return FAKE_SUGGESTIONS[word.toLowerCase()] ?? [];
  return await invoke<string[]>('spell_suggest', { language, word });
}

/** Language tags with a dictionary installed ("fr-FR", "en-US"). */
export async function spellingLanguages(): Promise<string[]> {
  if (!isTauri()) return ['fr-FR', 'en-US'];
  return await invoke<string[]>('spell_languages');
}

/** Adds a word to the user's dictionary, kept by the system. */
export async function addToDictionary(language: string, word: string): Promise<void> {
  if (!isTauri()) {
    FAKE_MISSPELLED.delete(word.toLowerCase());
    return;
  }
  await invoke('spell_add', { language, word });
}
