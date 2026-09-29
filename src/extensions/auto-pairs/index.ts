import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defineExtension, t } from '../../api';
import { deleteMarkdownPair, markdownInput } from './markdown';

/** Wrapping a selection in * _ ` ~, and in Markdown the **bold** and `code` pairs. */
const pairInput = (markdown: boolean) =>
  EditorView.inputHandler.of((view, _from, _to, text) => {
    const spec = markdownInput(view.state, text, markdown);
    if (!spec) return false;
    view.dispatch(spec);
    return true;
  });

/** Backspace between an empty **|** or `|` removes both halves. */
const markdownBackspace = Prec.high(
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
);

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
        description: t(
          'Close ( [ { " \' by themselves and, in Markdown, ** and `. Typing one of them, or * _ ` ~, over a selection wraps it.',
        ),
      },
    });

    const handle = ctx.editor.addExtension((tab) => {
      if (!ctx.settings.get<boolean>('autoPairs.enabled', tab.language)) return [];
      const markdown = tab.language === 'markdown';
      return [
        closeBrackets(),
        // Before the editor's own Backspace, so that "(|)" goes away in one press.
        Prec.high(keymap.of(closeBracketsKeymap)),
        pairInput(markdown),
        markdown ? markdownBackspace : [],
      ];
    });
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('autoPairs.enabled')) handle.refresh();
    });
  },
});
