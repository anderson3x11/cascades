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

/** How far past the first occurrence a word-start occurrence is still preferred. */
const WORD_START_REACH = 8;

function isWordStart(chars: readonly string[], i: number): boolean {
  if (i === 0) return true;
  const prev = chars[i - 1] ?? '';
  const cur = chars[i] ?? '';
  return SEPARATOR.test(prev) || (prev === prev.toLowerCase() && cur !== cur.toLowerCase());
}

/** Whether q[from..] appears in order in t[start..]. */
function fits(t: readonly string[], q: readonly string[], from: number, start: number): boolean {
  let at = start;
  for (let i = from; i < q.length; i++) {
    at = t.indexOf(q[i] as string, at);
    if (at === -1) return false;
    at++;
  }
  return true;
}

export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = fold(query.trim()).filter((c) => c !== ' ');
  if (q.length === 0) return { score: 0, indices: [] };
  const chars = [...text];
  const t = fold(text);
  const indices: number[] = [];
  let score = 0;
  let from = 0;

  for (const [qi, qc] of q.entries()) {
    const first = t.indexOf(qc, from);
    if (first === -1) return null;
    // Prefer an occurrence that starts a word, if one comes soon after and
    // the rest of the query still fits after it.
    let found = first;
    for (let i = first; i < t.length && i <= first + WORD_START_REACH; i++) {
      if (t[i] === qc && isWordStart(chars, i) && fits(t, q, qi + 1, i + 1)) {
        found = i;
        break;
      }
    }
    const previous = indices[indices.length - 1];
    score += 1;
    if (previous !== undefined && found === previous + 1) score += 3;
    if (isWordStart(chars, found)) score += 4;
    if (previous !== undefined) score -= Math.min(found - previous - 1, 10) * 0.2;
    indices.push(found);
    from = found + 1;
  }
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
