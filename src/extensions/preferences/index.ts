import { mount, unmount } from 'svelte';
import { defineExtension, t, type Disposable, type ExtensionContext } from '../../api';
import type { ConfigFileName } from './assist';
import { configFileAssist } from './editor-assist';
import PreferencesView, { type PreferencesPage } from './PreferencesView.svelte';
import { isEmpty, keybindingsTemplate, settingsTemplate } from './templates';

/** Path form for comparisons: Windows paths ignore case and separator style. */
const samePath = (path: string) => path.replace(/\\/g, '/').toLowerCase();

/**
 * Opens a file of the config folder in a tab. A missing or still empty file
 * first gets a template explaining how to fill it.
 */
async function openConfigFile(ctx: ExtensionContext, name: string, template: string) {
  if (isEmpty(await ctx.configFiles.read(name))) await ctx.configFiles.write(name, template);
  await ctx.commands.execute('file.openPath', await ctx.configFiles.path(name));
}

export default defineExtension({
  id: 'cascades.preferences',
  activate(ctx) {
    let modal: Disposable | null = null;
    const open = (page: PreferencesPage) => {
      modal = ctx.modals.show({
        title: t('Preferences'),
        render(host) {
          const view = mount(PreferencesView, {
            target: host,
            props: {
              ctx,
              page,
              runAndClose: (command: string) => {
                modal?.dispose();
                void ctx.commands.execute(command);
              },
            },
          });
          return { dispose: () => void unmount(view) };
        },
      });
    };
    ctx.commands.register('preferences.open', () => open('settings'), {
      title: t('Preferences…'),
      category: t('Preferences'),
    });
    ctx.commands.register('preferences.openShortcuts', () => open('shortcuts'), {
      title: t('Keyboard shortcuts…'),
      category: t('Preferences'),
    });
    ctx.commands.register('preferences.openExtensions', () => open('extensions'), {
      title: t('Extensions…'),
      category: t('Preferences'),
    });
    ctx.keybindings.register({ key: 'Ctrl+,', command: 'preferences.open' });
    ctx.menus.registerItem('file', {
      command: 'preferences.open',
      group: '8_preferences',
      order: 0,
    });

    ctx.commands.register(
      'preferences.openSettingsFile',
      () => openConfigFile(ctx, 'settings.json', settingsTemplate()),
      { title: t('Open {file}', { file: 'settings.json' }), category: t('Preferences') },
    );
    ctx.commands.register(
      'preferences.openKeybindingsFile',
      () => openConfigFile(ctx, 'keybindings.json', keybindingsTemplate()),
      { title: t('Open {file}', { file: 'keybindings.json' }), category: t('Preferences') },
    );
    ctx.menus.registerItem('file', {
      command: 'preferences.openShortcuts',
      group: '8_preferences',
      order: 0.5,
    });
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
