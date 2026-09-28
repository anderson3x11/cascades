const WORD = /[\p{L}\p{N}_'’-]+/gu;

export function countWords(text: string): number {
  let count = 0;
  for (const match of text.matchAll(WORD)) {
    // A lone apostrophe or hyphen is not a word.
    if (/[\p{L}\p{N}]/u.test(match[0])) count++;
  }
  return count;
}

/** Characters as the user sees them (a surrogate pair or an emoji counts once). */
export function countChars(text: string): number {
  let count = text.length;
  for (let i = 0; i < text.length - 1; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        count--;
        i++;
      }
    }
  }
  return count;
}
