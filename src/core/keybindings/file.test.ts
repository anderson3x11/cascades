import { describe, expect, it } from 'vitest';
import { parseKeybindings } from './file';

describe('parseKeybindings', () => {
  it('reads the VS Code format, comments included', () => {
    const text = `[
      // Mes raccourcis
      { "key": "Ctrl+Alt+N", "command": "file.new" },
      { "key": "Ctrl+D", "command": "-editor.addNextOccurrence", "when": "editorFocus" },
      { "key": "Ctrl+1", "command": "view.focus", "args": 1 },
    ]`;
    expect(parseKeybindings(text)).toEqual({
      bindings: [
        { key: 'Ctrl+Alt+N', command: 'file.new' },
        { key: 'Ctrl+D', command: '-editor.addNextOccurrence', when: 'editorFocus' },
        { key: 'Ctrl+1', command: 'view.focus', args: [1] },
      ],
      errors: [],
    });
  });

  it('skips invalid entries and says why', () => {
    const { bindings, errors } = parseKeybindings(`[
      { "key": "Ctrl+Truc+N", "command": "file.new" },
      { "command": "file.save" },
      { "key": "", "command": "-file.save" },
      "Ctrl+S",
    ]`);
    expect(bindings).toEqual([{ key: '', command: '-file.save' }]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/^entrée 1 : .*Truc/);
    expect(errors[1]).toMatch(/^entrée 2 : "key" manquant/);
  });

  it('refuses a file that is not a list', () => {
    expect(parseKeybindings(null)).toEqual({ bindings: [], errors: [] });
    expect(() => parseKeybindings('{}')).toThrow(/liste/);
    expect(() => parseKeybindings('[ { ]')).toThrow(/ligne 1/);
  });
});
