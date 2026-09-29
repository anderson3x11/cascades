import { defineExtension, t, type Disposable, type TabInfo } from '../../api';
import { decide } from './decide';
import { markerMine, merge3, renderMerge } from './merge';

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

    /**
     * Three-way merge of the last saved text, the editor text and the disk.
     * The result stays unsaved; conflicts are left in the text for the
     * conflicts extension to resolve.
     */
    const mergeWithDisk = (id: string, theirs: string) => {
      const { text, conflicts } = renderMerge(
        merge3(ctx.workspace.savedText(id), ctx.workspace.getText(id), theirs),
      );
      ctx.workspace.reload(id, text);
      ctx.workspace.setSavedText(id, theirs);
      if (conflicts === 0) return;

      const view = ctx.editor.view();
      if (view && ctx.workspace.active()?.id === id) {
        const index = text.split('\n').indexOf(markerMine());
        const pos = view.state.doc.line(index + 1).from;
        view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      }
      const tab = ctx.workspace.tabs().find((t) => t.id === id);
      if (tab) {
        clearBanner(id);
        banners.set(
          id,
          ctx.banners.show({
            tabId: id,
            message:
              conflicts === 1
                ? t('Merged, 1 conflict to resolve: choose the version to keep in the text.')
                : t(
                    'Merged, {count} conflicts to resolve: choose the version to keep in the text.',
                    {
                      count: conflicts,
                    },
                  ),
            actions: [{ label: t('OK'), run: () => {} }],
          }),
        );
      }
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
        case 'ask': {
          const theirs = disk ?? '';
          showBanner(
            tab,
            t('"{file}" was changed on disk, and you have unsaved changes.', { file: tab.title }),
            [
              { label: t('Merge'), run: () => mergeWithDisk(id, theirs) },
              // Keep the editor text; saving will then overwrite the new version knowingly.
              { label: t('Keep my version'), run: () => ctx.workspace.setSavedText(id, theirs) },
              {
                label: t('Take the version on disk'),
                run: () => ctx.workspace.reload(id, theirs),
              },
            ],
          );
          return;
        }
        case 'removed':
          // The text only exists in the editor now: flag it as unsaved.
          ctx.workspace.setSavedText(id, '');
          showBanner(tab, t('"{file}" was deleted or moved on disk.', { file: tab.title }), [
            { label: t('Keep open'), run: () => {} },
            { label: t('Close the tab'), run: () => ctx.workspace.close(id) },
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
      // Viewer tabs (images) have no text to compare or reload.
      if (tab.path && !tab.viewer) {
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
