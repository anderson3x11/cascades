import { EditorSelection } from '@codemirror/state';
import { defineExtension } from '../../api';
import { formatDate } from './format';

/** Inserts today's date (and time, if the format asks for it) at each cursor. */
export default defineExtension({
  id: 'cascades.insert-date',
  activate(ctx) {
    ctx.settings.register('insertDate', {
      format: {
        type: 'string',
        default: 'DD/MM/YYYY',
        description:
          'Format de la date insérée : YYYY année, MM mois, MMMM mois en lettres, DD jour, dddd jour en lettres, HH:mm heure, [texte] tel quel. Exemple : "dddd D MMMM YYYY".',
      },
    });

    ctx.commands.register(
      'editor.insertDate',
      () => {
        const view = ctx.editor.view();
        if (!view) return;
        const tab = ctx.workspace.active();
        const text = formatDate(
          new Date(),
          ctx.settings.get<string>('insertDate.format', tab?.language),
        );
        view.dispatch(
          view.state.changeByRange((range) => ({
            changes: { from: range.from, to: range.to, insert: text },
            range: EditorSelection.cursor(range.from + text.length),
          })),
          { userEvent: 'input', scrollIntoView: true },
        );
        view.focus();
      },
      { title: 'Insérer la date', category: 'Édition' },
    );
    ctx.keybindings.register({ key: 'Ctrl+;', command: 'editor.insertDate', when: 'editorFocus' });
    ctx.menus.registerItem('edit', { command: 'editor.insertDate', group: '3_lines', order: 30 });
  },
});
