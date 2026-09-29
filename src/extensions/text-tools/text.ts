/** Text transformations: case and whole lines. Pure functions, tested on their own. */

const LOCALE = 'fr';

export const upperCase = (text: string) => text.toLocaleUpperCase(LOCALE);
export const lowerCase = (text: string) => text.toLocaleLowerCase(LOCALE);

/**
 * "Majuscule À Chaque Mot": the first letter of each word up, the rest down.
 * A word starts after a space or a hyphen ("Jean-Pierre"), not after an
 * apostrophe ("L'été", not "L'Été").
 */
export function titleCase(text: string): string {
  return lowerCase(text).replace(
    /(^|[^\p{L}\p{N}'’])(\p{L})/gu,
    (_, before: string, letter: string) => before + upperCase(letter),
  );
}

/**
 * "Majuscule en début de phrase": everything down, then a capital at the start
 * of the text, after . ! ? … and at the start of each line (after its
 * indentation and list marker: "- ", "1. ", "- [ ] ").
 */
export function sentenceCase(text: string): string {
  return lowerCase(text).replace(
    /(^[\t ]*(?:(?:[-*+>]|\d+[.)])[\t ]+(?:\[[ xX]\][\t ]+)?)?|[.!?…][\t ]+)(\p{L})/gmu,
    (_, before: string, letter: string) => before + upperCase(letter),
  );
}

const collator = new Intl.Collator(LOCALE, { sensitivity: 'base', numeric: true });

/** Lines sorted as people read them: accents and case ignored, "2" before "10". */
export function sortLines(lines: readonly string[], descending = false): string[] {
  const sorted = [...lines].sort((a, b) => collator.compare(a, b));
  return descending ? sorted.reverse() : sorted;
}

/** Lines without the repeats of an earlier line. Blank lines are kept: they separate paragraphs. */
export function removeDuplicateLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (line.trim() === '') return true;
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
}

export const trimTrailingWhitespace = (lines: readonly string[]) =>
  lines.map((line) => line.replace(/[\t ]+$/, ''));

/** The lines on one line, separated by a space; the indentation of the joined lines goes. */
export function joinLines(lines: readonly string[]): string[] {
  const [first = '', ...rest] = lines;
  const parts = rest.map((line) => line.trim()).filter((line) => line !== '');
  return [[first.replace(/[\t ]+$/, ''), ...parts].join(' ')];
}
