import { mount, unmount } from 'svelte';
import { defineExtension } from '../../api';
import ExplorerView from './ExplorerView.svelte';
import { ExplorerModel } from './model.svelte';

const STATE_FILE = 'explorer.json';
const PANEL = 'explorer';

interface SavedState {
  root: string | null;
  expanded: string[];
}

/** The opened folder, as a tree on the left: open, create, rename, send to the recycle bin. */
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
        const state: SavedState = { root: model.root, expanded: [...model.expanded] };
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

    const openFolder = async (path?: unknown) => {
      const folder = typeof path === 'string' ? path : await ctx.dialogs.pickFolder();
      if (!folder) return;
      await model.open(folder);
      ctx.panels.show(PANEL);
    };

    ctx.commands.register('explorer.openFolder', openFolder, {
      title: 'Ouvrir un dossier…',
      category: 'Fichier',
    });
    ctx.commands.register(
      'explorer.closeFolder',
      () => {
        model.close();
      },
      { title: 'Fermer le dossier', category: 'Fichier' },
    );
    ctx.commands.register('view.toggleSidebar', () => ctx.panels.toggleSide('left'), {
      title: 'Afficher ou masquer le panneau de gauche',
      category: 'Affichage',
    });
    ctx.keybindings.register([
      { key: 'Ctrl+Shift+O', command: 'explorer.openFolder' },
      { key: 'Ctrl+B', command: 'view.toggleSidebar' },
    ]);
    ctx.menus.registerItem('file', { command: 'explorer.openFolder', group: '1_new', order: 2.5 });
    ctx.menus.registerItem('file', { command: 'explorer.closeFolder', group: '3_close', order: 3 });
    ctx.menus.registerItem('view', { command: 'view.toggleSidebar', group: '4_layout', order: -1 });

    ctx.events.on('workspace.didChangeActive', (tab) => (model.activePath = tab?.path ?? null));
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('explorer.exclude')) void model.reloadAll();
    });

    // The folder of the last session comes back, with its open subfolders.
    try {
      const saved = JSON.parse(
        (await ctx.configFiles.read(STATE_FILE)) ?? 'null',
      ) as SavedState | null;
      if (saved?.root) {
        await model.open(saved.root, saved.expanded);
        ctx.panels.show(PANEL);
      }
    } catch {
      // A broken file only forgets the folder.
    }
    model.activePath = ctx.workspace.active()?.path ?? null;
  },
});
