import { EditorView } from '@codemirror/view';
import { defineExtension } from '../../api';

/**
 * Spell checking by the system (the webview's checker, which uses Windows'
 * dictionaries): mistakes underlined, suggestions on right-click. Off by
 * default; F7 turns it on and off, and the choice is kept.
 */
export default defineExtension({
  id: 'cascades.spellcheck',
  activate(ctx) {
    ctx.settings.register('spellcheck', {
      enabled: {
        type: 'boolean',
        default: false,
        description: 'Souligner les fautes d’orthographe (F7 pour activer ou désactiver).',
      },
      language: {
        type: 'string',
        default: 'fr',
        description:
          'Langue du correcteur : "fr", "en", "es"… (dictionnaires installés dans Windows).',
      },
    });

    const enabled = () => ctx.settings.get<boolean>('spellcheck.enabled');
    const handle = ctx.editor.addExtension((tab) =>
      enabled() && !tab.viewer
        ? EditorView.contentAttributes.of({
            spellcheck: 'true',
            lang: ctx.settings.get<string>('spellcheck.language', tab.language),
          })
        : EditorView.contentAttributes.of({ spellcheck: 'false' }),
    );

    const status = ctx.statusBar.addItem({
      id: 'spellcheck',
      alignment: 'right',
      priority: 40,
      command: 'editor.toggleSpellcheck',
    });
    status.text = 'Orthographe';
    status.tooltip = 'Correcteur orthographique actif (F7 pour le désactiver)';
    const show = () => (status.visible = enabled());
    show();

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('spellcheck.'))) {
        handle.refresh();
        show();
      }
    });

    ctx.commands.register(
      'editor.toggleSpellcheck',
      () => ctx.settings.update('spellcheck.enabled', enabled() ? undefined : true),
      { title: 'Activer ou désactiver le correcteur orthographique', category: 'Texte' },
    );
    ctx.keybindings.register({ key: 'F7', command: 'editor.toggleSpellcheck' });
    ctx.menus.registerItem('text', {
      command: 'editor.toggleSpellcheck',
      group: '3_spelling',
      order: 0,
    });
  },
});
