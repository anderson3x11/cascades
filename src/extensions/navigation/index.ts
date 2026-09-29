import { cursorDocEnd, cursorDocStart } from '@codemirror/commands';
import { gotoLine } from '@codemirror/search';
import type { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { defineExtension, t, type KeybindingSpec } from '../../api';
import {
  bookmarkExtension,
  bookmarkedLines,
  goToBookmark,
  goToLine,
  toggleBookmarks,
} from './bookmarks';
import { deselectLine, selectLine, selectParagraph } from './select';

const select = (pick: (view: EditorView) => EditorSelection) => (view: EditorView) =>
  view.dispatch({ selection: pick(view), scrollIntoView: true, userEvent: 'select' });

interface Action {
  id: string;
  title: string;
  menu: 'edit' | 'go';
  group: string;
  keys?: string[];
  run(view: EditorView): void;
}

/** Quick selection, going to a place of the file, and bookmarks. */
export default defineExtension({
  id: 'cascades.navigation',
  activate(ctx) {
    ctx.editor.addExtension(() => bookmarkExtension);
    ctx.menus.registerMenu({ id: 'go', title: t('Go'), order: 27 });

    const listBookmarks = async (view: EditorView) => {
      const lines = bookmarkedLines(view.state);
      if (lines.length === 0) {
        ctx.banners.show({
          kind: 'info',
          message: t('No bookmark in this file. Ctrl+F2 sets one on the line of the cursor.'),
          actions: [{ label: t('OK'), run: () => {} }],
        });
        return;
      }
      const line = await ctx.quickPick.show(
        lines.map((n) => ({
          label: view.state.doc.line(n).text.trim() || t('(empty line)'),
          description: t('line {number}', { number: n }),
          value: n,
        })),
        { placeholder: t('Go to bookmark') },
      );
      if (line !== undefined) goToLine(view, line);
    };

    const actions: Action[] = [
      {
        id: 'navigation.selectLine',
        title: t('Select line'),
        menu: 'edit',
        group: '4_select',
        keys: ['Mod+L'],
        run: select((v) => selectLine(v.state)),
      },
      {
        id: 'navigation.deselectLine',
        title: t('Remove the last selected line'),
        menu: 'edit',
        group: '4_select',
        keys: ['Mod+Shift+L'],
        run: select((v) => deselectLine(v.state)),
      },
      {
        id: 'navigation.selectParagraph',
        title: t('Select the paragraph or cascade'),
        menu: 'edit',
        group: '4_select',
        keys: ['Leader L'],
        run: select((v) => selectParagraph(v.state)),
      },
      {
        id: 'navigation.goToLine',
        title: t('Go to line…'),
        menu: 'go',
        group: '1_place',
        keys: ['Mod+G'],
        run: (v) => void gotoLine(v),
      },
      {
        id: 'navigation.goToTop',
        title: t('Start of the file'),
        menu: 'go',
        group: '1_place',
        keys: ['Mod+Home'],
        run: (v) => void cursorDocStart(v),
      },
      {
        id: 'navigation.goToBottom',
        title: t('End of the file'),
        menu: 'go',
        group: '1_place',
        keys: ['Mod+End'],
        run: (v) => void cursorDocEnd(v),
      },
      {
        id: 'navigation.toggleBookmark',
        title: t('Set or remove a bookmark'),
        menu: 'go',
        group: '2_bookmarks',
        keys: ['Mod+F2'],
        run: toggleBookmarks,
      },
      {
        id: 'navigation.nextBookmark',
        title: t('Next bookmark'),
        menu: 'go',
        group: '2_bookmarks',
        keys: ['F2'],
        run: (v) => void goToBookmark(v, 1),
      },
      {
        id: 'navigation.previousBookmark',
        title: t('Previous bookmark'),
        menu: 'go',
        group: '2_bookmarks',
        keys: ['Shift+F2'],
        run: (v) => void goToBookmark(v, -1),
      },
      {
        id: 'navigation.listBookmarks',
        title: t('Bookmarks…'),
        menu: 'go',
        group: '2_bookmarks',
        run: (v) => void listBookmarks(v),
      },
    ];

    const keys: KeybindingSpec[] = [];
    for (const [order, action] of actions.entries()) {
      ctx.commands.register(
        action.id,
        () => {
          const view = ctx.editor.view();
          if (view) action.run(view);
        },
        { title: action.title, category: action.menu === 'go' ? t('Go') : t('Edit') },
      );
      ctx.menus.registerItem(action.menu, { command: action.id, group: action.group, order });
      for (const key of action.keys ?? [])
        keys.push({ key, command: action.id, when: 'editorFocus' });
    }
    ctx.keybindings.register(keys);
  },
});
