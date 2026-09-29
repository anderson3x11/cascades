import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state';
import { defineExtension, type KeybindingSpec } from '../../api';
import {
  joinLines,
  lowerCase,
  removeDuplicateLines,
  sentenceCase,
  sortLines,
  titleCase,
  trimTrailingWhitespace,
  upperCase,
} from './text';

/** Each selection (or the word at the cursor) transformed, and still selected. */
export function changeCase(
  state: EditorState,
  transform: (text: string) => string,
): TransactionSpec {
  return state.changeByRange((range) => {
    const word = range.empty ? state.wordAt(range.head) : range;
    if (!word) return { range };
    const insert = transform(state.sliceDoc(word.from, word.to));
    return {
      changes: { from: word.from, to: word.to, insert },
      range: EditorSelection.range(word.from, word.from + insert.length),
    };
  });
}

/**
 * The whole lines of each selection transformed as a block, then selected.
 * Without a selection: the whole document, or (`nextLine`) the line and the next one.
 */
export function changeLines(
  state: EditorState,
  transform: (lines: string[]) => string[],
  withoutSelection: 'document' | 'nextLine',
): TransactionSpec {
  const { doc } = state;
  const ranges = state.selection.ranges;
  // Nothing selected: the whole document, as one selection (several cursors
  // would each take the whole document). Only the selection differs, so the
  // changes still apply to `state`.
  const base =
    withoutSelection === 'document' && ranges.every((r) => r.empty)
      ? state.update({ selection: EditorSelection.single(0, doc.length) }).state
      : state;
  return base.changeByRange((range) => {
    const first = doc.lineAt(range.from).number;
    let last = doc.lineAt(range.to).number;
    if (range.empty && withoutSelection === 'nextLine') last = Math.min(first + 1, doc.lines);
    // A selection ending at the very start of a line does not take that line.
    if (!range.empty && last > first && range.to === doc.line(last).from) last--;
    const from = doc.line(first).from;
    const to = doc.line(last).to;
    const lines: string[] = [];
    for (let n = first; n <= last; n++) lines.push(doc.line(n).text);
    const insert = transform(lines).join('\n');
    return {
      changes: { from, to, insert },
      range: EditorSelection.range(from, from + insert.length),
    };
  });
}

interface Tool {
  id: string;
  title: string;
  group: '1_case' | '2_lines';
  keys?: string[];
  run(state: EditorState): TransactionSpec;
}

const TOOLS: Tool[] = [
  {
    id: 'text.upperCase',
    title: 'MAJUSCULES',
    group: '1_case',
    keys: ['Ctrl+Shift+U'],
    run: (s) => changeCase(s, upperCase),
  },
  {
    id: 'text.lowerCase',
    title: 'minuscules',
    group: '1_case',
    keys: ['Ctrl+U'],
    run: (s) => changeCase(s, lowerCase),
  },
  {
    id: 'text.titleCase',
    title: 'Majuscule À Chaque Mot',
    group: '1_case',
    keys: ['Leader U'],
    run: (s) => changeCase(s, titleCase),
  },
  {
    id: 'text.sentenceCase',
    title: 'Majuscule en début de phrase',
    group: '1_case',
    keys: ['Leader Shift+U'],
    run: (s) => changeCase(s, sentenceCase),
  },
  {
    id: 'text.sortLines',
    title: 'Trier les lignes (A à Z)',
    group: '2_lines',
    run: (s) => changeLines(s, (l) => sortLines(l), 'document'),
  },
  {
    id: 'text.sortLinesDescending',
    title: 'Trier les lignes (Z à A)',
    group: '2_lines',
    run: (s) => changeLines(s, (l) => sortLines(l, true), 'document'),
  },
  {
    id: 'text.removeDuplicateLines',
    title: 'Supprimer les lignes en double',
    group: '2_lines',
    run: (s) => changeLines(s, removeDuplicateLines, 'document'),
  },
  {
    id: 'text.trimTrailingWhitespace',
    title: 'Supprimer les espaces en fin de ligne',
    group: '2_lines',
    run: (s) => changeLines(s, trimTrailingWhitespace, 'document'),
  },
  {
    id: 'text.joinLines',
    title: 'Joindre les lignes',
    group: '2_lines',
    run: (s) => changeLines(s, joinLines, 'nextLine'),
  },
];

/** Case and line tools, in a Texte menu. Without a selection, case applies to the word at the cursor. */
export default defineExtension({
  id: 'cascades.text-tools',
  activate(ctx) {
    ctx.menus.registerMenu({ id: 'text', title: 'Texte', order: 25 });
    const keys: KeybindingSpec[] = [];
    for (const [order, tool] of TOOLS.entries()) {
      ctx.commands.register(
        tool.id,
        () => {
          const view = ctx.editor.view();
          if (!view) return;
          view.dispatch(tool.run(view.state), { userEvent: 'input', scrollIntoView: true });
          view.focus();
        },
        { title: tool.title, category: 'Texte' },
      );
      ctx.menus.registerItem('text', { command: tool.id, group: tool.group, order });
      for (const key of tool.keys ?? []) keys.push({ key, command: tool.id, when: 'editorFocus' });
    }
    ctx.keybindings.register(keys);
  },
});
