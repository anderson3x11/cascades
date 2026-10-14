import { mount, unmount } from 'svelte';
import { defineExtension, samePath, t, type Disposable, type ExtensionContext } from '../../api';
import type { ConfigFileName } from './assist';
import { configFileAssist } from './editor-assist';
import PreferencesView, { type PreferencesPage } from './PreferencesView.svelte';
import { isEmpty, keybindingsTemplate, settingsTemplate } from './templates';

/** Path form for comparisons: Windows paths ignore case and separator style. */

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
    ctx.keybindings.register({ key: 'Mod+,', command: 'preferences.open' });
    ctx.menus.registerMenu({ id: 'settings', title: t('Settings'), order: 40 });
    ctx.menus.registerGroup('settings', {
      id: '0_palette',
      title: t('Commands'),
      icon: 'M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3',
    });
    ctx.menus.registerGroup('settings', {
      id: '8_preferences',
      title: t('Preferences'),
      icon: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
    });
    ctx.panels.register({
      id: 'settings',
      title: t('Settings'),
      side: 'left',
      icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
      order: 90,
      place: 'rail',
      menus: ['settings'],
    });
    ctx.menus.registerItem('settings', {
      command: 'preferences.openExtensions',
      group: '8_preferences',
      order: 0.7,
    });
    ctx.menus.registerItem('settings', {
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
    ctx.menus.registerItem('settings', {
      command: 'preferences.openShortcuts',
      group: '8_preferences',
      order: 0.5,
    });
    ctx.menus.registerItem('settings', {
      command: 'preferences.openSettingsFile',
      group: '8_preferences',
      order: 1,
    });
    ctx.menus.registerItem('settings', {
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
