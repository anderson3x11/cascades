import { mount, unmount } from 'svelte';
import { defineExtension, t } from '../../api';
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
        description: t('Names hidden in the explorer (* for any text: "*.log").'),
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
      title: t('Files'),
      side: 'left',
      actions: () =>
        model.roots.length === 0
          ? []
          : [
              {
                label: t('New file'),
                icon: 'M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9 1.5ZM9 1.5v4h4M8 8v4M6 10h4',
                run: () => void model.newNearSelection('file'),
              },
              {
                label: t('New folder'),
                icon: 'M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4ZM8 7v4M6 9h4',
                run: () => void model.newNearSelection('folder'),
              },
              { label: t('Collapse all'), icon: 'M4 10l4-4 4 4', run: () => model.collapseAll() },
            ],
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
      title: t('Add folder…'),
      category: t('File'),
    });
    // For other extensions (quick open, search in files).
    ctx.commands.register('explorer.folders', () => [...model.roots], {
      title: t('Open folders'),
      hidden: true,
    });
    ctx.commands.register('explorer.removeAllFolders', () => model.removeAll(), {
      title: t('Close all folders'),
      category: t('File'),
    });
    ctx.commands.register('view.toggleSidebar', () => ctx.panels.toggleSide('left'), {
      title: t('Show or hide the left panel'),
      category: t('View'),
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
