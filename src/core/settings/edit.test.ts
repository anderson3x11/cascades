import { describe, expect, it } from 'vitest';
import { withSetting } from './edit';

describe('withSetting', () => {
  it('sets and removes global keys without touching the input', () => {
    const raw = { 'editor.tabSize': 2 };
    expect(withSetting(raw, 'workbench.theme', 'nord')).toEqual({
      'editor.tabSize': 2,
      'workbench.theme': 'nord',
    });
    expect(withSetting(raw, 'editor.tabSize', undefined)).toEqual({});
    expect(raw).toEqual({ 'editor.tabSize': 2 });
  });

  it('writes into a language block, creating or dropping it', () => {
    const raw = withSetting({}, 'editor.wordWrap', true, 'markdown');
    expect(raw).toEqual({ '[markdown]': { 'editor.wordWrap': true } });
    expect(withSetting(raw, 'editor.wordWrap', undefined, 'markdown')).toEqual({});
  });
});
