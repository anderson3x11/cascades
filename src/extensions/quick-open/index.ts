import { defineExtension } from '../../api';

const RECENT_FILE = 'recent.json';
const MAX_RECENT = 50;

function split(path: string): { name: string; dir: string } {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return { name: path.slice(cut + 1), dir: path.slice(0, Math.max(cut, 0)) };
}

/** Quick open: jump to an open tab or a recently opened file by name. */
export default defineExtension({
  id: 'cascades.quick-open',
  async activate(ctx) {
    let recent: string[] = [];
    try {
      const saved: unknown = JSON.parse((await ctx.configFiles.read(RECENT_FILE)) ?? '[]');
      if (Array.isArray(saved)) recent = saved.filter((p): p is string => typeof p === 'string');
    } catch {
      // A broken file only loses the history.
    }

    /** Most recent first, without duplicates. */
    const remember = (path: string | null) => {
      if (!path || recent[0] === path) return;
      recent = [path, ...recent.filter((p) => p !== path)].slice(0, MAX_RECENT);
      void ctx.configFiles.write(RECENT_FILE, JSON.stringify(recent));
    };
    ctx.events.on('workspace.didOpen', (tab) => remember(tab.path));
    ctx.events.on('workspace.didChangeActive', (tab) => remember(tab?.path ?? null));
    ctx.events.on('workspace.didChangeTab', (tab) => remember(tab.path));

    ctx.commands.register(
      'workbench.quickOpen',
      async () => {
        const active = ctx.workspace.active()?.id;
        const tabs = ctx.workspace.tabs().filter((t) => t.id !== active);
        const openPaths = new Set(ctx.workspace.tabs().map((t) => t.path));
        const items = [
          ...tabs.map((t) => ({
            label: t.title,
            description: t.path ? `${split(t.path).dir} · ouvert` : 'ouvert',
            value: { tab: t.id, path: t.path },
          })),
          ...recent
            .filter((p) => !openPaths.has(p))
            .map((p) => ({
              label: split(p).name,
              description: split(p).dir,
              value: { tab: null as string | null, path: p as string | null },
            })),
        ];
        const choice = await ctx.quickPick.show(items, {
          placeholder: 'Ouvrir un onglet ou un fichier récent',
        });
        if (!choice) return;
        if (choice.tab) ctx.workspace.activate(choice.tab);
        else if (choice.path) await ctx.commands.execute('file.openPath', choice.path);
      },
      { title: 'Ouverture rapide…', category: 'Fichier' },
    );
    ctx.keybindings.register([
      { key: 'Ctrl+P', command: 'workbench.quickOpen' },
      { key: 'Leader O', command: 'workbench.quickOpen' },
    ]);
    ctx.menus.registerItem('file', { command: 'workbench.quickOpen', group: '1_new', order: 3 });
  },
});
