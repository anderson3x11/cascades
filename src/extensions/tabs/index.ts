import { defineExtension, type TabInfo } from '../../api';

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
          `Enregistrer les modifications de « ${tab.title} » ?`,
          { buttons: ['Enregistrer', 'Ne pas enregistrer', 'Annuler'] },
        );
        if (choice === 'Annuler') return false;
        if (choice === 'Enregistrer' && !(await ctx.commands.execute('file.save', tab.id))) {
          return false;
        }
      }
      ctx.workspace.close(tab.id);
      return true;
    };

    ctx.events.on('workspace.didClose', (tab) => {
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
      title: 'Onglet suivant',
      category: 'Onglets',
    });
    ctx.commands.register('tabs.previous', () => step(-1), {
      title: 'Onglet précédent',
      category: 'Onglets',
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
      { title: 'Fermer l’onglet', category: 'Onglets' },
    );

    ctx.commands.register(
      'tabs.reopenClosed',
      async () => {
        const path = closed.pop();
        if (path) await ctx.commands.execute('file.openPath', path);
      },
      { title: 'Rouvrir le dernier onglet fermé', category: 'Onglets' },
    );

    ctx.menus.registerItem('file', { command: 'tabs.close', group: '3_close', order: 1 });
    ctx.menus.registerItem('file', { command: 'tabs.reopenClosed', group: '3_close', order: 2 });
    ctx.menus.registerMenu({ id: 'view', title: 'Affichage', order: 30 });
    ctx.menus.registerItem('view', { command: 'tabs.next', group: '1_tabs', order: 1 });
    ctx.menus.registerItem('view', { command: 'tabs.previous', group: '1_tabs', order: 2 });

    if (ctx.workspace.tabs().length === 0) await ctx.commands.execute('file.new');
  },
});
