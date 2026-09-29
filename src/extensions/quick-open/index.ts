import { defineExtension, t, type ExtensionContext } from '../../api';

const RECENT_FILE = 'recent.json';
const MAX_RECENT = 50;

function split(path: string): { name: string; dir: string } {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return { name: path.slice(cut + 1), dir: path.slice(0, Math.max(cut, 0)) };
}

/** Past this many files, the folders are not listed completely. */
const MAX_FOLDER_FILES = 50_000;

const samePath = (path: string) => path.replace(/\\/g, '/').toLowerCase();

/** The folders open in the explorer, if it is there. */
async function openFolders(ctx: ExtensionContext): Promise<string[]> {
  const folders = await ctx.commands.execute('explorer.folders').catch(() => []);
  return Array.isArray(folders) ? folders.filter((f): f is string => typeof f === 'string') : [];
}

async function folderFiles(ctx: ExtensionContext, folders: string[]): Promise<string[]> {
  let exclude: string[] = [];
  try {
    exclude = ctx.settings.get<string[]>('explorer.exclude');
  } catch {
    // Without the explorer, nothing is excluded but what .gitignore says.
  }
  try {
    return (await ctx.fs.listFiles(folders, exclude, MAX_FOLDER_FILES)).files;
  } catch (err) {
    console.error('[cascades] could not list the folders', err);
    return [];
  }
}

/** The folder of a file, from the name of the open folder it is in: "notes/2025". */
function relativeDir(path: string, folders: string[]): string {
  const dir = split(path).dir;
  const root = folders.find((f) => samePath(dir).startsWith(samePath(f)));
  if (!root) return dir;
  return `${split(root).name}${dir.slice(root.length)}`;
}

/** Quick open: jump to an open tab, a recently opened file or a file of the open folders. */
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
    // For other extensions (the welcome page).
    ctx.commands.register('quickOpen.recentFiles', () => [...recent], {
      title: t('Recent files'),
      hidden: true,
    });

    ctx.commands.register(
      'workbench.quickOpen',
      async () => {
        const active = ctx.workspace.active()?.id;
        const tabs = ctx.workspace.tabs().filter((tab) => tab.id !== active);
        const openPaths = new Set(ctx.workspace.tabs().map((tab) => tab.path));
        const folders = await openFolders(ctx);
        const inFolders = (path: string) => relativeDir(path, folders) !== split(path).dir;
        const items = [
          ...tabs.map((tab) => ({
            label: tab.title,
            description: tab.path ? `${relativeDir(tab.path, folders)} · ${t('open')}` : t('open'),
            value: { tab: tab.id, path: tab.path },
          })),
          ...recent
            .filter((p) => !openPaths.has(p))
            .map((p) => ({
              label: split(p).name,
              // Files outside the open folders say where they come from.
              description: inFolders(p)
                ? relativeDir(p, folders)
                : `${split(p).dir} · ${t('recent')}`,
              value: { tab: null as string | null, path: p as string | null },
            })),
        ];
        const shown = new Set(items.map((i) => i.value.path && samePath(i.value.path)));
        const more = folders.length
          ? folderFiles(ctx, folders).then((paths) =>
              paths
                .filter((p) => !shown.has(samePath(p)))
                .map((p) => ({
                  label: split(p).name,
                  description: relativeDir(p, folders),
                  value: { tab: null as string | null, path: p as string | null },
                })),
            )
          : undefined;
        const choice = await ctx.quickPick.show(items, {
          placeholder: folders.length
            ? t('Open a tab, a recent file or a file of the folders')
            : t('Open a tab or a recent file'),
          more,
        });
        if (!choice) return;
        if (choice.tab) ctx.workspace.activate(choice.tab);
        else if (choice.path) await ctx.commands.execute('file.openPath', choice.path);
      },
      { title: t('Quick open…'), category: t('File') },
    );
    ctx.keybindings.register([
      { key: 'Ctrl+P', command: 'workbench.quickOpen' },
      { key: 'Leader O', command: 'workbench.quickOpen' },
    ]);
    ctx.menus.registerItem('file', { command: 'workbench.quickOpen', group: '1_new', order: 3 });
  },
});
