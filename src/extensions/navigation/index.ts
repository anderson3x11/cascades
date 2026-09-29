import { cursorDocEnd, cursorDocStart } from '@codemirror/commands';
import { gotoLine } from '@codemirror/search';
import type { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { defineExtension, type KeybindingSpec } from '../../api';
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
    ctx.menus.registerMenu({ id: 'go', title: 'Aller', order: 27 });

    const listBookmarks = async (view: EditorView) => {
      const lines = bookmarkedLines(view.state);
      if (lines.length === 0) {
        ctx.banners.show({
          kind: 'info',
          message: 'Aucun signet dans ce fichier. Ctrl+F2 en pose un sur la ligne du curseur.',
          actions: [{ label: 'OK', run: () => {} }],
        });
        return;
      }
      const line = await ctx.quickPick.show(
        lines.map((n) => ({
          label: view.state.doc.line(n).text.trim() || '(ligne vide)',
          description: `ligne ${n}`,
          value: n,
        })),
        { placeholder: 'Aller au signet' },
      );
      if (line !== undefined) goToLine(view, line);
    };

    const actions: Action[] = [
      {
        id: 'navigation.selectLine',
        title: 'Sélectionner la ligne',
        menu: 'edit',
        group: '4_select',
        keys: ['Ctrl+L'],
        run: select((v) => selectLine(v.state)),
      },
      {
        id: 'navigation.deselectLine',
        title: 'Retirer la dernière ligne sélectionnée',
        menu: 'edit',
        group: '4_select',
        keys: ['Ctrl+Shift+L'],
        run: select((v) => deselectLine(v.state)),
      },
      {
        id: 'navigation.selectParagraph',
        title: 'Sélectionner le paragraphe ou la cascade',
        menu: 'edit',
        group: '4_select',
        keys: ['Leader L'],
        run: select((v) => selectParagraph(v.state)),
      },
      {
        id: 'navigation.goToLine',
        title: 'Aller à la ligne…',
        menu: 'go',
        group: '1_place',
        keys: ['Ctrl+G'],
        run: (v) => void gotoLine(v),
      },
      {
        id: 'navigation.goToTop',
        title: 'Début du fichier',
        menu: 'go',
        group: '1_place',
        keys: ['Ctrl+Home'],
        run: (v) => void cursorDocStart(v),
      },
      {
        id: 'navigation.goToBottom',
        title: 'Fin du fichier',
        menu: 'go',
        group: '1_place',
        keys: ['Ctrl+End'],
        run: (v) => void cursorDocEnd(v),
      },
      {
        id: 'navigation.toggleBookmark',
        title: 'Poser ou retirer un signet',
        menu: 'go',
        group: '2_bookmarks',
        keys: ['Ctrl+F2'],
        run: toggleBookmarks,
      },
      {
        id: 'navigation.nextBookmark',
        title: 'Signet suivant',
        menu: 'go',
        group: '2_bookmarks',
        keys: ['F2'],
        run: (v) => void goToBookmark(v, 1),
      },
      {
        id: 'navigation.previousBookmark',
        title: 'Signet précédent',
        menu: 'go',
        group: '2_bookmarks',
        keys: ['Shift+F2'],
        run: (v) => void goToBookmark(v, -1),
      },
      {
        id: 'navigation.listBookmarks',
        title: 'Signets…',
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
        { title: action.title, category: action.menu === 'go' ? 'Aller' : 'Édition' },
      );
      ctx.menus.registerItem(action.menu, { command: action.id, group: action.group, order });
      for (const key of action.keys ?? [])
        keys.push({ key, command: action.id, when: 'editorFocus' });
    }
    ctx.keybindings.register(keys);
  },
});
