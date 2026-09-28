/** Links in text: finding the one under the pointer, and where it leads. */

export interface FoundLink {
  /** What the link points to, as written: "https://…", "notes.md", "www.site.fr". */
  target: string;
  /** Range in the line. */
  from: number;
  to: number;
}

const MARKDOWN_LINK = /!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const ANGLE_LINK = /<((?:https?:\/\/|mailto:)[^>\s]+)>/g;
const BARE_URL = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/g;

/** A URL ends before trailing punctuation, and before ")" that it did not open. */
function trimUrl(url: string): string {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1] as string;
    if ('.,;:!?\'"'.includes(ch)) end--;
    else if (
      ch === ')' &&
      (url.slice(0, end).match(/\(/g)?.length ?? 0) < (url.slice(0, end).match(/\)/g)?.length ?? 0)
    )
      end--;
    else break;
  }
  return url.slice(0, end);
}

/** The link that covers `column` in `line`, or null. */
export function linkAt(line: string, column: number): FoundLink | null {
  const covering = (
    re: RegExp,
    target: (m: RegExpExecArray) => string,
    length?: (m: RegExpExecArray) => number,
  ) => {
    re.lastIndex = 0;
    for (let m = re.exec(line); m; m = re.exec(line)) {
      const to = m.index + (length ? length(m) : m[0].length);
      if (column >= m.index && column <= to) return { target: target(m), from: m.index, to };
    }
    return null;
  };
  return (
    covering(MARKDOWN_LINK, (m) => m[1] as string) ??
    covering(ANGLE_LINK, (m) => m[1] as string) ??
    covering(
      BARE_URL,
      (m) => trimUrl(m[0]),
      (m) => trimUrl(m[0]).length,
    )
  );
}

export type Destination = { kind: 'url'; url: string } | { kind: 'file'; path: string } | null;

/** Where a link leads, from the file it is in (relative links are relative to its folder). */
export function resolve(target: string, filePath: string | null): Destination {
  if (/^www\./i.test(target)) return { kind: 'url', url: `https://${target}` };
  if (/^(https?|mailto):/i.test(target)) return { kind: 'url', url: target };
  // Other schemes (ftp:, javascript:…) are not followed; "C:\" is a drive, not a scheme.
  if (/^[a-z][a-z0-9+.-]+:/i.test(target) && !/^[a-z]:[\\/]/i.test(target)) return null;
  const clean = decodeURI(target.replace(/[#?].*$/, ''));
  if (clean === '') return null;
  if (/^[a-z]:[\\/]/i.test(clean) || clean.startsWith('/') || clean.startsWith('\\\\')) {
    return { kind: 'file', path: clean };
  }
  if (!filePath) return null;
  const sep = filePath.includes('\\') ? '\\' : '/';
  const parts = filePath.split(/[\\/]/).slice(0, -1);
  for (const part of clean.split(/[\\/]/)) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return { kind: 'file', path: parts.join(sep) };
}

/** Text that is one web address, to paste as a link. */
export function isUrl(text: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(text);
}

/** A Markdown link to `url` with `label` as its text. */
export function markdownLink(label: string, url: string): string {
  const target = /[\s()]/.test(url) ? `<${url}>` : url;
  return `[${label}](${target})`;
}
