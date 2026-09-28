import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { defineExtension } from '../../api';
import { newlineKeepingIndent } from './newline';

export default defineExtension({
  id: 'cascades.indent-keep',
  activate(ctx) {
    ctx.settings.register('indentKeep', {
      enabled: {
        type: 'boolean',
        default: true,
        description: 'Entrée garde l’indentation exacte de la ligne courante.',
      },
    });

    const handle = ctx.editor.addExtension((tab) =>
      ctx.settings.get<boolean>('indentKeep.enabled', tab.language)
        ? Prec.high(
            keymap.of([
              {
                key: 'Enter',
                run: (view) => {
                  view.dispatch(newlineKeepingIndent(view.state));
                  return true;
                },
              },
            ]),
          )
        : [],
    );

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('indentKeep.enabled')) handle.refresh();
    });
  },
});
