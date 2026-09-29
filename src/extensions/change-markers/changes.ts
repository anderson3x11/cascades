import { diff } from '@codemirror/merge';
import type { Text } from '@codemirror/state';

export type ChangeKind = 'added' | 'modified' | 'deleted';

/** Past this many different lines, the comparison is not made (huge files). */
const MAX_DISTINCT_LINES = 60_000;

/**
 * Compares line by line: each distinct line becomes one character, so that a
 * text diff of those strings is a line diff. Surrogate code points are
 * skipped so that each line stays one string unit.
 */
function lineStrings(a: Text, b: Text): [string, string] | null {
  const ids = new Map<string, string>();
  const encode = (doc: Text) => {
    let out = '';
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n).text;
      let id = ids.get(line);
      if (id === undefined) {
        const index = ids.size;
        if (index >= MAX_DISTINCT_LINES) return null;
        id = String.fromCharCode(index < 0xd800 ? index : index + 0x800);
        ids.set(line, id);
      }
      out += id;
    }
    return out;
  };
  const encodedA = encode(a);
  const encodedB = encodedA === null ? null : encode(b);
  return encodedA === null || encodedB === null ? null : [encodedA, encodedB];
}

/**
 * How each line of `current` differs from `saved`: added or modified lines,
 * and "deleted" on the line that follows removed lines. Line numbers are
 * 1-based; unchanged lines are absent.
 */
export function changedLines(saved: Text, current: Text): Map<number, ChangeKind> {
  const lines = new Map<number, ChangeKind>();
  const strings = lineStrings(saved, current);
  if (!strings) return lines;
  for (const change of diff(...strings)) {
    if (change.fromB === change.toB) {
      const line = Math.min(change.fromB + 1, current.lines);
      if (!lines.has(line)) lines.set(line, 'deleted');
      continue;
    }
    const kind: ChangeKind = change.fromA === change.toA ? 'added' : 'modified';
    for (let n = change.fromB + 1; n <= change.toB; n++) lines.set(n, kind);
  }
  return lines;
}
