/**
 * Fuzzy matching for pickers: every query character must appear in order in
 * the text. Case and accents are ignored ("theme" matches "Thème").
 */

export interface FuzzyMatch {
  score: number;
  /** Indices of the matched characters in the text, for highlighting. */
  indices: number[];
}

/** One comparable character per text character, so indices stay aligned. */
function fold(text: string): string[] {
  return [...text].map((ch) => (ch.normalize('NFD')[0] ?? ch).toLowerCase());
}

const SEPARATOR = /[\s\-_./\\:()[\]]/;

function isWordStart(chars: readonly string[], i: number): boolean {
  if (i === 0) return true;
  const prev = chars[i - 1] ?? '';
  const cur = chars[i] ?? '';
  return SEPARATOR.test(prev) || (prev === prev.toLowerCase() && cur !== cur.toLowerCase());
}

/** First index where `q` appears as is in `t`, preferring one that starts a word, or -1. */
function substringAt(t: readonly string[], chars: readonly string[], q: readonly string[]): number {
  let first = -1;
  for (let i = 0; i + q.length <= t.length; i++) {
    if (!q.every((c, j) => t[i + j] === c)) continue;
    if (isWordStart(chars, i)) return i;
    if (first === -1) first = i;
  }
  return first;
}

/**
 * Indices of `q` in `t` where each character either follows the previous one
 * or starts a word ("sd" in "Solarized dark", "eldr" in "Elden Ring"), or null.
 */
function wordMatch(t: readonly string[], chars: readonly string[], q: readonly string[]) {
  const failed = new Set<string>();
  const solve = (qi: number, prev: number): number[] | null => {
    if (qi === q.length) return [];
    const key = `${qi} ${prev}`;
    if (failed.has(key)) return null;
    const candidates: number[] = [];
    const next = prev >= 0 && t[prev + 1] === q[qi];
    if (next) candidates.push(prev + 1);
    for (let i = prev + 1; i < t.length; i++) {
      if (next && i === prev + 1) continue;
      if (t[i] === q[qi] && isWordStart(chars, i)) candidates.push(i);
    }
    for (const i of candidates) {
      const rest = solve(qi + 1, i);
      if (rest) return [i, ...rest];
    }
    failed.add(key);
    return null;
  };
  return solve(0, -1);
}

export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const trimmed = fold(query.trim());
  const q = trimmed.filter((c) => c !== ' ');
  if (q.length === 0) return { score: 0, indices: [] };
  const chars = [...text];
  const t = fold(text);

  // The query as is, spaces included, anywhere in the text: the best match.
  const at = substringAt(t, chars, trimmed);
  if (at !== -1) {
    const indices = trimmed.map((_, j) => at + j);
    const score = trimmed.length * 4 + (isWordStart(chars, at) ? 4 : 0) + (at === 0 ? 3 : 0);
    return { score, indices };
  }

  const indices = wordMatch(t, chars, q);
  if (!indices) return null;
  let score = 0;
  indices.forEach((found, k) => {
    const previous = indices[k - 1];
    score += 1;
    if (previous !== undefined && found === previous + 1) score += 3;
    if (isWordStart(chars, found)) score += 4;
    if (previous !== undefined) score -= Math.min(found - previous - 1, 10) * 0.2;
  });
  if (indices[0] === 0) score += 3;
  return { score, indices };
}

/** Items that match, best first; ties keep shorter labels, then the original order. */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  label: (item: T) => string,
): { item: T; match: FuzzyMatch }[] {
  const results: { item: T; match: FuzzyMatch; order: number }[] = [];
  items.forEach((item, order) => {
    const match = fuzzyMatch(query, label(item));
    if (match) results.push({ item, match, order });
  });
  if (query.trim() === '') return results;
  return results.sort(
    (a, b) =>
      b.match.score - a.match.score ||
      label(a.item).length - label(b.item).length ||
      a.order - b.order,
  );
}
