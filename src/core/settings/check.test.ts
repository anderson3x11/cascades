import { describe, expect, it } from 'vitest';
import { checkSettings } from './check';
import type { SettingSchema } from './registry';

const SCHEMAS: Record<string, SettingSchema> = {
  'editor.tabSize': { type: 'number', default: 4 },
  'editor.wordWrap': { type: 'boolean', default: false },
  'workbench.theme': { type: 'string', default: 'auto', enum: ['auto', 'nord'] },
};
const check = (text: string) => checkSettings(text, (key) => SCHEMAS[key]);
/** The underlined text and message of each problem. */
const underlined = (text: string) =>
  check(text).map((p) => [text.slice(p.from, p.to), p.severity, p.message]);

describe('checkSettings', () => {
  it('accepts a correct file with comments', () => {
    expect(
      check('// mes réglages\n{ "editor.tabSize": 2, "[markdown]": { "editor.wordWrap": true } }'),
    ).toEqual([]);
    expect(check('')).toEqual([]);
  });

  it('underlines unknown settings and wrong values', () => {
    expect(
      underlined('{ "editor.tabsize": 2, "editor.tabSize": "2", "workbench.theme": "rose" }'),
    ).toEqual([
      ['"editor.tabsize"', 'warning', 'unknown setting: editor.tabsize'],
      ['"2"', 'error', 'expected: a number'],
      ['"rose"', 'error', 'possible values: "auto", "nord"'],
    ]);
  });

  it('checks language blocks too', () => {
    expect(underlined('{ "[markdown]": { "editor.wordWrap": 1 }, "[css]": 3 }')).toEqual([
      ['1', 'error', 'expected: true or false'],
      ['3', 'error', 'expected: an object { … }'],
    ]);
  });

  it('reports syntax errors where they are', () => {
    const text = '{\n  "editor.tabSize": 2\n  "editor.wordWrap": true\n}';
    const [problem] = check(text);
    expect(problem?.message).toBe('missing comma');
    expect(text.slice(problem?.from).startsWith('"editor.wordWrap"')).toBe(true);
  });
});
