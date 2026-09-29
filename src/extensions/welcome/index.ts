import { mount, unmount } from 'svelte';
import { defineExtension, t } from '../../api';
import WelcomeView from './WelcomeView.svelte';

const VIEWER = 'welcome';

/**
 * The page shown when no file is open: start writing, open a file or a
 * folder, recent files, a few shortcuts worth knowing.
 */
export default defineExtension({
  id: 'cascades.welcome',
  activate(ctx) {
    const welcomeTab = () => ctx.workspace.tabs().find((t) => t.viewer === VIEWER);

    ctx.viewers.register({
      id: VIEWER,
      title: t('Welcome'),
      extensions: [],
      kind: 'replace',
      load: async () => ({
        create(host) {
          const view = mount(WelcomeView, {
            target: host,
            props: {
              ctx,
              startNote: (text: string) => {
                void ctx.commands.execute('file.new').then(() => {
                  const editor = ctx.editor.view();
                  if (!editor) return;
                  if (text)
                    editor.dispatch({
                      changes: { from: 0, insert: text },
                      selection: { anchor: text.length },
                    });
                  editor.focus();
                });
              },
            },
          });
          return { update: () => {}, dispose: () => void unmount(view) };
        },
      }),
    });

    ctx.commands.register(
      'workbench.welcome',
      () => {
        const tab = welcomeTab();
        if (tab) ctx.workspace.activate(tab.id);
        else ctx.workspace.open({ path: null, text: '', viewer: VIEWER, title: t('Welcome') });
      },
      { title: t('Welcome'), category: t('File') },
    );
    ctx.menus.registerItem('file', { command: 'workbench.welcome', group: '1_new', order: 5 });

    // A page to pass through: it steps aside as soon as another tab is shown.
    ctx.events.on('workspace.didChangeActive', (tab) => {
      const welcome = welcomeTab();
      if (tab && tab.viewer !== VIEWER && welcome) ctx.workspace.close(welcome.id);
    });
  },
});
