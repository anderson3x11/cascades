import type { EditorState } from '@codemirror/state';

export interface Passage {
  from: number;
  to: number;
  /** Text kept in the quarantine (without the removed line break). */
  text: string;
  /** 1-based line where the passage started. */
  line: number;
}

/**
 * Passages to set aside: one per non-empty selection, or the whole current
 * line (with its line break) for an empty one. Duplicate lines are merged.
 */
export function passagesToQuarantine(state: EditorState): Passage[] {
  const { doc } = state;
  const passages: Passage[] = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    if (!range.empty) {
      passages.push({
        from: range.from,
        to: range.to,
        text: doc.sliceString(range.from, range.to),
        line: doc.lineAt(range.from).number,
      });
      continue;
    }
    const line = doc.lineAt(range.head);
    if (seen.has(line.number) || line.length === 0) continue;
    seen.add(line.number);
    // Take the line break too, so no empty line is left behind.
    const from = line.to < doc.length ? line.from : Math.max(0, line.from - 1);
    const to = line.to < doc.length ? line.to + 1 : line.to;
    passages.push({ from, to, text: line.text, line: line.number });
  }
  return passages.sort((a, b) => a.from - b.from);
}
