import { EditorSelection, type EditorState, type Text } from '@codemirror/state';

/**
 * Ctrl+L: each selection grows to whole lines, then one more line on each
 * press. The selection ends at the start of the next line, so that it takes
 * the line breaks too.
 */
export function selectLine(state: EditorState): EditorSelection {
  const { doc } = state;
  return EditorSelection.create(
    state.selection.ranges.map((range) => {
      const first = doc.lineAt(range.from);
      const end = doc.lineAt(range.to);
      const whole = range.from === first.from && range.to === end.from && range.to > range.from;
      // Already whole lines: take the next one; otherwise the lines it touches.
      const last = whole ? end : doc.lineAt(range.to);
      const to = last.number < doc.lines ? doc.line(last.number + 1).from : doc.length;
      return EditorSelection.range(first.from, to);
    }),
    state.selection.mainIndex,
  );
}

/** Ctrl+Shift+L: the last line added by Ctrl+L goes; a single line stays selected. */
export function deselectLine(state: EditorState): EditorSelection {
  const { doc } = state;
  return EditorSelection.create(
    state.selection.ranges.map((range) => {
      if (range.empty) return range;
      const first = doc.lineAt(range.from);
      // The selection ends at a line start (after its line break) or at the document end.
      const endLine =
        range.to === doc.length && doc.lineAt(range.to).from !== range.to
          ? doc.lineAt(range.to).number + 1
          : doc.lineAt(range.to).number;
      const lines = endLine - first.number;
      if (lines <= 1) return range;
      return EditorSelection.range(first.from, doc.line(endLine - 1).from);
    }),
    state.selection.mainIndex,
  );
}

const indentOf = (text: string) => /^[\t ]*/.exec(text)?.[0].replace(/\t/g, '    ').length ?? 0;
const blank = (doc: Text, n: number) => doc.line(n).text.trim() === '';

/** Lines (first, last) of the block between blank lines around `line`. */
export function paragraphLines(doc: Text, line: number): [number, number] {
  let first = line;
  let last = line;
  while (first > 1 && !blank(doc, first - 1)) first--;
  while (last < doc.lines && !blank(doc, last + 1)) last++;
  return [first, last];
}

/**
 * Lines of the cascade around `line`: its root (the closest line above
 * without indentation) and every line below it that is indented, blank lines
 * inside included. Null when the line belongs to no cascade.
 */
export function cascadeLines(doc: Text, line: number): [number, number] | null {
  let root = line;
  while (root > 1 && (blank(doc, root) || indentOf(doc.line(root).text) > 0)) root--;
  if (indentOf(doc.line(root).text) > 0 || blank(doc, root)) return null;
  let last = root;
  for (let n = root + 1; n <= doc.lines; n++) {
    if (blank(doc, n)) continue;
    if (indentOf(doc.line(n).text) === 0) break;
    last = n;
  }
  return last > root ? [root, last] : null;
}

/**
 * Selects the cascade the cursor is in, or its paragraph; pressed again, the
 * paragraph (when larger than the cascade).
 */
export function selectParagraph(state: EditorState): EditorSelection {
  const { doc } = state;
  const range = state.selection.main;
  const line = doc.lineAt(range.head).number;
  const toRange = ([first, last]: [number, number]) =>
    EditorSelection.range(doc.line(first).from, doc.line(last).to);
  const paragraph = toRange(paragraphLines(doc, line));
  const cascade = cascadeLines(doc, line);
  const target =
    cascade && !(range.from === doc.line(cascade[0]).from && range.to === doc.line(cascade[1]).to)
      ? toRange(cascade)
      : paragraph;
  return EditorSelection.create([target]);
}
