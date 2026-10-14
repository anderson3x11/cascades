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
    ctx.menus.registerGroup('edit', {
      id: '1_history',
      title: t('Undo and redo'),
      icon: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11',
    });
    ctx.menus.registerGroup('edit', {
      id: '2_find',
      title: t('Find'),
      icon: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3',
    });
    ctx.menus.registerGroup('edit', {
      id: '3_lines',
      title: t('Lines'),
      icon: 'M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13',
    });
    ctx.menus.registerGroup('edit', {
      id: '4_select',
      title: t('Selection'),
      icon: 'M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1M7 22h1a4 4 0 0 0 4-4v-1M7 2h1a4 4 0 0 1 4 4v1',
    });
    ctx.menus.registerGroup('edit', {
      id: '5_quarantine',
      title: t('Quarantine'),
      icon: 'M3 3h18v5H3zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4',
    });
    ctx.panels.register({
      id: 'edit',
      title: t('Edit'),
      side: 'left',
      icon: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4',
      order: 20,
      menus: ['edit'],
    });
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
