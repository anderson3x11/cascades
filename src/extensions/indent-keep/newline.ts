import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state';

/**
 * Enter that copies the exact leading whitespace (tabs stay tabs) of the
 * current line. If the cursor sits inside the indentation, only the part
 * before the cursor is kept.
 */
export function newlineKeepingIndent(state: EditorState): TransactionSpec {
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const leading = /^[ \t]*/.exec(line.text)?.[0] ?? '';
    const indent = leading.slice(0, range.from - line.from);
    const insert = '\n' + indent;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length),
    };
  });
  return { ...changes, scrollIntoView: true, userEvent: 'input' };
}
