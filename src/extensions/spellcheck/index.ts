import { defineExtension } from '../../api';
import { spellChecker, SpellState } from './checker';
import { languageChoices } from './languages';

/**
 * Spell checking with the system's dictionaries (on Windows, those of Word
 * and Edge): mistakes underlined, corrections on right-click. Off by default;
 * F7 turns it on and off, and the choice is kept.
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
    const shared = new SpellState();
    const handle = ctx.editor.addExtension((tab) =>
      enabled() && !tab.viewer
        ? spellChecker(
            ctx,
            shared,
            () => ctx.settings.get<string>('spellcheck.language', tab.language),
            (message) =>
              ctx.banners.show({
                kind: 'warning',
                message: `Correcteur orthographique indisponible : ${message}.`,
                actions: [{ label: 'OK', run: () => {} }],
              }),
          )
        : [],
    );

    const status = ctx.statusBar.addItem({
      id: 'spellcheck',
      alignment: 'right',
      priority: 40,
      command: 'editor.chooseSpellLanguage',
    });
    status.text = 'Orthographe';
    status.tooltip = 'Correcteur orthographique actif : changer de langue ou le désactiver';
    const show = () => (status.visible = enabled());
    show();

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('spellcheck.'))) {
        // Turning it on again, or another language, is a new try.
        shared.failure = null;
        shared.forget();
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

    ctx.commands.register(
      'editor.chooseSpellLanguage',
      async () => {
        const installed = await ctx.spelling.languages().catch(() => [] as string[]);
        const current = ctx.settings
          .get<string>('spellcheck.language')
          .split('-')[0]
          ?.toLowerCase();
        const choice = await ctx.quickPick.show<string | null>(
          [
            { label: 'Désactiver le correcteur', description: 'F7', value: null },
            ...languageChoices(installed).map(({ tag, label }) => ({
              label,
              description: tag === current ? 'actuelle' : '',
              value: tag,
            })),
          ],
          { placeholder: 'Langue du correcteur orthographique' },
        );
        if (choice === undefined) return;
        if (choice === null) await ctx.settings.update('spellcheck.enabled', undefined);
        else {
          await ctx.settings.update('spellcheck.language', choice);
          if (!enabled()) await ctx.settings.update('spellcheck.enabled', true);
        }
      },
      { title: 'Langue du correcteur orthographique…', category: 'Texte' },
    );
    ctx.menus.registerItem('text', {
      command: 'editor.chooseSpellLanguage',
      group: '3_spelling',
      order: 1,
    });
    ctx.menus.registerItem('text', {
      command: 'editor.toggleSpellcheck',
      group: '3_spelling',
      order: 0,
    });
  },
});
