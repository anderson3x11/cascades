import { Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { defineExtension, t, type ContextMenuItem } from '../../api';
import { firstFamily, installedFonts } from './fonts';
import { markers } from './markers';

const EYE_ICON =
  'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8zM8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z';
const FONT_ICON =
  'M1.5 12.5l3.2-9 3.2 9M2.6 9.5h4.2M13.8 7.8v4.7M13.8 10.2a2 2 0 1 1-4 0 2 2 0 0 1 4 0z';

/** Toggles of the Display menu that are plain editor settings. */
const toggles = (): [command: string, setting: string, title: string][] => [
  ['view.toggleWordWrap', 'editor.wordWrap', t('Word wrap')],
  ['view.toggleLineNumbers', 'editor.lineNumbers', t('Line numbers')],
  ['view.toggleSpaces', 'editor.showSpaces', t('Show spaces')],
  ['view.toggleTabCharacters', 'editor.showTabs', t('Show tabs')],
  ['view.toggleLineEnds', 'editor.showLineEnds', t('Show line ends')],
];

/**
 * How the text is shown: whitespace markers, display toggles and the editor
 * font, with their Display and Font menus in the status bar.
 */
export default defineExtension({
  id: 'cascades.display',
  activate(ctx) {
    ctx.settings.register('editor', {
      showSpaces: { type: 'boolean', default: false, description: t('Show spaces as dots.') },
      showTabs: { type: 'boolean', default: false, description: t('Show tabs as arrows.') },
      showLineEnds: {
        type: 'boolean',
        default: false,
        description: t('Show the end of each line with a ¬ mark.'),
      },
    });

    /** Font shown while the mouse is over the font menu, before it is chosen. */
    let previewFont: string | null = null;
    const handle = ctx.editor.addExtension((tab) => {
      const get = (key: string) => ctx.settings.get<boolean>(`editor.${key}`, tab.language);
      return [
        markers({
          spaces: get('showSpaces'),
          tabs: get('showTabs'),
          lineEnds: get('showLineEnds'),
        }),
        previewFont
          ? Prec.highest(
              EditorView.theme({ '&.cm-editor .cm-scroller': { fontFamily: previewFont } }),
            )
          : [],
      ];
    });
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('editor.show'))) handle.refresh();
      if (keys.includes('editor.fontFamily')) updateFont();
    });

    const save = async (key: string, value: unknown) => {
      try {
        // Written only when it differs from the default, which keeps settings.json short.
        await ctx.settings.update(
          key,
          value === ctx.settings.inspect(key).defaultValue ? undefined : value,
        );
      } catch (err) {
        ctx.banners.show({
          kind: 'warning',
          message: err instanceof Error ? err.message : String(err),
          actions: [{ label: t('OK'), run: () => {} }],
        });
      }
    };

    for (const [command, setting, title] of toggles()) {
      ctx.commands.register(command, () => save(setting, !ctx.settings.get<boolean>(setting)), {
        title,
        category: t('View'),
      });
      ctx.menus.registerItem('view', { command, group: '2_appearance', order: 5 });
    }
    ctx.keybindings.register({ key: 'Alt+Z', command: 'view.toggleWordWrap' });

    // Display menu ----------------------------------------------------------
    const shortcut = (command: string) => ctx.keybindings.label(command) ?? undefined;
    const runner = (command: string) => () => void ctx.commands.execute(command);
    const display = ctx.statusBar.addItem({
      id: 'display',
      alignment: 'center',
      priority: 30,
      icon: EYE_ICON,
      menu: () => {
        const check = (command: string, label: string, checked: boolean): ContextMenuItem => ({
          label,
          checked,
          shortcut: shortcut(command),
          run: runner(command),
        });
        const [wrap, numbers, spaces, tabs, ends] = toggles().map(([command, setting, title]) =>
          check(command, title, ctx.settings.get<boolean>(setting)),
        );
        return {
          items: [
            check('view.toggleZen', t('Zen mode'), ctx.layout.isZen()),
            ...[wrap, numbers].filter((i) => i !== undefined),
            check('cascades.toggle', t('Cascades'), ctx.settings.get<boolean>('cascades.enabled')),
            { heading: t('Markers') },
            ...[spaces, tabs, ends].filter((i) => i !== undefined),
            'separator',
            check('view.toggleSidebar', t('Side panel'), ctx.panels.isSideVisible('left')),
            check('view.toggleMenuBar', t('Menu bar'), ctx.layout.isVisible('menuBar')),
          ],
        };
      },
    });
    display.text = t('Display');
    display.tooltip = t('Display options');

    // Font menu -------------------------------------------------------------
    const font = ctx.statusBar.addItem({
      id: 'font',
      alignment: 'center',
      priority: 20,
      icon: FONT_ICON,
      menu: () => {
        const current = ctx.settings.get<string>('editor.fontFamily');
        const preview = (css: string | null) => () => {
          previewFont = css;
          handle.refresh();
        };
        const pick = (css: string | undefined) => () => {
          previewFont = null;
          handle.refresh();
          void save(
            'editor.fontFamily',
            css ?? ctx.settings.inspect('editor.fontFamily').defaultValue,
          );
        };
        const fallback = String(ctx.settings.inspect('editor.fontFamily').defaultValue);
        return {
          items: [
            {
              label: t('Default font'),
              checked: current === fallback,
              font: fallback,
              preview: preview(fallback),
              run: pick(undefined),
            },
            'separator',
            ...installedFonts().map((f) => ({
              label: f.name,
              checked: firstFamily(current) === f.name && current !== fallback,
              font: f.css,
              preview: preview(f.css),
              run: pick(f.css),
            })),
          ],
          onCancel: preview(null),
        };
      },
    });
    font.tooltip = t('Font of the editor');
    const updateFont = () => {
      font.text = firstFamily(ctx.settings.get<string>('editor.fontFamily'));
    };
    updateFont();
  },
});
