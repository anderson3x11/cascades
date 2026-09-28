import { defineExtension, type ExtensionContext } from '../../api';

const SETTINGS_TEMPLATE = `// Réglages personnels : ils remplacent les valeurs par défaut.
// Un bloc "[markdown]": { … } ne vaut que pour les fichiers de ce langage.
{
}
`;

const KEYBINDINGS_TEMPLATE = `// Raccourcis personnels : ils s'ajoutent à ceux par défaut, ou les remplacent.
//   { "key": "Ctrl+Alt+N", "command": "file.new" }
// Un "-" devant la commande retire un raccourci par défaut :
//   { "key": "Ctrl+D", "command": "-editor.addNextOccurrence" }
[
]
`;

/** Opens a file of the config folder in a tab, creating it from a template first. */
async function openConfigFile(ctx: ExtensionContext, name: string, template: string) {
  if ((await ctx.configFiles.read(name)) === null) await ctx.configFiles.write(name, template);
  await ctx.commands.execute('file.openPath', await ctx.configFiles.path(name));
}

export default defineExtension({
  id: 'cascades.preferences',
  activate(ctx) {
    ctx.commands.register(
      'preferences.openSettingsFile',
      () => openConfigFile(ctx, 'settings.json', SETTINGS_TEMPLATE),
      { title: 'Ouvrir settings.json', category: 'Préférences' },
    );
    ctx.commands.register(
      'preferences.openKeybindingsFile',
      () => openConfigFile(ctx, 'keybindings.json', KEYBINDINGS_TEMPLATE),
      { title: 'Ouvrir keybindings.json', category: 'Préférences' },
    );
    ctx.menus.registerItem('file', {
      command: 'preferences.openSettingsFile',
      group: '8_preferences',
      order: 1,
    });
    ctx.menus.registerItem('file', {
      command: 'preferences.openKeybindingsFile',
      group: '8_preferences',
      order: 2,
    });
  },
});
