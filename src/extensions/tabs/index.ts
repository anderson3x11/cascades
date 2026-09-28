import { defineExtension, type TabInfo } from '../../api';

const MAX_CLOSED = 20;

export default defineExtension({
  id: 'cascades.tabs',
  async activate(ctx) {
    /** Paths of closed tabs, most recent last. */
    const closed: string[] = [];

    const step = (delta: number) => {
      const tabs = ctx.workspace.tabs();
      const active = ctx.workspace.active();
      if (!active || tabs.length < 2) return;
      const index = tabs.findIndex((t) => t.id === active.id);
      const next = tabs[(index + delta + tabs.length) % tabs.length];
      if (next) ctx.workspace.activate(next.id);
    };

    /** Resolves to false if the user cancelled. */
    const close = async (tab: TabInfo): Promise<boolean> => {
      if (tab.dirty) {
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
      if (tab.path) {
        closed.push(tab.path);
        if (closed.length > MAX_CLOSED) closed.shift();
      }
      // Like Notepad++, there is always at least one tab.
      if (ctx.workspace.tabs().length === 0) void ctx.commands.execute('file.new');
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

    if (ctx.workspace.tabs().length === 0) await ctx.commands.execute('file.new');
  },
});
