import { defineExtension, t, type KeybindingSpec } from '../../api';

const EDITOR = 'editorFocus';

/** Default shortcuts. User bindings registered later take precedence. */
export const DEFAULT_KEYBINDINGS: KeybindingSpec[] = [
  { key: 'Ctrl+N', command: 'file.new' },
  { key: 'Ctrl+O', command: 'file.open' },
  { key: 'Ctrl+S', command: 'file.save' },
  { key: 'Ctrl+Shift+S', command: 'file.saveAs' },
  { key: 'Ctrl+W', command: 'tabs.close' },
  { key: 'Ctrl+Shift+T', command: 'tabs.reopenClosed' },
  { key: 'Ctrl+Tab', command: 'tabs.next' },
  { key: 'Ctrl+Shift+Tab', command: 'tabs.previous' },
  { key: 'Ctrl+PageDown', command: 'tabs.next' },
  { key: 'Ctrl+PageUp', command: 'tabs.previous' },
  { key: 'Ctrl+=', command: 'view.zoomIn' },
  { key: 'Ctrl++', command: 'view.zoomIn' },
  { key: 'Ctrl+-', command: 'view.zoomOut' },
  { key: 'Ctrl+0', command: 'view.zoomReset' },
  { key: 'Ctrl+F', command: 'search.find' },
  { key: 'Ctrl+H', command: 'search.replace' },
  { key: 'Ctrl+Z', command: 'editor.undo', when: EDITOR },
  { key: 'Ctrl+Shift+Z', command: 'editor.redo', when: EDITOR },
  // Registered last so menus show it as the main shortcut.
  { key: 'Ctrl+Y', command: 'editor.redo', when: EDITOR },
  { key: 'Ctrl+A', command: 'editor.selectAll', when: EDITOR },
  { key: 'Shift+Alt+Down', command: 'editor.duplicateLine', when: EDITOR },
  { key: 'Alt+Up', command: 'editor.moveLineUp', when: EDITOR },
  { key: 'Alt+Down', command: 'editor.moveLineDown', when: EDITOR },
  { key: 'Ctrl+Shift+K', command: 'editor.deleteLine', when: EDITOR },
  // "/" needs Shift on AZERTY: Ctrl+: is the same key, as in VS Code.
  { key: 'Ctrl+:', command: 'editor.toggleComment', when: EDITOR },
  { key: 'Ctrl+/', command: 'editor.toggleComment', when: EDITOR },
  { key: 'Ctrl+D', command: 'editor.addNextOccurrence', when: EDITOR },
  { key: 'Ctrl+Enter', command: 'editor.toggleTask', when: EDITOR },
];

export default defineExtension({
  id: 'cascades.default-keybindings',
  activate(ctx) {
    ctx.settings.register('keyboard', {
      leader: {
        type: 'string',
        default: 'Ctrl+Space',
        description: t('Leader key: "Leader X" shortcuts are this key, then X (as in Vim).'),
      },
    });

    let warning: { dispose(): void } | null = null;
    const applyLeader = () => {
      warning?.dispose();
      warning = null;
      const key = ctx.settings.get<string>('keyboard.leader');
      try {
        ctx.keybindings.setLeader(key);
      } catch (err) {
        ctx.keybindings.setLeader('Ctrl+Space');
        warning = ctx.banners.show({
          kind: 'warning',
          message: t('Invalid leader key "{key}", Ctrl+Space is used instead. ({problem})', {
            key,
            problem: err instanceof Error ? err.message : String(err),
          }),
          actions: [{ label: t('OK'), run: () => {} }],
        });
      }
    };
    applyLeader();
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('keyboard.leader')) applyLeader();
    });

    ctx.keybindings.register(DEFAULT_KEYBINDINGS);
  },
});
