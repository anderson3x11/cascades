import { describe, expect, it } from 'vitest';
import { editSettings, parseJsonc, parseSettings } from './file';

describe('parseSettings', () => {
  it('accepts comments and trailing commas', () => {
    expect(parseSettings('{\n  // taille\n  "editor.tabSize": 2,\n}')).toEqual({
      'editor.tabSize': 2,
    });
  });

  it('treats an empty file as no settings', () => {
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings('  ')).toEqual({});
  });

  it('explains errors with a line number', () => {
    expect(() => parseSettings('{\n  "a": 1\n  "b": 2\n}')).toThrow(/ligne 3/);
    expect(() => parseSettings('[1]')).toThrow(/objet/);
  });
});

describe('editSettings', () => {
  it('changes one value and keeps comments and order', () => {
    const text = '{\n  // Mes réglages\n  "editor.tabSize": 4,\n  "a": true\n}\n';
    expect(editSettings(text, 'editor.tabSize', 2)).toBe(
      '{\n  // Mes réglages\n  "editor.tabSize": 2,\n  "a": true\n}\n',
    );
  });

  it('adds and removes keys', () => {
    const added = editSettings('{\n  "a": 1\n}\n', 'workbench.theme', 'nord');
    expect(parseJsonc(added)).toEqual({ a: 1, 'workbench.theme': 'nord' });
    expect(parseJsonc(editSettings(added, 'a', undefined))).toEqual({ 'workbench.theme': 'nord' });
  });

  it('writes into a language block and drops it once empty', () => {
    const text = editSettings(null, 'editor.wordWrap', true, 'markdown');
    expect(parseJsonc(text)).toEqual({ '[markdown]': { 'editor.wordWrap': true } });
    expect(parseJsonc(editSettings(text, 'editor.wordWrap', undefined, 'markdown'))).toEqual({});
  });
});
