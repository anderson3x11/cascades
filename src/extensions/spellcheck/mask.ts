/** Parts of a line that are not words to check: addresses, e-mails, `code`. */
const NOT_WORDS = /\b(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+|`[^`\n]*`/g;

/** The line with those parts blanked out, same length so that positions still match. */
export function maskLine(line: string): string {
  return line.replace(NOT_WORDS, (part) => ' '.repeat(part.length));
}
