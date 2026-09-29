import { EditorView } from '@codemirror/view';
import { defineExtension, t, type LayoutPart } from '../../api';

/** Each part can be toggled from the keyboard too, so a hidden menu bar can come back. */
const parts = (): [LayoutPart, setting: string, title: string, key: string][] => [
  ['menuBar', 'showMenuBar', t('Show or hide the menu bar'), 'Leader M'],
  ['tabs', 'showTabs', t('Show or hide the tabs'), 'Leader Tab'],
  ['statusBar', 'showStatusBar', t('Show or hide the status bar'), 'Leader B'],
];

/** Visible parts of the window, interface font, and zen mode. */
export default defineExtension({
  id: 'cascades.layout',
  activate(ctx) {
    ctx.settings.register('workbench', {
      showMenuBar: { type: 'boolean', default: true, description: t('Show the menu bar.') },
      showTabs: { type: 'boolean', default: true, description: t('Show the tabs.') },
      showStatusBar: { type: 'boolean', default: true, description: t('Show the status bar.') },
      fontFamily: {
        type: 'string',
        default: "system-ui, 'Segoe UI', sans-serif",
        description: t('Font of the interface (menus, tabs, status bar).'),
      },
      fontSize: {
        type: 'number',
        default: 13,
        description: t('Font size of the interface (px).'),
      },
    });
    ctx.settings.register('zen', {
      width: {
        type: 'number',
        default: 80,
        description: t('Width of the text column in zen mode, in characters.'),
      },
    });

    const apply = () => {
      for (const [part, setting] of parts()) {
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
      title: t('Zen mode'),
      category: t('View'),
    });
    ctx.commands.register('view.exitZen', () => setZen(false), {
      title: t('Leave zen mode'),
      category: t('View'),
      hidden: true,
    });
    ctx.keybindings.register([
      { key: 'Leader Z', command: 'view.toggleZen' },
      { key: 'Escape', command: 'view.exitZen', when: 'zenMode' },
    ]);
    ctx.menus.registerItem('view', { command: 'view.toggleZen', group: '4_layout', order: 0 });

    for (const [part, setting, title, key] of parts()) {
      const id = `view.toggle${part[0]?.toUpperCase()}${part.slice(1)}`;
      ctx.commands.register(
        id,
        () =>
          ctx.settings.update(
            `workbench.${setting}`,
            ctx.layout.isVisible(part) ? false : undefined,
          ),
        { title, category: t('View') },
      );
      ctx.menus.registerItem('view', { command: id, group: '4_layout', order: 1 });
      ctx.keybindings.register({ key, command: id });
    }
  },
});
