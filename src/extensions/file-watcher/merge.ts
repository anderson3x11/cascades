/**
 * Line-based three-way merge, as git does: changes made on only one side
 * are taken, and places where both sides changed the same lines differently
 * become conflicts.
 */

export type MergeChunk =
  { kind: 'ok'; lines: string[] } | { kind: 'conflict'; mine: string[]; theirs: string[] };

/** Above this many cell comparisons, a changed middle is treated as one block. */
const MAX_DIFF_CELLS = 4_000_000;

/** Matching lines between `a` and `b` (longest common subsequence), as a map a index -> b index. */
function matchLines(a: readonly string[], b: readonly string[]): Map<number, number> {
  const matches = new Map<number, number>();
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    matches.set(start, start);
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
    matches.set(endA, endB);
  }
  const n = endA - start;
  const m = endB - start;
  if (n === 0 || m === 0 || n * m > MAX_DIFF_CELLS) return matches;

  // Classic LCS table on the differing middle, filled from the end.
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = table[i] as Uint32Array;
    const next = table[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) {
      row[j] =
        a[start + i] === b[start + j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      matches.set(start + i, start + j);
      i++;
      j++;
    } else if (
      ((table[i + 1] as Uint32Array)[j] as number) >= ((table[i] as Uint32Array)[j + 1] as number)
    ) {
      i++;
    } else {
      j++;
    }
  }
  return matches;
}

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

export function merge3(base: string, mine: string, theirs: string): MergeChunk[] {
  const b = base.split('\n');
  const m = mine.split('\n');
  const t = theirs.split('\n');
  const toMine = matchLines(b, m);
  const toTheirs = matchLines(b, t);

  const chunks: MergeChunk[] = [];
  const push = (lines: string[]) => {
    const last = chunks[chunks.length - 1];
    if (last?.kind === 'ok') last.lines.push(...lines);
    else if (lines.length > 0) chunks.push({ kind: 'ok', lines });
  };

  let bi = 0;
  let mi = 0;
  let ti = 0;
  for (;;) {
    // Next base line kept by both sides: everything before it is a changed region.
    let sync = bi;
    while (sync < b.length && !(toMine.has(sync) && toTheirs.has(sync))) sync++;
    const mEnd = sync < b.length ? (toMine.get(sync) as number) : m.length;
    const tEnd = sync < b.length ? (toTheirs.get(sync) as number) : t.length;

    const basePart = b.slice(bi, sync);
    const minePart = m.slice(mi, mEnd);
    const theirsPart = t.slice(ti, tEnd);
    if (same(minePart, basePart)) push(theirsPart);
    else if (same(theirsPart, basePart) || same(minePart, theirsPart)) push(minePart);
    else chunks.push({ kind: 'conflict', mine: minePart, theirs: theirsPart });

    if (sync >= b.length) break;
    push([b[sync] as string]);
    bi = sync + 1;
    mi = mEnd + 1;
    ti = tEnd + 1;
  }
  return chunks;
}

export const MARKER_MINE = '<<<<<<< ma version';
export const MARKER_SEPARATOR = '=======';
export const MARKER_THEIRS = '>>>>>>> version du disque';

/** Merged text, with conflicts written between git-style markers. */
export function renderMerge(chunks: readonly MergeChunk[]): { text: string; conflicts: number } {
  const lines: string[] = [];
  let conflicts = 0;
  for (const chunk of chunks) {
    if (chunk.kind === 'ok') {
      lines.push(...chunk.lines);
    } else {
      conflicts++;
      lines.push(MARKER_MINE, ...chunk.mine, MARKER_SEPARATOR, ...chunk.theirs, MARKER_THEIRS);
    }
  }
  return { text: lines.join('\n'), conflicts };
}
