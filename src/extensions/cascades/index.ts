import { defineExtension } from '../../api';
import { CASCADE_STYLES, cascades, type CascadeStyle } from './render';

const STYLE_NAMES: Record<CascadeStyle, string> = {
  arrow: 'Flèches',
  rounded: 'Coins arrondis',
  curved: 'Courbes',
  bullet: 'Points',
  line: 'Traits simples',
  dashed: 'Tirets',
  dotted: 'Pointillés',
  guides: 'Guides verticaux seulement',
};

/** Visual connectors between indented lines and their parent line. */
export default defineExtension({
  id: 'cascades.cascades',
  activate(ctx) {
    ctx.settings.register('cascades', {
      enabled: {
        type: 'boolean',
        default: true,
        description: 'Dessiner les connecteurs de cascade.',
      },
      languages: {
        type: 'array',
        default: ['plaintext', 'markdown'],
        description:
          'Langages où les cascades sont actives (plaintext couvre .txt et sans extension).',
      },
      style: {
        type: 'string',
        default: 'arrow',
        enum: CASCADE_STYLES,
        description: `Style des connecteurs : ${CASCADE_STYLES.join(', ')}.`,
      },
      lineWidth: {
        type: 'number',
        default: 1.2,
        description: 'Épaisseur des traits (px).',
      },
      colorByDepth: {
        type: 'boolean',
        default: true,
        description: 'Une couleur différente par niveau de profondeur.',
      },
      highlight: {
        type: 'boolean',
        default: true,
        description: 'Mettre en valeur la branche et le parent de la ligne active ou survolée.',
      },
    });

    /** Style shown while the style picker previews one. */
    let preview: CascadeStyle | null = null;

    const handle = ctx.editor.addExtension((tab) => {
      const get = <T>(key: string) => ctx.settings.get<T>(`cascades.${key}`, tab.language);
      if (!get<boolean>('enabled') || !get<string[]>('languages').includes(tab.language)) {
        return [];
      }
      return cascades({
        style: preview ?? get<CascadeStyle>('style'),
        lineWidth: get<number>('lineWidth'),
        colorByDepth: get<boolean>('colorByDepth'),
        highlight: get<boolean>('highlight'),
        markdown: tab.language === 'markdown',
      });
    });

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('cascades.'))) handle.refresh();
    });

    const save = async (key: string, value: unknown) => {
      try {
        await ctx.settings.update(key, value);
      } catch (err) {
        ctx.banners.show({
          kind: 'warning',
          message: err instanceof Error ? err.message : String(err),
          actions: [{ label: 'OK', run: () => {} }],
        });
      }
    };

    ctx.commands.register(
      'cascades.toggle',
      () =>
        save('cascades.enabled', ctx.settings.get<boolean>('cascades.enabled') ? false : undefined),
      { title: 'Afficher ou masquer les cascades', category: 'Affichage' },
    );

    ctx.commands.register(
      'cascades.selectStyle',
      async () => {
        const current = ctx.settings.get<CascadeStyle>('cascades.style');
        const chosen = await ctx.quickPick.show(
          CASCADE_STYLES.map((style) => ({
            label: STYLE_NAMES[style],
            description: style,
            value: style,
          })),
          {
            placeholder: 'Style des cascades',
            activeValue: current,
            onHighlight: (item) => {
              preview = item.value;
              handle.refresh();
            },
          },
        );
        preview = null;
        handle.refresh();
        if (chosen === undefined) return;
        if (!ctx.settings.get<boolean>('cascades.enabled'))
          await save('cascades.enabled', undefined);
        await save('cascades.style', chosen === 'arrow' ? undefined : chosen);
      },
      { title: 'Style des cascades…', category: 'Affichage' },
    );

    ctx.keybindings.register({ key: 'Leader C', command: 'cascades.toggle' });
    ctx.menus.registerItem('view', { command: 'cascades.toggle', group: '2_appearance', order: 2 });
    ctx.menus.registerItem('view', {
      command: 'cascades.selectStyle',
      group: '2_appearance',
      order: 3,
    });
  },
});
