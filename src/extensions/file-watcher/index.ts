import { defineExtension, type Disposable, type TabInfo } from '../../api';
import { decide } from './decide';

/** Events often come in bursts during a save; wait for the file to settle. */
const SETTLE_MS = 250;

/**
 * Follows changes made to open files by other programs: a clean tab is
 * reloaded, a tab with unsaved work gets a banner to choose.
 */
export default defineExtension({
  id: 'cascades.file-watcher',
  activate(ctx) {
    const watches = new Map<string, { path: string; watch: Disposable }>();
    const banners = new Map<string, Disposable>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const clearBanner = (id: string) => {
      banners.get(id)?.dispose();
      banners.delete(id);
    };

    const showBanner = (
      tab: TabInfo,
      message: string,
      actions: { label: string; run: () => void }[],
    ) => {
      clearBanner(tab.id);
      banners.set(tab.id, ctx.banners.show({ tabId: tab.id, kind: 'warning', message, actions }));
    };

    const check = async (id: string) => {
      const tab = ctx.workspace.tabs().find((t) => t.id === id);
      if (!tab?.path) return;
      const file = await ctx.fs.readTextFile(tab.path).catch(() => null);
      const disk = file && !file.binary ? file.text : null;
      // The tab may have been closed or renamed while reading.
      if (!ctx.workspace.tabs().includes(tab) || watches.get(id)?.path !== tab.path) return;

      switch (decide(disk, ctx.workspace.getText(id), ctx.workspace.savedText(id))) {
        case 'none':
          return;
        case 'markSaved':
          clearBanner(id);
          ctx.workspace.setSavedText(id, ctx.workspace.getText(id));
          return;
        case 'reload':
          clearBanner(id);
          ctx.workspace.reload(id, disk ?? '');
          return;
        case 'ask':
          showBanner(
            tab,
            `« ${tab.title} » a été modifié sur le disque, et vous avez des modifications non enregistrées.`,
            [
              { label: 'Recharger', run: () => ctx.workspace.reload(id, disk ?? '') },
              // Keep the editor text; saving will then overwrite the new version knowingly.
              { label: 'Garder ma version', run: () => ctx.workspace.setSavedText(id, disk ?? '') },
            ],
          );
          return;
        case 'removed':
          // The text only exists in the editor now: flag it as unsaved.
          ctx.workspace.setSavedText(id, '');
          showBanner(tab, `« ${tab.title} » a été supprimé ou déplacé sur le disque.`, [
            { label: 'Garder ouvert', run: () => {} },
            { label: 'Fermer l’onglet', run: () => ctx.workspace.close(id) },
          ]);
      }
    };

    const schedule = (id: string) => {
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          void check(id);
        }, SETTLE_MS),
      );
    };

    /** Watches the tab's current path, and stops watching an old one. */
    const sync = (tab: TabInfo) => {
      const current = watches.get(tab.id);
      if (current?.path === tab.path) return;
      current?.watch.dispose();
      watches.delete(tab.id);
      if (tab.path) {
        watches.set(tab.id, {
          path: tab.path,
          watch: ctx.fs.watch(tab.path, () => schedule(tab.id)),
        });
      }
    };

    for (const tab of ctx.workspace.tabs()) sync(tab);
    ctx.events.on('workspace.didOpen', sync);
    ctx.events.on('workspace.didChangeTab', sync);
    ctx.events.on('workspace.didClose', (tab) => {
      watches.get(tab.id)?.watch.dispose();
      watches.delete(tab.id);
      clearTimeout(timers.get(tab.id));
      timers.delete(tab.id);
      clearBanner(tab.id);
    });
    ctx.subscriptions.add({ dispose: () => timers.forEach((t) => clearTimeout(t)) });
  },
});
