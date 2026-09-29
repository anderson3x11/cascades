import { defineExtension, t, type Disposable, type UpdateInfo } from '../../api';

/** Wait after the start, so that the check never slows it down. */
const STARTUP_DELAY_MS = 5000;

/**
 * Looks for a new release of Cascades at start (and on demand), and offers to
 * install it. Installing saves the session, then restarts the app.
 */
export default defineExtension({
  id: 'cascades.updates',
  activate(ctx) {
    ctx.settings.register('updates', {
      check: {
        type: 'boolean',
        default: true,
        description: t('Look for a new version of Cascades at start.'),
      },
    });

    let banner: Disposable | null = null;
    const show = (options: Parameters<typeof ctx.banners.show>[0]) => {
      banner?.dispose();
      banner = ctx.banners.show(options);
    };

    const progress = ctx.statusBar.addItem({ id: 'update', alignment: 'right', priority: 60 });
    progress.visible = false;

    const install = async () => {
      progress.visible = true;
      progress.text = t('Downloading the update…');
      try {
        await ctx.app.installUpdate((downloaded, total) => {
          if (total) {
            progress.text = t('Downloading the update… {percent} %', {
              percent: Math.floor((downloaded / total) * 100),
            });
          }
        });
      } catch (err) {
        progress.visible = false;
        show({
          kind: 'warning',
          message: t('The update failed: {problem}', {
            problem: err instanceof Error ? err.message : String(err),
          }),
          actions: [{ label: t('OK'), run: () => {} }],
        });
      }
    };

    const offer = (update: UpdateInfo) =>
      show({
        message: t('Cascades {version} is available (you have {current}).', {
          version: update.version,
          current: update.currentVersion,
        }),
        actions: [
          { label: t('Update and restart'), run: () => void install() },
          { label: t('Later'), run: () => {} },
        ],
      });

    /** `manual`: say so when there is nothing new or the check fails. */
    const check = async (manual: boolean) => {
      let update: UpdateInfo | null;
      try {
        update = await ctx.app.checkForUpdate();
      } catch (err) {
        if (manual) {
          show({
            kind: 'warning',
            message: t('Could not look for updates: {problem}', {
              problem: err instanceof Error ? err.message : String(err),
            }),
            actions: [{ label: t('OK'), run: () => {} }],
          });
        }
        return;
      }
      if (update) offer(update);
      else if (manual) {
        show({
          message: t('Cascades {version} is the latest version.', {
            version: await ctx.app.version(),
          }),
          actions: [{ label: t('OK'), run: () => {} }],
        });
      }
    };

    ctx.commands.register('app.checkForUpdates', () => check(true), {
      title: t('Check for updates…'),
      category: t('File'),
    });
    ctx.menus.registerItem('file', {
      command: 'app.checkForUpdates',
      group: '8_preferences',
      order: 5,
    });

    if (ctx.settings.get<boolean>('updates.check')) {
      const timer = setTimeout(() => void check(false), STARTUP_DELAY_MS);
      ctx.subscriptions.add({ dispose: () => clearTimeout(timer) });
    }
  },
});
