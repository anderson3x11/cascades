import { defineExtension, type KeybindingSpec } from '../../api';

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
  { key: 'Ctrl+/', command: 'editor.toggleComment', when: EDITOR },
  { key: 'Ctrl+D', command: 'editor.addNextOccurrence', when: EDITOR },
];

export default defineExtension({
  id: 'cascades.default-keybindings',
  activate(ctx) {
    ctx.keybindings.register(DEFAULT_KEYBINDINGS);
  },
});
