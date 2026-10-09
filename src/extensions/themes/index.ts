import { defineExtension, t, type Disposable } from '../../api';
import { pickTheme } from './pick';
import { builtinThemes } from './builtin';

const USER_FOLDER = 'themes';

/**
 * Registers the built-in themes and the user's (config folder, "themes/*.json",
 * reloaded on save), and applies the one the settings ask for.
 */
export default defineExtension({
  id: 'cascades.themes',
  async activate(ctx) {
    for (const theme of builtinThemes()) ctx.themes.register(theme);

    ctx.settings.register('workbench', {
      theme: {
        type: 'string',
        default: 'auto',
        description: t(
          'Theme: "auto" follows the light or dark mode of the system, or else a theme id.',
        ),
      },
      themeLight: {
        type: 'string',
        default: 'light',
        description: t('Theme used in auto mode when the system is light.'),
      },
      themeDark: {
        type: 'string',
        default: 'dark',
        description: t('Theme used in auto mode when the system is dark.'),
      },
    });

    const osDark = window.matchMedia('(prefers-color-scheme: dark)');
    const select = () => {
      const get = (key: string) => ctx.settings.get<string>(`workbench.${key}`);
      const id = pickTheme(get('theme'), osDark.matches, get('themeLight'), get('themeDark'));
      // An unknown id (deleted user theme, typo) falls back to the base palette.
      if (!ctx.themes.apply(id)) ctx.themes.apply(osDark.matches ? 'dark' : 'light');
      status.text = ctx.themes.current()?.name ?? '';
    };
    const status = ctx.statusBar.addItem({
      id: 'theme',
      alignment: 'center',
      priority: 10,
      label: t('Theme'),
      icon: 'M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8zM13.5 6.5h.01M17.5 10.5h.01M8.5 7.5h.01M6.5 12.5h.01',
      menu: () => {
        const current = ctx.settings.get<string>('workbench.theme');
        const items = choices();
        const auto = items[0];
        return {
          items: [...(auto ? [auto, 'separator' as const] : []), ...items.slice(1)].map((item) =>
            item === 'separator'
              ? item
              : {
                  label: item.label,
                  checked: item.value === current,
                  preview: () => preview(item.value),
                  run: () => void choose(item.value),
                },
          ),
          onCancel: select,
        };
      },
    });
    status.tooltip = t('Theme');
    osDark.addEventListener('change', select);
    ctx.subscriptions.add({ dispose: () => osDark.removeEventListener('change', select) });
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('workbench.theme'))) select();
    });

    // User themes -------------------------------------------------------------
    const userThemes = new Map<string, { theme: Disposable; watch: Disposable }>();
    const errors = new Map<string, Disposable>();

    const load = async (file: string) => {
      const id = `user.${file.replace(/\.json$/, '')}`;
      errors.get(file)?.dispose();
      errors.delete(file);
      try {
        const json = await ctx.configFiles.read(`${USER_FOLDER}/${file}`);
        if (json === null) return;
        const theme = ctx.themes.register(ctx.themes.parse(id, json));
        const entry = userThemes.get(file);
        if (entry) entry.theme = theme;
      } catch (err) {
        errors.set(
          file,
          ctx.banners.show({
            kind: 'warning',
            message: t('Theme "{file}" ignored: {problem}', {
              file,
              problem: err instanceof Error ? err.message : String(err),
            }),
            actions: [{ label: t('OK'), run: () => {} }],
          }),
        );
      }
    };

    /** Loads new theme files and forgets deleted ones. */
    const scan = async () => {
      const files = (await ctx.configFiles.list(USER_FOLDER).catch(() => [])).filter((f) =>
        f.endsWith('.json'),
      );
      for (const [file, entry] of userThemes) {
        if (files.includes(file)) continue;
        entry.theme.dispose();
        entry.watch.dispose();
        userThemes.delete(file);
      }
      for (const file of files) {
        if (userThemes.has(file)) continue;
        userThemes.set(file, {
          theme: { dispose() {} },
          watch: ctx.configFiles.watch(`${USER_FOLDER}/${file}`, () => {
            void load(file).then(select);
          }),
        });
        await load(file);
      }
      select();
    };

    ctx.commands.register('themes.reload', scan, {
      title: t('Reload the themes'),
      category: t('View'),
    });

    /** "Automatic" then every theme, for the picker and the status bar menu. */
    const choices = () => {
      const types = { light: t('light'), dark: t('dark') };
      return [
        {
          label: t('Automatic'),
          description: t('follows the mode of the system'),
          value: 'auto',
        },
        ...ctx.themes.list().map((theme) => {
          const type = theme.name.toLowerCase() === types[theme.type] ? '' : types[theme.type];
          const user = theme.id.startsWith('user.') ? t('custom') : '';
          return {
            label: theme.name,
            description: [type, user].filter(Boolean).join(', '),
            value: theme.id,
          };
        }),
      ];
    };
    const preview = (id: string) => {
      if (id === 'auto') select();
      else ctx.themes.apply(id);
    };
    const choose = async (id: string) => {
      try {
        await ctx.settings.update('workbench.theme', id === 'auto' ? undefined : id);
      } catch (err) {
        select();
        ctx.banners.show({
          kind: 'warning',
          message: err instanceof Error ? err.message : String(err),
          actions: [{ label: 'OK', run: () => {} }],
        });
      }
    };

    // Picker with live preview: highlighting a theme applies it, cancelling restores.
    ctx.commands.register(
      'view.selectTheme',
      async () => {
        await scan();
        const chosen = await ctx.quickPick.show(choices(), {
          placeholder: t('Choose a theme'),
          activeValue: ctx.settings.get<string>('workbench.theme'),
          onHighlight: (item) => preview(item.value),
        });
        if (chosen === undefined) select();
        else await choose(chosen);
      },
      { title: t('Theme…'), category: t('View') },
    );
    ctx.menus.registerItem('view', {
      command: 'view.selectTheme',
      group: '2_appearance',
      order: 1,
    });
    ctx.keybindings.register({ key: 'Leader T', command: 'view.selectTheme' });

    ctx.commands.register(
      'view.toggleLightDark',
      () => {
        const dark = ctx.themes.current()?.type === 'dark';
        return choose(
          ctx.settings.get<string>(dark ? 'workbench.themeLight' : 'workbench.themeDark'),
        );
      },
      { title: t('Switch between light and dark'), category: t('View') },
    );

    await scan();
  },
});
