import { defineExtension, t } from '../../api';
import { countChars, countWords } from './counts';

const COUNT_DELAY_MS = 200;

/** "2.4 MB", "830 KB", "12 bytes", with the number written for `locale`. */
export function formatSize(bytes: number, locale = 'en'): string {
  const units: [number, (size: string) => string][] = [
    [1024 ** 3, (size) => t('{size} GB', { size })],
    [1024 ** 2, (size) => t('{size} MB', { size })],
    [1024, (size) => t('{size} KB', { size })],
  ];
  for (const [unit, name] of units) {
    if (bytes >= unit) {
      const value = bytes / unit;
      return name(value.toLocaleString(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }));
    }
  }
  return bytes === 1 ? t('1 byte') : t('{count} bytes', { count: bytes });
}

export default defineExtension({
  id: 'cascades.status-bar',
  activate(ctx) {
    const position = ctx.statusBar.addItem({ id: 'position', alignment: 'left', priority: 100 });
    const counts = ctx.statusBar.addItem({ id: 'counts', alignment: 'left', priority: 90 });
    const language = ctx.statusBar.addItem({
      id: 'language',
      alignment: 'right',
      priority: 30,
      command: 'editor.changeLanguage',
    });
    language.tooltip = t('Change the language');
    const encoding = ctx.statusBar.addItem({
      id: 'encoding',
      alignment: 'right',
      priority: 20,
      command: 'file.changeEncoding',
    });
    encoding.tooltip = t('Change the encoding');
    const eol = ctx.statusBar.addItem({
      id: 'eol',
      alignment: 'right',
      priority: 10,
      command: 'file.changeLineEnding',
    });
    eol.tooltip = t('Change the line endings');
    /** Size of a file shown by a viewer (PDF, image, hex), instead of the text details. */
    const size = ctx.statusBar.addItem({ id: 'size', alignment: 'left', priority: 100 });
    const textItems = [position, counts, encoding, eol];

    const updatePosition = () => {
      const state = ctx.editor.state();
      if (!state) return;
      const main = state.selection.main;
      const line = state.doc.lineAt(main.head);
      const selected = state.selection.ranges.reduce((n, r) => n + (r.to - r.from), 0);
      position.text =
        t('Ln {line}, Col {column}', { line: line.number, column: main.head - line.from + 1 }) +
        (selected > 0 ? ` ${t('({count} selected)', { count: selected })}` : '') +
        (state.selection.ranges.length > 1
          ? ` · ${t('{count} cursors', { count: state.selection.ranges.length })}`
          : '');
    };

    // Counting walks the whole document, so it is debounced.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const updateCounts = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const state = ctx.editor.state();
        if (!state || ctx.workspace.active()?.large) return;
        const text = state.doc.toString();
        counts.text = t('{words} words, {characters} characters', {
          words: countWords(text),
          characters: countChars(text),
        });
      }, COUNT_DELAY_MS);
    };
    ctx.subscriptions.add({ dispose: () => clearTimeout(timer) });

    let sizeRun = 0;
    const updateFile = () => {
      const tab = ctx.workspace.active();
      if (!tab) return;
      const viewer = tab.viewer ? ctx.viewers.get(tab.viewer) : undefined;
      for (const item of textItems) item.visible = !viewer;
      // Counting a big file's words at each change would slow typing down.
      counts.visible = !viewer && !tab.large;
      size.visible = !!viewer;
      if (viewer) {
        language.text = viewer.title;
        const run = ++sizeRun;
        size.text = '';
        if (tab.path) {
          void ctx.fs
            .fileSize(tab.path)
            .then((bytes) => {
              if (run === sizeRun) size.text = formatSize(bytes, ctx.i18n.language());
            })
            .catch(() => {});
        }
        return;
      }
      language.text = tab.language;
      encoding.text = tab.encoding.toUpperCase() + (tab.bom ? ' BOM' : '');
      eol.text = tab.lineEnding.toUpperCase();
    };

    const updateAll = () => {
      updatePosition();
      updateCounts();
      updateFile();
    };

    ctx.events.on('editor.didUpdate', ({ docChanged }) => {
      updatePosition();
      if (docChanged) updateCounts();
    });
    ctx.events.on('workspace.didChangeActive', updateAll);
    ctx.events.on('workspace.didChangeTab', (tab) => {
      if (tab.id === ctx.workspace.active()?.id) updateFile();
    });
    updateAll();

    ctx.commands.register(
      'editor.changeLanguage',
      async () => {
        const tab = ctx.workspace.active();
        if (!tab || tab.viewer) return;
        const names = ctx.workspace.availableLanguages();
        const current = names.find((n) => n.toLowerCase() === tab.language) ?? null;
        const choice = await ctx.quickPick.show<{ name: string | null }>(
          [
            {
              label: t('Detect automatically'),
              description: t('from the name and the start of the file'),
              value: { name: null },
            },
            { label: t('Plain text'), description: t('no colors'), value: { name: 'plaintext' } },
            ...names.map((name) => ({ label: name, value: { name } })),
          ],
          {
            placeholder: t('Current language: {language}', {
              language: current ?? t('plain text'),
            }),
          },
        );
        if (choice) ctx.workspace.setLanguage(tab.id, choice.name);
      },
      { title: t('Change the language…'), category: t('View') },
    );
  },
});
