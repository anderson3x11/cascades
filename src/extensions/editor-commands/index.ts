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
import { defineExtension, type EditorView } from '../../api';

type EditorCommand = (view: EditorView) => boolean;

/**
 * CodeMirror commands exposed as app commands, so they can be rebound and
 * listed, with their place in the Édition menu.
 */
const COMMANDS: [id: string, title: string, run: EditorCommand, menuGroup: string][] = [
  ['editor.undo', 'Annuler', undo, '1_history'],
  ['editor.redo', 'Rétablir', redo, '1_history'],
  ['search.find', 'Rechercher', openSearchPanel, '2_find'],
  ['search.replace', 'Remplacer', openSearchPanel, '2_find'],
  ['editor.duplicateLine', 'Dupliquer la ligne', copyLineDown, '3_lines'],
  ['editor.moveLineUp', 'Déplacer la ligne vers le haut', moveLineUp, '3_lines'],
  ['editor.moveLineDown', 'Déplacer la ligne vers le bas', moveLineDown, '3_lines'],
  ['editor.deleteLine', 'Supprimer la ligne', deleteLine, '3_lines'],
  ['editor.toggleComment', 'Commenter / décommenter', toggleComment, '3_lines'],
  ['editor.selectAll', 'Tout sélectionner', selectAll, '4_select'],
  ['editor.addNextOccurrence', 'Ajouter l’occurrence suivante', selectNextOccurrence, '4_select'],
];

export default defineExtension({
  id: 'cascades.editor-commands',
  activate(ctx) {
    ctx.menus.registerMenu({ id: 'edit', title: 'Édition', order: 20 });
    for (const [order, [id, title, run, group]] of COMMANDS.entries()) {
      ctx.menus.registerItem('edit', { command: id, group, order });
      ctx.commands.register(
        id,
        () => {
          const view = ctx.editor.view();
          if (!view) return false;
          view.focus();
          return run(view);
        },
        { title, category: 'Éditeur' },
      );
    }
  },
});
