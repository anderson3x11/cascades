import { describe, expect, it } from 'vitest';
import { parseTheme } from './theme';

describe('parseTheme', () => {
  it('reads a valid theme', () => {
    const json = JSON.stringify({
      name: 'Nord',
      type: 'dark',
      colors: { bg: '#2e3440', 'syn-keyword': 'rgb(129 161 193)' },
    });
    expect(parseTheme('user.nord', json)).toEqual({
      id: 'user.nord',
      name: 'Nord',
      type: 'dark',
      colors: { bg: '#2e3440', 'syn-keyword': 'rgb(129 161 193)' },
    });
  });

  it('explains what is wrong', () => {
    expect(() => parseTheme('x', '{')).toThrow(/JSON invalide/);
    expect(() => parseTheme('x', '{"type":"dark","colors":{}}')).toThrow(/name/);
    expect(() => parseTheme('x', '{"name":"a","type":"sepia","colors":{}}')).toThrow(/type/);
    expect(() => parseTheme('x', '{"name":"a","type":"dark"}')).toThrow(/colors/);
  });

  it('rejects unsafe keys and values', () => {
    const theme = (colors: object) => JSON.stringify({ name: 'a', type: 'light', colors });
    expect(() => parseTheme('x', theme({ '--bg': '#fff' }))).toThrow(/nom de couleur/);
    expect(() => parseTheme('x', theme({ bg: 'red; color: blue' }))).toThrow(/valeur/);
    expect(() => parseTheme('x', theme({ bg: 42 }))).toThrow(/valeur/);
  });
});
