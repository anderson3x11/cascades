import { defineExtension, type GroupTarget } from '../../api';

/** Split view: several groups of tabs, a document shown in more than one. */
export default defineExtension({
  id: 'cascades.split',
  activate(ctx) {
    /** The tab a command acts on: the one given (tab menu) or the active one. */
    const tabId = (id: unknown) =>
      typeof id === 'string' ? id : (ctx.workspace.active()?.id ?? null);

    const clone = (id: unknown, target: GroupTarget) => {
      const tab = tabId(id);
      if (tab) ctx.workspace.clone(tab, target);
    };
    const move = (id: unknown, target: GroupTarget) => {
      const tab = tabId(id);
      if (tab) ctx.workspace.moveToGroup(tab, target);
    };

    ctx.commands.register('view.cloneToNextGroup', (id) => clone(id, 'next'), {
      title: 'Cloner dans la vue suivante',
      category: 'Affichage',
    });
    ctx.commands.register('view.moveToNextGroup', (id) => move(id, 'next'), {
      title: 'Déplacer vers la vue suivante',
      category: 'Affichage',
    });
    ctx.commands.register('view.moveToPreviousGroup', (id) => move(id, 'previous'), {
      title: 'Déplacer vers la vue précédente',
      category: 'Affichage',
    });
    ctx.commands.register(
      'view.toggleSplitOrientation',
      () => ctx.workspace.setOrientation(ctx.workspace.orientation() === 'row' ? 'column' : 'row'),
      { title: 'Vues côte à côte / empilées', category: 'Affichage' },
    );
    for (let n = 1; n <= 4; n++) {
      ctx.commands.register(`view.focusGroup${n}`, () => ctx.workspace.focusGroup(n - 1), {
        title: `Aller à la vue ${n}`,
        category: 'Affichage',
      });
    }

    ctx.keybindings.register([
      { key: 'Ctrl+\\', command: 'view.cloneToNextGroup' },
      // "\" needs AltGr on AZERTY, so the leader also gives both commands on plain keys.
      { key: 'Leader Shift+S', command: 'view.toggleSplitOrientation' },
      { key: 'Leader S', command: 'view.cloneToNextGroup' },
      { key: 'Ctrl+Alt+Right', command: 'view.moveToNextGroup' },
      { key: 'Ctrl+Alt+Left', command: 'view.moveToPreviousGroup' },
      { key: 'Leader \\', command: 'view.toggleSplitOrientation' },
      ...[1, 2, 3, 4].map((n) => ({ key: `Ctrl+${n}`, command: `view.focusGroup${n}` })),
    ]);

    ctx.menus.registerItem('view', {
      command: 'view.cloneToNextGroup',
      group: '5_split',
      order: 1,
    });
    ctx.menus.registerItem('view', { command: 'view.moveToNextGroup', group: '5_split', order: 2 });
    ctx.menus.registerItem('view', {
      command: 'view.moveToPreviousGroup',
      group: '5_split',
      order: 3,
    });
    ctx.menus.registerItem('view', {
      command: 'view.toggleSplitOrientation',
      group: '5_split',
      order: 4,
    });
  },
});
