import { describe, expect, it, vi } from 'vitest';
import { SettingsRegistry } from './registry';

function makeRegistry() {
  const reg = new SettingsRegistry();
  reg.registerSchema('editor', {
    tabSize: { type: 'number', default: 4 },
    wordWrap: { type: 'boolean', default: false },
    lineEnding: { type: 'string', default: 'lf', enum: ['lf', 'crlf'] },
  });
  return reg;
}

describe('SettingsRegistry', () => {
  it('returns schema defaults', () => {
    expect(makeRegistry().get('editor.tabSize')).toBe(4);
  });

  it('layers user values and language overrides', () => {
    const reg = makeRegistry();
    reg.setUserSettings({ 'editor.tabSize': 2, '[markdown]': { 'editor.wordWrap': true } });
    expect(reg.get('editor.tabSize')).toBe(2);
    expect(reg.get('editor.wordWrap')).toBe(false);
    expect(reg.get('editor.wordWrap', 'markdown')).toBe(true);
    expect(reg.get('editor.tabSize', 'markdown')).toBe(2);
  });

  it('ignores values of the wrong type or outside the enum', () => {
    const reg = makeRegistry();
    reg.setUserSettings({ 'editor.tabSize': 'big', 'editor.lineEnding': 'cr' });
    expect(reg.get('editor.tabSize')).toBe(4);
    expect(reg.get('editor.lineEnding')).toBe('lf');
  });

  it('throws on unknown keys and duplicate schemas', () => {
    const reg = makeRegistry();
    expect(() => reg.get('editor.nope')).toThrow();
    expect(() =>
      reg.registerSchema('editor', { tabSize: { type: 'number', default: 8 } }),
    ).toThrow();
  });

  it('reports changed keys', () => {
    const reg = makeRegistry();
    reg.setUserSettings({ 'editor.tabSize': 2 });
    const listener = vi.fn();
    reg.onDidChange.on(listener);
    reg.setUserSettings({ 'editor.tabSize': 2, '[markdown]': { 'editor.wordWrap': true } });
    expect(listener).toHaveBeenCalledWith({ keys: ['editor.wordWrap'] });
  });

  it('does not fire when nothing changed', () => {
    const reg = makeRegistry();
    reg.setUserSettings({ 'editor.tabSize': 2 });
    const listener = vi.fn();
    reg.onDidChange.on(listener);
    reg.setUserSettings({ 'editor.tabSize': 2 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns a copy of the user settings as set', () => {
    const reg = makeRegistry();
    const raw = { 'editor.tabSize': 2, '[markdown]': { 'editor.wordWrap': true } };
    reg.setUserSettings(raw);
    const copy = reg.userSettings();
    expect(copy).toEqual(raw);
    (copy['[markdown]'] as Record<string, unknown>)['editor.wordWrap'] = false;
    expect(reg.get('editor.wordWrap', 'markdown')).toBe(true);
  });

  it('removes a schema on dispose', () => {
    const reg = new SettingsRegistry();
    const d = reg.registerSchema('x', { a: { type: 'number', default: 1 } });
    d.dispose();
    expect(() => reg.get('x.a')).toThrow();
  });
});
