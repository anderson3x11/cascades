import { defineExtension, type Disposable } from '../../api';
import { pickTheme } from './pick';
import { BUILTIN_THEMES } from './builtin';

const USER_FOLDER = 'themes';

/**
 * Registers the built-in themes and the user's (config folder, "themes/*.json",
 * reloaded on save), and applies the one the settings ask for.
 */
export default defineExtension({
  id: 'cascades.themes',
  async activate(ctx) {
    for (const theme of BUILTIN_THEMES) ctx.themes.register(theme);

    ctx.settings.register('workbench', {
      theme: {
        type: 'string',
        default: 'auto',
        description:
          'Thème : "auto" suit le mode clair ou sombre du système, sinon un id de thème.',
      },
      themeLight: {
        type: 'string',
        default: 'light',
        description: 'Thème utilisé en mode auto quand le système est clair.',
      },
      themeDark: {
        type: 'string',
        default: 'dark',
        description: 'Thème utilisé en mode auto quand le système est sombre.',
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
            message: `Thème « ${file} » ignoré : ${err instanceof Error ? err.message : String(err)}`,
            actions: [{ label: 'OK', run: () => {} }],
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
      title: 'Recharger les thèmes',
      category: 'Affichage',
    });

    await scan();
  },
});
