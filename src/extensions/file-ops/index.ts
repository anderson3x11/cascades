import { defineExtension, type ExtensionContext, type TabInfo } from '../../api';

/** Past this size, a file is not edited: it opens in the hex view, which reads only what it shows. */
const EDIT_LIMIT = 512 * 1024 * 1024;

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} Mo`;

async function openPath(ctx: ExtensionContext, path: string): Promise<TabInfo | null> {
  const existing = ctx.workspace.findByPath(path);
  if (existing) {
    ctx.workspace.activate(existing.id);
    return existing;
  }
  // Images and other files shown by a viewer are not read as text.
  const viewer = ctx.viewers.replaceFor(path);
  if (viewer) return ctx.workspace.open({ path, text: '', viewer: viewer.id });

  const size = await ctx.fs.fileSize(path).catch(() => 0);
  const binary = ctx.viewers.binaryViewer();
  if (size > EDIT_LIMIT && binary) {
    const tab = ctx.workspace.open({ path, text: '', viewer: binary.id });
    ctx.banners.show({
      kind: 'info',
      tabId: tab.id,
      message: `Fichier trop gros pour être modifié (${megabytes(size)}) : il est affiché en lecture seule.`,
    });
    return tab;
  }
  const large = size > ctx.settings.get<number>('files.largeFileSize') * 1024 * 1024;

  const file = await ctx.fs.readTextFile(path);
  if (file.binary) {
    if (binary) return ctx.workspace.open({ path, text: '', viewer: binary.id });
    await ctx.dialogs.alert(`${path}\n\nCe fichier n'est pas du texte et ne peut pas être ouvert.`);
    return null;
  }
  const tab = ctx.workspace.open({
    path,
    text: file.text,
    encoding: file.encoding,
    bom: file.bom,
    lineEnding: file.lineEnding,
    large,
  });
  if (large) {
    ctx.banners.show({
      kind: 'info',
      tabId: tab.id,
      message: `Gros fichier (${megabytes(size)}) : coloration, cascades et comptage des mots sont coupés pour rester fluide.`,
      actions: [{ label: 'OK', run: () => {} }],
    });
  }
  return tab;
}

function target(ctx: ExtensionContext, id: unknown): TabInfo | null {
  if (typeof id === 'string') return ctx.workspace.tabs().find((t) => t.id === id) ?? null;
  return ctx.workspace.active();
}

async function write(ctx: ExtensionContext, tab: TabInfo, path: string): Promise<void> {
  // A viewer tab (image) has no text: writing would empty the file.
  if (tab.viewer) return;
  await ctx.fs.writeTextFile(path, ctx.workspace.getText(tab.id), tab);
  if (path !== tab.path) ctx.workspace.update(tab.id, { path });
  ctx.workspace.markSaved(tab.id);
}

async function saveAs(ctx: ExtensionContext, tab: TabInfo): Promise<boolean> {
  if (tab.viewer) return false;
  const ext = ctx.settings.get<string>('files.defaultExtension').replace(/^\./, '');
  const filters = [
    ...(ext ? [{ name: `Fichier .${ext}`, extensions: [ext] }] : []),
    { name: 'Tous les fichiers', extensions: ['*'] },
  ];
  const defaultPath = tab.path ?? (ext ? `${tab.title}.${ext}` : tab.title);
  const path = await ctx.dialogs.pickSavePath(defaultPath, filters);
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

    ctx.settings.register('files', {
      largeFileSize: {
        type: 'number',
        default: 50,
        description:
          'Taille (en Mo) à partir de laquelle un fichier s’ouvre en mode allégé : sans coloration, cascades ni comptage des mots.',
      },
      defaultExtension: {
        type: 'string',
        default: 'txt',
        description: 'Extension proposée pour un nouveau fichier ("" pour aucune).',
      },
      autoSave: {
        type: 'string',
        default: 'off',
        enum: ['off', 'afterDelay'],
        description:
          'Enregistrer automatiquement les fichiers modifiés (pas les onglets sans titre).',
      },
      autoSaveDelay: {
        type: 'number',
        default: 1000,
        description: 'Délai en millisecondes avant l’enregistrement automatique.',
      },
    });

    const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    ctx.subscriptions.add({
      dispose: () => autoSaveTimers.forEach((timer) => clearTimeout(timer)),
    });
    ctx.events.on('editor.didUpdate', ({ tab, docChanged }) => {
      if (!docChanged || !tab.path) return;
      if (ctx.settings.get<string>('files.autoSave', tab.language) !== 'afterDelay') return;
      clearTimeout(autoSaveTimers.get(tab.id));
      const delay = ctx.settings.get<number>('files.autoSaveDelay', tab.language);
      autoSaveTimers.set(
        tab.id,
        setTimeout(() => {
          autoSaveTimers.delete(tab.id);
          const current = ctx.workspace.tabs().find((t) => t.id === tab.id);
          if (current?.dirty) void ctx.commands.execute('file.save', tab.id);
        }, delay),
      );
    });
    ctx.events.on('app.didDropFiles', async (paths) => {
      for (const path of paths) await openPath(ctx, path).catch(report);
    });

    ctx.events.on('workspace.didClose', (tab) => {
      clearTimeout(autoSaveTimers.get(tab.id));
      autoSaveTimers.delete(tab.id);
    });

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
      hidden: true,
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

    ctx.menus.registerMenu({ id: 'file', title: 'Fichier', order: 10 });
    ctx.menus.registerItem('file', { command: 'file.new', group: '1_new', order: 1 });
    ctx.menus.registerItem('file', { command: 'file.open', group: '1_new', order: 2 });
    ctx.menus.registerItem('file', { command: 'file.save', group: '2_save', order: 1 });
    ctx.menus.registerItem('file', { command: 'file.saveAs', group: '2_save', order: 2 });
  },
});
