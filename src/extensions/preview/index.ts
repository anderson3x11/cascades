import { defineExtension, type PreviewMode } from '../../api';

/** Commands to show the preview of the active file beside the editor or alone. */
export default defineExtension({
  id: 'cascades.preview',
  activate(ctx) {
    const updateContext = () => {
      const tab = ctx.workspace.active();
      ctx.context.set('previewOpen', !!tab && ctx.viewers.previewMode(tab.id) !== 'off');
    };

    /** Switches between `mode` and off for the active tab. */
    const toggle = (mode: Exclude<PreviewMode, 'off'>) => {
      const tab = ctx.workspace.active();
      if (!tab || tab.viewer) return;
      if (!ctx.viewers.previewFor(tab)) {
        ctx.banners.show({
          tabId: tab.id,
          message: `Pas d’aperçu pour « ${tab.title} ».`,
          actions: [{ label: 'OK', run: () => {} }],
        });
        return;
      }
      const current = ctx.viewers.previewMode(tab.id);
      ctx.viewers.setPreviewMode(tab.id, current === mode ? 'off' : mode);
      updateContext();
    };

    ctx.commands.register('view.togglePreview', () => toggle('side'), {
      title: 'Aperçu à côté',
      category: 'Affichage',
    });
    ctx.commands.register('view.togglePreviewFull', () => toggle('full'), {
      title: 'Aperçu seul',
      category: 'Affichage',
    });
    ctx.keybindings.register([
      { key: 'Ctrl+Shift+V', command: 'view.togglePreview' },
      { key: 'Leader V', command: 'view.togglePreview' },
      { key: 'Leader Shift+V', command: 'view.togglePreviewFull' },
    ]);
    ctx.menus.registerItem('view', { command: 'view.togglePreview', group: '1_preview', order: 1 });
    ctx.menus.registerItem('view', {
      command: 'view.togglePreviewFull',
      group: '1_preview',
      order: 2,
    });

    ctx.events.on('workspace.didChangeActive', updateContext);
    ctx.events.on('workspace.didClose', (tab) => ctx.viewers.setPreviewMode(tab.id, 'off'));
  },
});
