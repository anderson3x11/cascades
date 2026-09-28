import { defineExtension } from '../../api';

/**
 * Built-in viewers. Each one is a separate module, loaded the first time a
 * preview needs it, so none of them slows down startup.
 */
export default defineExtension({
  id: 'cascades.viewers',
  activate(ctx) {
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
