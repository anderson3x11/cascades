import { parse } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';
import {
  isCustomized,
  removeShortcut,
  resetCommand,
  setShortcut,
  type Shortcut,
} from './keybindings-edit';

const entries = (text: string) => parse(text) as unknown[];
const saveDefault: Shortcut = {
  key: 'Ctrl+S',
  command: 'file.save',
  when: undefined,
  source: 'default',
};

describe('keybindings.json edits', () => {
  it('replaces a default shortcut with a removal rule and the new key', () => {
    const text = setShortcut('[\n  // mes raccourcis\n]\n', 'file.save', 'Ctrl+Alt+S', saveDefault);
    expect(text).toContain('// mes raccourcis');
    expect(entries(text)).toEqual([
      { key: 'Ctrl+S', command: '-file.save' },
      { key: 'Ctrl+Alt+S', command: 'file.save' },
    ]);
  });

  it('edits the entry of a user shortcut in place of adding rules', () => {
    const user: Shortcut = {
      key: 'Ctrl+Alt+S',
      command: 'file.save',
      when: undefined,
      source: 'user',
    };
    const text = '[{ "key": "Ctrl+Alt+S", "command": "file.save" }]';
    expect(entries(setShortcut(text, 'file.save', 'F2', user))).toEqual([
      { key: 'F2', command: 'file.save' },
    ]);
    expect(entries(removeShortcut(text, user))).toEqual([]);
  });

  it('keeps the when clause of the replaced shortcut', () => {
    const undo: Shortcut = {
      key: 'Ctrl+Z',
      command: 'editor.undo',
      when: 'editorFocus',
      source: 'default',
    };
    expect(entries(setShortcut('[]', 'editor.undo', 'Alt+Z', undo))[1]).toEqual({
      key: 'Alt+Z',
      command: 'editor.undo',
      when: 'editorFocus',
    });
  });

  it('starts a missing file from the template', () => {
    const text = setShortcut(null, 'file.new', 'Ctrl+Shift+N');
    expect(text).toContain('// Personal shortcuts');
    expect(entries(text)).toEqual([{ key: 'Ctrl+Shift+N', command: 'file.new' }]);
  });

  it('resets a command and tells whether it was changed', () => {
    const text = setShortcut('[]', 'file.save', 'Ctrl+Alt+S', saveDefault);
    expect(isCustomized(text, 'file.save')).toBe(true);
    const reset = resetCommand(text, 'file.save');
    expect(entries(reset)).toEqual([]);
    expect(isCustomized(reset, 'file.save')).toBe(false);
  });

  it('refuses to touch a file with a mistake', () => {
    expect(() => setShortcut('[ { ]', 'file.new', 'F2')).toThrow(/fix it/);
  });
});
