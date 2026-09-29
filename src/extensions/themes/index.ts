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
    };
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

    // Picker with live preview: highlighting a theme applies it, cancelling restores.
    ctx.commands.register(
      'view.selectTheme',
      async () => {
        await scan();
        const types = { light: t('light'), dark: t('dark') };
        const items = [
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
        const chosen = await ctx.quickPick.show(items, {
          placeholder: t('Choose a theme'),
          activeValue: ctx.settings.get<string>('workbench.theme'),
          onHighlight: (item) => {
            if (item.value === 'auto') select();
            else ctx.themes.apply(item.value);
          },
        });
        if (chosen === undefined) {
          select();
          return;
        }
        try {
          await ctx.settings.update('workbench.theme', chosen === 'auto' ? undefined : chosen);
        } catch (err) {
          select();
          ctx.banners.show({
            kind: 'warning',
            message: err instanceof Error ? err.message : String(err),
            actions: [{ label: 'OK', run: () => {} }],
          });
        }
      },
      { title: t('Theme…'), category: t('View') },
    );
    ctx.menus.registerItem('view', {
      command: 'view.selectTheme',
      group: '2_appearance',
      order: 1,
    });
    ctx.keybindings.register({ key: 'Leader T', command: 'view.selectTheme' });

    await scan();
  },
});
