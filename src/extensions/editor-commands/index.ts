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

/** CodeMirror commands exposed as app commands, so they can be rebound and listed. */
const COMMANDS: [id: string, title: string, run: EditorCommand][] = [
  ['editor.undo', 'Annuler', undo],
  ['editor.redo', 'Rétablir', redo],
  ['editor.selectAll', 'Tout sélectionner', selectAll],
  ['editor.duplicateLine', 'Dupliquer la ligne', copyLineDown],
  ['editor.moveLineUp', 'Déplacer la ligne vers le haut', moveLineUp],
  ['editor.moveLineDown', 'Déplacer la ligne vers le bas', moveLineDown],
  ['editor.deleteLine', 'Supprimer la ligne', deleteLine],
  ['editor.toggleComment', 'Commenter / décommenter', toggleComment],
  ['editor.addNextOccurrence', 'Ajouter l’occurrence suivante', selectNextOccurrence],
  ['search.find', 'Rechercher', openSearchPanel],
  ['search.replace', 'Remplacer', openSearchPanel],
];

export default defineExtension({
  id: 'cascades.editor-commands',
  activate(ctx) {
    for (const [id, title, run] of COMMANDS) {
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
