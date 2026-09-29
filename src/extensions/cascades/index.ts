import { defineExtension, type TabInfo } from '../../api';
import { CASCADE_STYLES, blockKey, cascades, type CascadeStyle } from './render';
import { rootLine } from './tree';

const HIDDEN_FILE = 'cascades-hidden.json';

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
  async activate(ctx) {
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
      ignoreLists: {
        type: 'boolean',
        default: false,
        description: 'Ne pas dessiner de cascade vers les éléments de liste (- item, 1. item…).',
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

    // Blocks hidden by hand, per file (never written in the file itself).
    const hidden = new Map<string, Set<string>>();
    try {
      const saved: unknown = JSON.parse((await ctx.configFiles.read(HIDDEN_FILE)) ?? '{}');
      if (typeof saved === 'object' && saved !== null) {
        for (const [file, keys] of Object.entries(saved)) {
          if (Array.isArray(keys))
            hidden.set(file, new Set(keys.filter((k) => typeof k === 'string')));
        }
      }
    } catch {
      // A broken file only forgets which blocks were hidden.
    }
    const fileKey = (tab: TabInfo) => tab.path ?? `untitled:${tab.id}`;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const saveHidden = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const data: Record<string, string[]> = {};
        for (const [file, keys] of hidden) {
          if (keys.size > 0 && !file.startsWith('untitled:')) data[file] = [...keys];
        }
        void ctx.configFiles.write(HIDDEN_FILE, JSON.stringify(data));
      }, 300);
    };
    ctx.subscriptions.add({ dispose: () => clearTimeout(saveTimer) });

    const toggleBlock = (tab: TabInfo, key: string) => {
      const file = fileKey(tab);
      const keys = hidden.get(file) ?? new Set<string>();
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      hidden.set(file, keys);
      handle.refresh();
      saveHidden();
    };

    // Follow renames (untitled buffer saved, "save as").
    const tabFiles = new Map<string, string>();
    ctx.events.on('workspace.didOpen', (tab) => tabFiles.set(tab.id, fileKey(tab)));
    ctx.events.on('workspace.didChangeTab', (tab) => {
      const before = tabFiles.get(tab.id);
      const after = fileKey(tab);
      tabFiles.set(tab.id, after);
      const keys = before && before !== after ? hidden.get(before) : undefined;
      if (!keys) return;
      hidden.delete(before as string);
      hidden.set(after, keys);
      saveHidden();
    });

    const handle = ctx.editor.addExtension((tab) => {
      const get = <T>(key: string) => ctx.settings.get<T>(`cascades.${key}`, tab.language);
      // Big files in light mode: no cascades.
      if (
        tab.large ||
        !get<boolean>('enabled') ||
        !get<string[]>('languages').includes(tab.language)
      ) {
        return [];
      }
      return cascades({
        style: preview ?? get<CascadeStyle>('style'),
        lineWidth: get<number>('lineWidth'),
        colorByDepth: get<boolean>('colorByDepth'),
        highlight: get<boolean>('highlight'),
        markdown: tab.language === 'markdown',
        ignoreLists: get<boolean>('ignoreLists'),
        hiddenBlocks: hidden.get(fileKey(tab)) ?? new Set(),
        onToggleBlock: (key) => toggleBlock(tab, key),
      });
    });

    ctx.commands.register(
      'cascades.toggleBlock',
      () => {
        const tab = ctx.workspace.active();
        const view = ctx.editor.view();
        if (!tab || !view || tab.viewer) return;
        const { doc, tabSize } = view.state;
        const line = doc.lineAt(view.state.selection.main.head).number;
        const root = rootLine((n) => ({ text: doc.line(n).text }), line, tabSize);
        if (root !== null) toggleBlock(tab, blockKey(doc.line(root).text));
      },
      { title: 'Afficher ou masquer la cascade de ce bloc', category: 'Affichage' },
    );
    ctx.keybindings.register({ key: 'Leader Shift+C', command: 'cascades.toggleBlock' });
    ctx.menus.registerItem('view', {
      command: 'cascades.toggleBlock',
      group: '2_appearance',
      order: 4,
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
