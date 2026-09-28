import { defineExtension } from '../../api';

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
        description: 'Police des aperçus (Markdown, HTML).',
      },
      fontSize: { type: 'number', default: 15, description: 'Taille de police des aperçus (px).' },
      htmlScripts: {
        type: 'boolean',
        default: false,
        description:
          'Exécuter les scripts des pages HTML prévisualisées (toujours isolées de l’application).',
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
        }),
    });

    ctx.viewers.register({
      id: 'csv',
      title: 'Tableau',
      extensions: ['csv'],
      kind: 'preview',
      load: async () => (await import('./table')).createTableViewer(),
    });
    ctx.viewers.register({
      id: 'tsv',
      title: 'Tableau',
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
