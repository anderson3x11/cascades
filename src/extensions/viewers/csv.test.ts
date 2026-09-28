import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from './csv';

describe('parseCsv', () => {
  it('splits rows and fields', () => {
    expect(parseCsv('jeu,note\nElden Ring,18\nHollow Knight,17\n')).toEqual([
      ['jeu', 'note'],
      ['Elden Ring', '18'],
      ['Hollow Knight', '17'],
    ]);
  });

  it('handles quotes, doubled quotes and line breaks inside quotes', () => {
    expect(parseCsv('a,b\n"x, y","il a dit ""oui"""\n"deux\nlignes",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'il a dit "oui"'],
      ['deux\nlignes', 'z'],
    ]);
  });

  it('keeps empty fields and ignores a final line break', () => {
    expect(parseCsv('a,,c\n,,\n')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('uses the given delimiter', () => {
    expect(parseCsv('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('detectDelimiter', () => {
  it('finds the delimiter used consistently', () => {
    expect(detectDelimiter('nom;prix\npain;1,20\nlait;0,95')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('a,b\n1,2')).toBe(',');
  });

  it('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a;b",c\n"d;e",f')).toBe(',');
  });

  it('defaults to a comma', () => {
    expect(detectDelimiter('une seule colonne\nencore')).toBe(',');
  });
});
