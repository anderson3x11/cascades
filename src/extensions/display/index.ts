import { Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { mount, unmount } from 'svelte';
import { defineExtension, t, type ContextMenuItem } from '../../api';
import DisplayView from './DisplayView.svelte';
import { DisplayState } from './state.svelte';
import { firstFamily, installedFonts } from './fonts';
import { markers } from './markers';

// Lucide icons (lucide.dev, ISC license), on their 24×24 grid.
const OPTIONS_ICON = 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4';
const FONT_ICON = 'M4 7V4h16v3M9 20h6M12 4v16';

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
    }
    ctx.keybindings.register({ key: 'Alt+Z', command: 'view.toggleWordWrap' });

    // Display menu ----------------------------------------------------------
    const shortcut = (command: string) => ctx.keybindings.label(command) ?? undefined;
    const runner = (command: string) => () => void ctx.commands.execute(command);
    const display = ctx.statusBar.addItem({
      id: 'display',
      alignment: 'center',
      priority: 30,
      icon: OPTIONS_ICON,
      label: t('Options'),
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
      label: t('Font'),
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

    // The Display family of the side panel: these menus unfold in place, then the View commands.
    // A status bar button opens it at its own menu.
    const state = new DisplayState();
    ctx.statusBar.onDidRequestMenu((id) => {
      state.open = id;
      ctx.panels.show('display');
    });
    ctx.panels.register({
      id: 'display',
      title: t('Options'),
      side: 'left',
      icon: OPTIONS_ICON,
      order: 30,
      render(host) {
        const view = mount(DisplayView, { target: host, props: { ctx, display: state } });
        return { dispose: () => void unmount(view) };
      },
    });
    const updateFont = () => {
      font.text = firstFamily(ctx.settings.get<string>('editor.fontFamily'));
    };
    updateFont();
  },
});
