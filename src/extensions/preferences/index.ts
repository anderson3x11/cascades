import { defineExtension, type ExtensionContext } from '../../api';
import type { ConfigFileName } from './assist';
import { configFileAssist } from './editor-assist';

/** Path form for comparisons: Windows paths ignore case and separator style. */
const samePath = (path: string) => path.replace(/\\/g, '/').toLowerCase();

const SETTINGS_TEMPLATE = `// Réglages personnels : ils remplacent les valeurs par défaut.
// Un bloc "[markdown]": { … } ne vaut que pour les fichiers de ce langage.
{
}
`;

const KEYBINDINGS_TEMPLATE = `// Raccourcis personnels : ils s'ajoutent à ceux par défaut, ou les remplacent.
//   { "key": "Ctrl+Shift+N", "command": "file.new" }
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

    // Help while editing the files themselves.
    let files = new Map<string, ConfigFileName>();
    const handle = ctx.editor.addExtension((tab) => {
      const file = tab.path ? files.get(samePath(tab.path)) : undefined;
      return file ? configFileAssist(ctx, file) : [];
    });
    const names: ConfigFileName[] = ['settings.json', 'keybindings.json'];
    void Promise.all(
      names.map(async (name) => [samePath(await ctx.configFiles.path(name)), name] as const),
    ).then((entries) => {
      files = new Map(entries);
      handle.refresh();
    });
  },
});
