import { defineExtension, t, type GroupTarget } from '../../api';

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
      title: t('Clone to the next view'),
      category: t('View'),
    });
    ctx.commands.register('view.moveToNextGroup', (id) => move(id, 'next'), {
      title: t('Move to the next view'),
      category: t('View'),
    });
    ctx.commands.register('view.moveToPreviousGroup', (id) => move(id, 'previous'), {
      title: t('Move to the previous view'),
      category: t('View'),
    });
    ctx.commands.register(
      'view.toggleSplitOrientation',
      () => ctx.workspace.setOrientation(ctx.workspace.orientation() === 'row' ? 'column' : 'row'),
      { title: t('Views side by side / stacked'), category: t('View') },
    );
    ctx.commands.register(
      'view.joinGroups',
      () => {
        const [first, ...others] = ctx.workspace.groups();
        if (!first) return;
        const active = ctx.workspace.active()?.documentId;
        // A tab whose document is already in the first view just closes there (moveToGroup does it).
        for (const group of others) {
          for (const tab of [...group.tabs]) ctx.workspace.moveToGroup(tab.id, first.id);
        }
        const keep = ctx.workspace.tabs().find((t) => t.documentId === active);
        if (keep) ctx.workspace.activate(keep.id);
      },
      { title: t('Join all views'), category: t('View') },
    );

    for (let n = 1; n <= 4; n++) {
      ctx.commands.register(`view.focusGroup${n}`, () => ctx.workspace.focusGroup(n - 1), {
        title: t('Go to view {number}', { number: n }),
        category: t('View'),
      });
    }

    ctx.keybindings.register([
      { key: 'Mod+\\', command: 'view.cloneToNextGroup' },
      // "\" needs AltGr on AZERTY, so the leader also gives both commands on plain keys.
      { key: 'Leader Shift+S', command: 'view.toggleSplitOrientation' },
      { key: 'Leader S', command: 'view.cloneToNextGroup' },
      { key: 'Leader J', command: 'view.joinGroups' },
      { key: 'Mod+Alt+Right', command: 'view.moveToNextGroup' },
      { key: 'Mod+Alt+Left', command: 'view.moveToPreviousGroup' },
      { key: 'Leader \\', command: 'view.toggleSplitOrientation' },
      ...[1, 2, 3, 4].map((n) => ({ key: `Mod+${n}`, command: `view.focusGroup${n}` })),
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
    ctx.menus.registerItem('view', { command: 'view.joinGroups', group: '5_split', order: 5 });
    ctx.menus.registerItem('view', {
      command: 'view.toggleSplitOrientation',
      group: '5_split',
      order: 4,
    });
  },
});
