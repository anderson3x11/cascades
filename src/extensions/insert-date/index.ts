import { EditorSelection } from '@codemirror/state';
import { defineExtension, t } from '../../api';
import { formatDate } from './format';

/** Inserts today's date (and time, if the format asks for it) at each cursor. */
export default defineExtension({
  id: 'cascades.insert-date',
  activate(ctx) {
    ctx.settings.register('insertDate', {
      format: {
        type: 'string',
        default: 'DD/MM/YYYY',
        description: t(
          'Format of the inserted date: YYYY year, MM month, MMMM month name, DD day, dddd day name, HH:mm time, [text] as is. Example: "dddd D MMMM YYYY".',
        ),
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
          ctx.i18n.language(),
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
      { title: t('Insert the date'), category: t('Edit') },
    );
    ctx.keybindings.register({ key: 'Mod+;', command: 'editor.insertDate', when: 'editorFocus' });
    ctx.menus.registerItem('edit', { command: 'editor.insertDate', group: '3_lines', order: 30 });
  },
});
