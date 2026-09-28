import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state';

/** What wraps a selection when each character is typed over it. */
const WRAPS: Record<string, string> = { '*': '*', _: '_', '`': '`', '~': '~~' };

/** Characters handled here, in Markdown. */
export const MARKDOWN_PAIR_CHARS = Object.keys(WRAPS);

const at = (state: EditorState, from: number, to: number) =>
  state.sliceDoc(Math.max(from, 0), Math.min(to, state.doc.length));

/**
 * Typing `text` in Markdown, or null to let it be typed as is:
 * - over a selection, * _ ` and ~ wrap it (and keep it selected, so ** is two presses);
 * - a second * makes a **bold** pair; ` makes a `code` pair, and ``` a fence;
 * - typing the closing character steps over it.
 */
export function markdownInput(state: EditorState, text: string): TransactionSpec | null {
  const wrap = WRAPS[text];
  if (wrap === undefined) return null;
  const ranges = state.selection.ranges;

  if (ranges.every((r) => !r.empty)) {
    return state.changeByRange((range) => ({
      changes: [
        { from: range.from, insert: wrap },
        { from: range.to, insert: wrap },
      ],
      range: EditorSelection.range(range.from + wrap.length, range.to + wrap.length),
    }));
  }
  if (ranges.length > 1 || !ranges[0]?.empty) return null;

  const pos = state.selection.main.head;
  const next = at(state, pos, pos + 1);
  const previous = at(state, pos - 1, pos);
  if (text === '*') {
    if (next === '*') return { selection: { anchor: pos + 1 }, userEvent: 'input.type' };
    // A lone * stays as is: it may be a list bullet or an italic.
    if (previous !== '*' || at(state, pos - 2, pos - 1) === '*') return null;
    return {
      changes: { from: pos, insert: '***' },
      selection: { anchor: pos + 1 },
      userEvent: 'input.type',
    };
  }
  if (text === '`') {
    if (next === '`') return { selection: { anchor: pos + 1 }, userEvent: 'input.type' };
    // Building a fence (```): no closing backtick.
    if (previous === '`') return null;
    return {
      changes: { from: pos, insert: '``' },
      selection: { anchor: pos + 1 },
      userEvent: 'input.type',
    };
  }
  return null;
}

/** Backspace between an empty pair (**|** or `|`) removes both halves, or null. */
export function deleteMarkdownPair(state: EditorState): TransactionSpec | null {
  const range = state.selection.main;
  if (state.selection.ranges.length > 1 || !range.empty) return null;
  const pos = range.head;
  for (const pair of ['**', '`']) {
    if (at(state, pos - pair.length, pos) === pair && at(state, pos, pos + pair.length) === pair) {
      return {
        changes: { from: pos - pair.length, to: pos + pair.length },
        userEvent: 'delete.backward',
      };
    }
  }
  return null;
}
