import { Prec, type EditorState, type TransactionSpec } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { defineExtension } from '../../api';
import { cellAt, cellRange, findTable, formatTable, moveInTable } from './table';

/**
 * The table under the cursor, aligned, with the cursor moved by `direction`
 * cells (0: stays in its cell), or null outside a table.
 */
function tableEdit(state: EditorState, direction: -1 | 0 | 1): TransactionSpec | null {
  if (state.selection.ranges.length > 1) return null;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  // The lines around the cursor that could belong to the table.
  let firstNo = line.number;
  let lastNo = line.number;
  const isRow = (n: number) => state.doc.line(n).text.includes('|');
  if (!isRow(line.number)) return null;
  while (firstNo > 1 && isRow(firstNo - 1)) firstNo--;
  while (lastNo < state.doc.lines && isRow(lastNo + 1)) lastNo++;
  const lines: string[] = [];
  for (let n = firstNo; n <= lastNo; n++) lines.push(state.doc.line(n).text);

  const table = findTable(lines, line.number - firstNo);
  if (!table) return null;
  const row = line.number - firstNo - table.first;
  const cell = cellAt(line.text, pos - line.from);
  const move =
    direction === 0
      ? { lines: formatTable(table), row, cell }
      : moveInTable(table, row, cell, direction);

  const from = state.doc.line(firstNo + table.first).from;
  const to = state.doc.line(firstNo + table.last).to;
  const rowStart = move.lines.slice(0, move.row).reduce((n, l) => n + l.length + 1, 0);
  const target = cellRange(move.lines[move.row] as string, move.cell);
  return {
    changes: { from, to, insert: move.lines.join('\n') },
    selection: { anchor: from + rowStart + target.from, head: from + rowStart + target.to },
    scrollIntoView: true,
    userEvent: 'input',
  };
}

const run = (direction: -1 | 0 | 1) => (view: EditorView) => {
  const spec = tableEdit(view.state, direction);
  if (!spec) return false;
  view.dispatch(spec);
  return true;
};

/** Tab and Shift+Tab move between cells, aligning the table as they go. */
const tableKeys = Prec.highest(keymap.of([{ key: 'Tab', run: run(1), shift: run(-1) }]));

export default defineExtension({
  id: 'cascades.markdown-tables',
  activate(ctx) {
    ctx.settings.register('markdownTables', {
      enabled: {
        type: 'boolean',
        default: true,
        description:
          'Dans un tableau Markdown, Tab et Shift+Tab passent d’une cellule à l’autre en alignant les colonnes.',
      },
    });

    const handle = ctx.editor.addExtension((tab) =>
      tab.language === 'markdown' &&
      ctx.settings.get<boolean>('markdownTables.enabled', tab.language)
        ? tableKeys
        : [],
    );
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('markdownTables.enabled')) handle.refresh();
    });

    ctx.commands.register(
      'markdown.alignTable',
      () => {
        const view = ctx.editor.view();
        if (view && !run(0)(view)) {
          ctx.banners.show({
            kind: 'info',
            message: 'Place le curseur dans un tableau Markdown pour l’aligner.',
            actions: [{ label: 'OK', run: () => {} }],
          });
        }
      },
      { title: 'Aligner le tableau', category: 'Édition' },
    );
    ctx.menus.registerItem('edit', { command: 'markdown.alignTable', group: '3_lines', order: 31 });

    ctx.commands.register(
      'markdown.insertTable',
      () => {
        const view = ctx.editor.view();
        if (!view) return;
        const { state } = view;
        const pos = state.selection.main.head;
        const line = state.doc.lineAt(pos);
        // On its own lines, with the first header selected, ready to be typed over.
        const empty = line.text.trim() === '';
        const before = empty ? '' : '\n\n';
        const table = formatTable({
          first: 0,
          last: 2,
          rows: [
            ['Colonne 1', 'Colonne 2'],
            ['---', '---'],
            ['', ''],
          ],
          aligns: ['none', 'none'],
        }).join('\n');
        const from = empty ? line.from : line.to;
        const start = from + before.length + 2;
        view.dispatch({
          changes: { from, to: line.to, insert: before + table },
          selection: { anchor: start, head: start + 'Colonne 1'.length },
          scrollIntoView: true,
          userEvent: 'input',
        });
        view.focus();
      },
      { title: 'Insérer un tableau', category: 'Édition' },
    );
    ctx.menus.registerItem('edit', {
      command: 'markdown.insertTable',
      group: '3_lines',
      order: 32,
    });
  },
});
