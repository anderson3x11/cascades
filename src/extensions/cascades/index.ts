import { defineExtension } from '../../api';
import { cascades, type CascadeStyle } from './render';

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
        enum: ['arrow', 'line', 'dotted', 'rounded'],
        description: 'Style des connecteurs.',
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

    const handle = ctx.editor.addExtension((tab) => {
      const get = <T>(key: string) => ctx.settings.get<T>(`cascades.${key}`, tab.language);
      if (!get<boolean>('enabled') || !get<string[]>('languages').includes(tab.language)) {
        return [];
      }
      return cascades({
        style: get<CascadeStyle>('style'),
        colorByDepth: get<boolean>('colorByDepth'),
        highlight: get<boolean>('highlight'),
        markdown: tab.language === 'markdown',
      });
    });

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('cascades.'))) handle.refresh();
    });
  },
});
