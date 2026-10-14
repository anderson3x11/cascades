import { defineExtension, t, type TabInfo } from '../../api';

const MAX_CLOSED = 20;

export default defineExtension({
  id: 'cascades.tabs',
  async activate(ctx) {
    /** Paths of closed tabs, most recent last. */
    const closed: string[] = [];

    /** Next or previous tab within the active group. */
    const step = (delta: number) => {
      const group = ctx.workspace.groups().find((g) => g.id === ctx.workspace.activeGroup());
      const active = ctx.workspace.active();
      const tabs = group?.tabs ?? [];
      if (!active || tabs.length < 2) return;
      const index = tabs.findIndex((t) => t.id === active.id);
      const next = tabs[(index + delta + tabs.length) % tabs.length];
      if (next) ctx.workspace.activate(next.id);
    };

    /** Other tabs showing the same document (clones in other groups). */
    const otherViews = (tab: TabInfo) =>
      ctx.workspace.tabs().filter((t) => t.documentId === tab.documentId && t.id !== tab.id);

    /** Resolves to false if the user cancelled. */
    const close = async (tab: TabInfo): Promise<boolean> => {
      // Closing one view of a document shown elsewhere loses nothing.
      if (tab.dirty && otherViews(tab).length === 0) {
        const choice = await ctx.dialogs.choose(
          t('Save the changes to "{file}"?', { file: tab.title }),
          { buttons: [t('Save'), t('Don’t save'), t('Cancel')] },
        );
        if (choice === t('Cancel')) return false;
        if (choice === t('Save') && !(await ctx.commands.execute('file.save', tab.id))) {
          return false;
        }
      }
      ctx.workspace.close(tab.id);
      return true;
    };

    ctx.settings.register('tabs', {
      limit: {
        type: 'number',
        default: 6,
        description: t(
          'Most tabs open in a view. Opening one more closes the saved tab left unused the longest; unsaved tabs stay. 0 for no limit.',
        ),
      },
    });

    /** Tab ids, the most recently active last. */
    const recent: string[] = [];
    const forget = (id: string) => {
      const index = recent.indexOf(id);
      if (index !== -1) recent.splice(index, 1);
    };
    ctx.events.on('workspace.didChangeActive', (tab) => {
      if (!tab) return;
      forget(tab.id);
      recent.push(tab.id);
    });

    /** Keeps a view within the limit, closing the saved tabs left unused the longest. */
    ctx.events.on('workspace.didOpen', (opened) => {
      const limit = ctx.settings.get<number>('tabs.limit');
      const group = ctx.workspace.groups().find((g) => g.id === opened.groupId);
      if (!group || !(limit > 0) || group.tabs.length <= limit) return;
      // A tab never activated is older than any other.
      const unused = group.tabs
        .filter((tab) => !tab.dirty && tab.id !== opened.id && tab.id !== group.active?.id)
        .sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
      for (const tab of unused.slice(0, group.tabs.length - limit)) ctx.workspace.close(tab.id);
    });

    ctx.events.on('workspace.didClose', (tab) => {
      forget(tab.id);
      if (tab.path && otherViews(tab).length === 0) {
        closed.push(tab.path);
        if (closed.length > MAX_CLOSED) closed.shift();
      }
      // Never an empty window: the welcome page, or a new note when the
      // welcome page itself was closed (or is not there).
      if (ctx.workspace.tabs().length === 0) {
        const next = tab.viewer === 'welcome' ? 'file.new' : 'workbench.welcome';
        void ctx.commands.execute(next).catch(() => ctx.commands.execute('file.new'));
      }
    });

    ctx.commands.register('tabs.next', () => step(1), {
      title: t('Next tab'),
      category: t('Tabs'),
    });
    ctx.commands.register('tabs.previous', () => step(-1), {
      title: t('Previous tab'),
      category: t('Tabs'),
    });

    ctx.commands.register(
      'tabs.close',
      async (id) => {
        const tab =
          typeof id === 'string'
            ? ctx.workspace.tabs().find((t) => t.id === id)
            : ctx.workspace.active();
        return tab ? await close(tab) : false;
      },
      { title: t('Close the tab'), category: t('Tabs') },
    );

    ctx.commands.register(
      'tabs.reopenClosed',
      async () => {
        const path = closed.pop();
        if (path) await ctx.commands.execute('file.openPath', path);
      },
      { title: t('Reopen the last closed tab'), category: t('Tabs') },
    );

    ctx.menus.registerItem('file', { command: 'tabs.close', group: '3_close', order: 1 });
    ctx.menus.registerItem('file', { command: 'tabs.reopenClosed', group: '3_close', order: 2 });
    ctx.menus.registerMenu({ id: 'view', title: t('View'), order: 30 });
    ctx.panels.register({
      id: 'view',
      title: t('View'),
      side: 'left',
      icon: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
      order: 50,
      menus: ['view'],
    });
    ctx.menus.registerGroup('view', {
      id: '1_preview',
      title: t('Preview'),
      icon: 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
    });
    ctx.menus.registerGroup('view', {
      id: '1_tabs',
      title: t('Tabs'),
      icon: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 9h18M9 3v6',
    });
    ctx.menus.registerGroup('view', {
      id: '2_appearance',
      title: t('Cascades'),
      icon: 'M21 12h-8M21 6H8M21 18h-8M3 6v4a2 2 0 0 0 2 2h3M3 10v6a2 2 0 0 0 2 2h3',
    });
    ctx.menus.registerGroup('view', {
      id: '3_zoom',
      title: t('Zoom'),
      icon: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3M11 8v6M8 11h6',
    });
    ctx.menus.registerGroup('view', {
      id: '4_layout',
      title: t('Layout'),
      icon: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18',
    });
    ctx.menus.registerGroup('view', {
      id: '5_split',
      title: t('Views'),
      icon: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 3v18',
    });
    ctx.menus.registerItem('view', { command: 'tabs.next', group: '1_tabs', order: 1 });
    ctx.menus.registerItem('view', { command: 'tabs.previous', group: '1_tabs', order: 2 });

    if (ctx.workspace.tabs().length === 0) await ctx.commands.execute('file.new');
  },
});
