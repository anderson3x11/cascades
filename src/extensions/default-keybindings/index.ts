import { defineExtension, t, type KeybindingSpec } from '../../api';

const EDITOR = 'editorFocus';

/** Default shortcuts. User bindings registered later take precedence. */
export const DEFAULT_KEYBINDINGS: KeybindingSpec[] = [
  { key: 'Mod+N', command: 'file.new' },
  { key: 'Mod+O', command: 'file.open' },
  { key: 'Mod+S', command: 'file.save' },
  { key: 'Mod+Shift+S', command: 'file.saveAs' },
  { key: 'Mod+W', command: 'tabs.close' },
  { key: 'Mod+Shift+T', command: 'tabs.reopenClosed' },
  { key: 'Ctrl+Tab', command: 'tabs.next' },
  { key: 'Ctrl+Shift+Tab', command: 'tabs.previous' },
  { key: 'Mod+PageDown', command: 'tabs.next' },
  { key: 'Mod+PageUp', command: 'tabs.previous' },
  { key: 'Mod+=', command: 'view.zoomIn' },
  { key: 'Mod++', command: 'view.zoomIn' },
  { key: 'Mod+-', command: 'view.zoomOut' },
  { key: 'Mod+0', command: 'view.zoomReset' },
  { key: 'Mod+F', command: 'search.find' },
  { key: 'Mod+H', command: 'search.replace' },
  // macOS hides the app on Cmd+H: Cmd+Option+F there, as in VS Code.
  { key: 'Mod+Alt+F', command: 'search.replace' },
  { key: 'Mod+Z', command: 'editor.undo', when: EDITOR },
  { key: 'Mod+Shift+Z', command: 'editor.redo', when: EDITOR },
  // Registered last so menus show it as the main shortcut.
  { key: 'Mod+Y', command: 'editor.redo', when: EDITOR },
  { key: 'Mod+A', command: 'editor.selectAll', when: EDITOR },
  { key: 'Shift+Alt+Down', command: 'editor.duplicateLine', when: EDITOR },
  { key: 'Alt+Up', command: 'editor.moveLineUp', when: EDITOR },
  { key: 'Alt+Down', command: 'editor.moveLineDown', when: EDITOR },
  { key: 'Mod+Shift+K', command: 'editor.deleteLine', when: EDITOR },
  // "/" needs Shift on AZERTY: Ctrl+: is the same key, as in VS Code.
  { key: 'Mod+:', command: 'editor.toggleComment', when: EDITOR },
  { key: 'Mod+/', command: 'editor.toggleComment', when: EDITOR },
  { key: 'Mod+D', command: 'editor.addNextOccurrence', when: EDITOR },
  { key: 'Mod+Enter', command: 'editor.toggleTask', when: EDITOR },
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
