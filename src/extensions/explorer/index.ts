import { mount, unmount } from 'svelte';
import { defineExtension } from '../../api';
import ExplorerView from './ExplorerView.svelte';
import { ExplorerModel } from './model.svelte';

const STATE_FILE = 'explorer.json';
const PANEL = 'explorer';

interface SavedState {
  roots: string[];
  expanded: string[];
  /** Before several folders could be added. */
  root?: string | null;
}

/** Folders as a tree on the left: open files, create, rename, send to the recycle bin. */
export default defineExtension({
  id: 'cascades.explorer',
  async activate(ctx) {
    ctx.settings.register('explorer', {
      exclude: {
        type: 'array',
        default: ['.git', 'node_modules'],
        description: 'Noms masqués dans l’explorateur (* pour n’importe quel texte : "*.log").',
      },
    });

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const model = new ExplorerModel(ctx, () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const state: SavedState = { roots: model.roots, expanded: [...model.expanded] };
        void ctx.configFiles.write(STATE_FILE, JSON.stringify(state));
      }, 300);
    });

    ctx.panels.register({
      id: PANEL,
      title: 'Fichiers',
      side: 'left',
      render(host) {
        const view = mount(ExplorerView, { target: host, props: { ctx, model } });
        return { dispose: () => void unmount(view) };
      },
    });

    const addFolder = async (path?: unknown) => {
      const folder = typeof path === 'string' ? path : await ctx.dialogs.pickFolder();
      if (!folder) return;
      await model.add(folder);
      ctx.panels.show(PANEL);
    };

    ctx.commands.register('explorer.addFolder', addFolder, {
      title: 'Ajouter un dossier…',
      category: 'Fichier',
    });
    ctx.commands.register('explorer.removeAllFolders', () => model.removeAll(), {
      title: 'Fermer tous les dossiers',
      category: 'Fichier',
    });
    ctx.commands.register('view.toggleSidebar', () => ctx.panels.toggleSide('left'), {
      title: 'Afficher ou masquer le panneau de gauche',
      category: 'Affichage',
    });
    ctx.keybindings.register([
      { key: 'Ctrl+Shift+O', command: 'explorer.addFolder' },
      { key: 'Ctrl+B', command: 'view.toggleSidebar' },
    ]);
    ctx.menus.registerItem('file', { command: 'explorer.addFolder', group: '1_new', order: 2.5 });
    ctx.menus.registerItem('file', {
      command: 'explorer.removeAllFolders',
      group: '3_close',
      order: 3,
    });
    ctx.menus.registerItem('view', { command: 'view.toggleSidebar', group: '4_layout', order: -1 });

    ctx.events.on('workspace.didChangeActive', (tab) => (model.activePath = tab?.path ?? null));
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('explorer.exclude')) void model.reloadAll();
    });

    // The folders of the last session come back, with their open subfolders.
    try {
      const saved = JSON.parse(
        (await ctx.configFiles.read(STATE_FILE)) ?? 'null',
      ) as SavedState | null;
      const roots = saved?.roots ?? (saved?.root ? [saved.root] : []);
      // The old format always showed its folder unfolded.
      const expanded = saved?.roots ? saved.expanded : [...roots, ...(saved?.expanded ?? [])];
      for (const root of roots) await model.add(root, expanded);
      if (roots.length > 0) ctx.panels.show(PANEL);
    } catch {
      // A broken file only forgets the folders.
    }
    model.activePath = ctx.workspace.active()?.path ?? null;
  },
});
