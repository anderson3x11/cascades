import { defineExtension, type ExtensionContext, type TabInfo } from '../../api';

async function openPath(ctx: ExtensionContext, path: string): Promise<TabInfo | null> {
  const existing = ctx.workspace.findByPath(path);
  if (existing) {
    ctx.workspace.activate(existing.id);
    return existing;
  }
  const file = await ctx.fs.readTextFile(path);
  if (file.binary) {
    await ctx.dialogs.alert(`${path}\n\nCe fichier est binaire et ne peut pas encore être ouvert.`);
    return null;
  }
  return ctx.workspace.open({
    path,
    text: file.text,
    encoding: file.encoding,
    bom: file.bom,
    lineEnding: file.lineEnding,
  });
}

function target(ctx: ExtensionContext, id: unknown): TabInfo | null {
  if (typeof id === 'string') return ctx.workspace.tabs().find((t) => t.id === id) ?? null;
  return ctx.workspace.active();
}

async function write(ctx: ExtensionContext, tab: TabInfo, path: string): Promise<void> {
  await ctx.fs.writeTextFile(path, ctx.workspace.getText(tab.id), tab);
  if (path !== tab.path) ctx.workspace.update(tab.id, { path });
  ctx.workspace.markSaved(tab.id);
}

async function saveAs(ctx: ExtensionContext, tab: TabInfo): Promise<boolean> {
  const path = await ctx.dialogs.pickSavePath(tab.path ?? tab.title);
  if (!path) return false;
  await write(ctx, tab, path);
  return true;
}

export default defineExtension({
  id: 'cascades.file-ops',
  activate(ctx) {
    const report = (err: unknown) => {
      console.error(err);
      void ctx.dialogs.alert(String(err instanceof Error ? err.message : err), 'Erreur');
    };

    ctx.commands.register('file.new', () => ctx.workspace.open({ path: null, text: '' }), {
      title: 'Nouveau fichier',
      category: 'Fichier',
    });

    ctx.commands.register(
      'file.open',
      async () => {
        for (const path of await ctx.dialogs.pickFilesToOpen()) {
          await openPath(ctx, path).catch(report);
        }
      },
      { title: 'Ouvrir un fichier…', category: 'Fichier' },
    );

    ctx.commands.register('file.openPath', (path) => openPath(ctx, String(path)), {
      title: 'Ouvrir un chemin',
      category: 'Fichier',
    });

    /** Resolves to true when the tab ended up saved. */
    ctx.commands.register(
      'file.save',
      async (id) => {
        const tab = target(ctx, id);
        if (!tab) return false;
        try {
          if (!tab.path) return await saveAs(ctx, tab);
          await write(ctx, tab, tab.path);
          return true;
        } catch (err) {
          report(err);
          return false;
        }
      },
      { title: 'Enregistrer', category: 'Fichier' },
    );

    ctx.commands.register(
      'file.saveAs',
      async (id) => {
        const tab = target(ctx, id);
        if (!tab) return false;
        return await saveAs(ctx, tab).catch((err: unknown) => {
          report(err);
          return false;
        });
      },
      { title: 'Enregistrer sous…', category: 'Fichier' },
    );
  },
});
