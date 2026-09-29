import { defineExtension, t } from '../../api';

/** Command palette: every command, searchable, with its shortcut. */
export default defineExtension({
  id: 'cascades.palette',
  activate(ctx) {
    ctx.commands.register(
      'workbench.commandPalette',
      async () => {
        const items = ctx.commands
          .list()
          .filter((c) => c.title && !c.hidden && c.id !== 'workbench.commandPalette')
          .map((c) => ({
            label: c.category ? `${c.category} : ${c.title ?? c.id}` : (c.title ?? c.id),
            description: ctx.keybindings.label(c.id) ?? '',
            value: c.id,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        const id = await ctx.quickPick.show(items, { placeholder: t('Search for a command') });
        if (id) await ctx.commands.execute(id);
      },
      { title: t('Command palette…'), category: t('View') },
    );
    ctx.keybindings.register([
      { key: 'Mod+Shift+P', command: 'workbench.commandPalette' },
      { key: 'Leader P', command: 'workbench.commandPalette' },
    ]);
    ctx.menus.registerItem('view', {
      command: 'workbench.commandPalette',
      group: '0_palette',
      order: 0,
    });
  },
});
