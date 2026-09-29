import { defineExtension, t } from '../../api';

/**
 * Built-in viewers. Each one is a separate module, loaded the first time a
 * preview needs it, so none of them slows down startup.
 */
export default defineExtension({
  id: 'cascades.viewers',
  activate(ctx) {
    ctx.settings.register('preview', {
      fontFamily: {
        type: 'string',
        default: "system-ui, 'Segoe UI', sans-serif",
        description: t('Font of the previews (Markdown, HTML).'),
      },
      fontSize: { type: 'number', default: 15, description: t('Font size of the previews (px).') },
      htmlScripts: {
        type: 'boolean',
        default: false,
        description: t('Run the scripts of previewed HTML pages (always kept apart from the app).'),
      },
    });
    const applyFont = () => {
      ctx.layout.setStyle('font-preview', ctx.settings.get<string>('preview.fontFamily'));
      ctx.layout.setStyle('font-preview-size', `${ctx.settings.get<number>('preview.fontSize')}px`);
    };
    applyFont();
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('preview.'))) applyFont();
    });

    ctx.viewers.register({
      id: 'markdown',
      title: 'Markdown',
      extensions: ['md', 'markdown', 'mdown', 'mkd'],
      languages: ['markdown'],
      kind: 'preview',
      load: async () =>
        (await import('./markdown')).createMarkdownViewer({
          highlightCode: ctx.editor.highlightCode,
          fileUrl: ctx.fs.fileUrl,
          openExternal: ctx.app.openExternal,
          openFile: async (path) => {
            await ctx.commands.execute('file.openPath', path);
          },
        }),
    });

    ctx.viewers.register({
      id: 'html',
      title: 'HTML',
      extensions: ['html', 'htm', 'xhtml'],
      languages: ['html'],
      kind: 'preview',
      load: async () =>
        (await import('./html')).createHtmlViewer({
          fileUrl: ctx.fs.fileUrl,
          scriptsAllowed: () => ctx.settings.get<boolean>('preview.htmlScripts'),
          openExternal: ctx.app.openExternal,
          openFile: async (path) => {
            await ctx.commands.execute('file.openPath', path);
          },
          watch: ctx.fs.watch,
        }),
    });

    ctx.viewers.register({
      id: 'image',
      title: 'Image',
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif'],
      kind: 'replace',
      load: async () =>
        (await import('./image')).createImageViewer(({ path }) =>
          path ? ctx.fs.fileUrl(path) : Promise.resolve(''),
        ),
    });
    ctx.viewers.register({
      id: 'pdf',
      title: 'PDF',
      extensions: ['pdf'],
      kind: 'replace',
      load: async () => (await import('./pdf')).createPdfViewer((path) => ctx.fs.readBinary(path)),
    });
    ctx.viewers.register({
      id: 'hex',
      title: t('Hexadecimal'),
      extensions: [],
      kind: 'replace',
      binary: true,
      load: async () =>
        (await import('./hex')).createHexViewer({
          size: (path) => ctx.fs.fileSize(path),
          read: (path, range) => ctx.fs.readBinary(path, range),
        }),
    });
    ctx.viewers.register({
      id: 'svg',
      title: 'SVG',
      extensions: ['svg'],
      kind: 'preview',
      load: async () =>
        (await import('./image')).createImageViewer(({ text }) =>
          Promise.resolve(URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))),
        ),
    });

    ctx.viewers.register({
      id: 'csv',
      title: t('Table'),
      extensions: ['csv'],
      kind: 'preview',
      load: async () => (await import('./table')).createTableViewer(),
    });
    ctx.viewers.register({
      id: 'tsv',
      title: t('Table'),
      extensions: ['tsv', 'tab'],
      kind: 'preview',
      load: async () => (await import('./table')).createTableViewer('\t'),
    });

    ctx.viewers.register({
      id: 'json',
      title: 'JSON',
      extensions: ['json', 'jsonc', 'geojson'],
      languages: ['json'],
      kind: 'preview',
      load: async () => (await import('./json')).jsonViewer,
    });
  },
});
