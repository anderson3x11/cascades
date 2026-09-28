import { describe, expect, it } from 'vitest';
import { parseWhen, type ContextValue } from './when';

const ctx =
  (values: Record<string, ContextValue>) =>
  (key: string): ContextValue =>
    values[key];

describe('parseWhen', () => {
  it('evaluates a bare key as truthiness', () => {
    expect(parseWhen('editorFocus')(ctx({ editorFocus: true }))).toBe(true);
    expect(parseWhen('editorFocus')(ctx({}))).toBe(false);
  });

  it('handles negation, and, or with precedence', () => {
    const expr = parseWhen('a || b && !c');
    expect(expr(ctx({ a: true }))).toBe(true);
    expect(expr(ctx({ b: true }))).toBe(true);
    expect(expr(ctx({ b: true, c: true }))).toBe(false);
  });

  it('handles parentheses', () => {
    const expr = parseWhen('(a || b) && c');
    expect(expr(ctx({ a: true }))).toBe(false);
    expect(expr(ctx({ a: true, c: true }))).toBe(true);
  });

  it('compares with string, number and boolean literals', () => {
    expect(parseWhen("vim.mode == 'normal'")(ctx({ 'vim.mode': 'normal' }))).toBe(true);
    expect(parseWhen('vim.mode != "normal"')(ctx({ 'vim.mode': 'insert' }))).toBe(true);
    expect(parseWhen('tabs == 3')(ctx({ tabs: 3 }))).toBe(true);
    expect(parseWhen('previewOpen == false')(ctx({ previewOpen: false }))).toBe(true);
  });

  it('rejects malformed clauses', () => {
    expect(() => parseWhen('a &&')).toThrow();
    expect(() => parseWhen('(a')).toThrow();
    expect(() => parseWhen("a == 'x")).toThrow();
    expect(() => parseWhen('a b')).toThrow();
  });
});
