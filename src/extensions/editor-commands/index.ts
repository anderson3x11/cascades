import {
  copyLineDown,
  deleteLine,
  moveLineDown,
  moveLineUp,
  redo,
  selectAll,
  toggleComment,
  undo,
} from '@codemirror/commands';
import { openSearchPanel, selectNextOccurrence } from '@codemirror/search';
import { defineExtension, t, type EditorView } from '../../api';
import { findCount } from './find-count';

type EditorCommand = (view: EditorView) => boolean;

/**
 * CodeMirror commands exposed as app commands, so they can be rebound and
 * listed, with their place in the Edit menu.
 */
const commands = (): [id: string, title: string, run: EditorCommand, menuGroup: string][] => [
  ['editor.undo', t('Undo'), undo, '1_history'],
  ['editor.redo', t('Redo'), redo, '1_history'],
  ['search.find', t('Find'), openSearchPanel, '2_find'],
  ['search.replace', t('Replace'), openSearchPanel, '2_find'],
  ['editor.duplicateLine', t('Duplicate line'), copyLineDown, '3_lines'],
  ['editor.moveLineUp', t('Move line up'), moveLineUp, '3_lines'],
  ['editor.moveLineDown', t('Move line down'), moveLineDown, '3_lines'],
  ['editor.deleteLine', t('Delete line'), deleteLine, '3_lines'],
  ['editor.toggleComment', t('Comment / uncomment'), toggleComment, '3_lines'],
  ['editor.selectAll', t('Select all'), selectAll, '4_select'],
  ['editor.addNextOccurrence', t('Add next occurrence'), selectNextOccurrence, '4_select'],
];

export default defineExtension({
  id: 'cascades.editor-commands',
  activate(ctx) {
    ctx.menus.registerMenu({ id: 'edit', title: t('Edit'), order: 20 });
    ctx.editor.addExtension(() => findCount);
    for (const [order, [id, title, run, group]] of commands().entries()) {
      ctx.menus.registerItem('edit', { command: id, group, order });
      ctx.commands.register(
        id,
        () => {
          const view = ctx.editor.view();
          if (!view) return false;
          view.focus();
          return run(view);
        },
        { title, category: t('Editor') },
      );
    }
  },
});
