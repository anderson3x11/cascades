import { EditorView } from '@codemirror/view';
import { defineExtension, type LayoutPart } from '../../api';

/** Each part can be toggled from the keyboard too, so a hidden menu bar can come back. */
const PARTS: [LayoutPart, setting: string, title: string, key: string][] = [
  ['menuBar', 'showMenuBar', 'la barre de menus', 'Leader M'],
  ['tabs', 'showTabs', 'les onglets', 'Leader Tab'],
  ['statusBar', 'showStatusBar', 'la barre d’état', 'Leader B'],
];

/** Visible parts of the window, interface font, and zen mode. */
export default defineExtension({
  id: 'cascades.layout',
  activate(ctx) {
    ctx.settings.register('workbench', {
      showMenuBar: { type: 'boolean', default: true, description: 'Afficher la barre de menus.' },
      showTabs: { type: 'boolean', default: true, description: 'Afficher les onglets.' },
      showStatusBar: { type: 'boolean', default: true, description: 'Afficher la barre d’état.' },
      fontFamily: {
        type: 'string',
        default: "system-ui, 'Segoe UI', sans-serif",
        description: 'Police de l’interface (menus, onglets, barre d’état).',
      },
      fontSize: {
        type: 'number',
        default: 13,
        description: 'Taille de police de l’interface (px).',
      },
    });
    ctx.settings.register('zen', {
      width: {
        type: 'number',
        default: 80,
        description: 'Largeur de la colonne de texte en mode zen, en caractères.',
      },
    });

    const apply = () => {
      for (const [part, setting] of PARTS) {
        ctx.layout.setVisible(part, ctx.settings.get<boolean>(`workbench.${setting}`));
      }
      ctx.layout.setStyle('font-ui', ctx.settings.get<string>('workbench.fontFamily'));
      ctx.layout.setStyle('font-ui-size', `${ctx.settings.get<number>('workbench.fontSize')}px`);
      ctx.layout.setStyle('zen-width', `${ctx.settings.get<number>('zen.width')}ch`);
    };
    apply();
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('workbench.') || k.startsWith('zen.'))) apply();
    });

    // In zen mode long lines wrap inside the centered column.
    const wrap = ctx.editor.addExtension(() => (ctx.layout.isZen() ? EditorView.lineWrapping : []));
    const setZen = async (on: boolean) => {
      await ctx.layout.setZen(on);
      wrap.refresh();
    };

    ctx.commands.register('view.toggleZen', () => setZen(!ctx.layout.isZen()), {
      title: 'Mode zen',
      category: 'Affichage',
    });
    ctx.commands.register('view.exitZen', () => setZen(false), {
      title: 'Quitter le mode zen',
      category: 'Affichage',
      hidden: true,
    });
    ctx.keybindings.register([
      { key: 'Leader Z', command: 'view.toggleZen' },
      { key: 'Escape', command: 'view.exitZen', when: 'zenMode' },
    ]);
    ctx.menus.registerItem('view', { command: 'view.toggleZen', group: '4_layout', order: 0 });

    for (const [part, setting, title, key] of PARTS) {
      const id = `view.toggle${part[0]?.toUpperCase()}${part.slice(1)}`;
      ctx.commands.register(
        id,
        () =>
          ctx.settings.update(
            `workbench.${setting}`,
            ctx.layout.isVisible(part) ? false : undefined,
          ),
        { title: `Afficher ou masquer ${title}`, category: 'Affichage' },
      );
      ctx.menus.registerItem('view', { command: id, group: '4_layout', order: 1 });
      ctx.keybindings.register({ key, command: id });
    }
  },
});
