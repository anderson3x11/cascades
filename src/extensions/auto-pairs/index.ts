import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defineExtension } from '../../api';
import { deleteMarkdownPair, markdownInput } from './markdown';

/** Markdown pairs: **bold**, `code`, and wrapping a selection in * _ ` ~. */
const markdownPairs = [
  EditorView.inputHandler.of((view, _from, _to, text) => {
    const spec = markdownInput(view.state, text);
    if (!spec) return false;
    view.dispatch(spec);
    return true;
  }),
  Prec.high(
    keymap.of([
      {
        key: 'Backspace',
        run: (view) => {
          const spec = deleteMarkdownPair(view.state);
          if (!spec) return false;
          view.dispatch(spec);
          return true;
        },
      },
    ]),
  ),
];

/**
 * Closing pairs: ( [ { " ' are closed as they are typed and wrap a selection;
 * an apostrophe after a letter ("l'été") stays alone.
 */
export default defineExtension({
  id: 'cascades.auto-pairs',
  activate(ctx) {
    ctx.settings.register('autoPairs', {
      enabled: {
        type: 'boolean',
        default: true,
        description:
          'Fermer automatiquement ( [ { " \' et, en Markdown, ** et `. Taper un de ces caractères sur une sélection l’entoure.',
      },
    });

    const handle = ctx.editor.addExtension((tab) => {
      if (!ctx.settings.get<boolean>('autoPairs.enabled', tab.language)) return [];
      return [
        closeBrackets(),
        keymap.of(closeBracketsKeymap),
        tab.language === 'markdown' ? markdownPairs : [],
      ];
    });
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('autoPairs.enabled')) handle.refresh();
    });
  },
});
