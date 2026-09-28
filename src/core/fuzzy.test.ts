import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyMatch } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches characters in order, ignoring case and accents', () => {
    expect(fuzzyMatch('theme', 'Thème')?.indices).toEqual([0, 1, 2, 3, 4]);
    expect(fuzzyMatch('ENR', 'Enregistrer')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'Enregistrer')).toBeNull();
    expect(fuzzyMatch('ba', 'ab')).toBeNull();
  });

  it('matches everything with an empty query', () => {
    expect(fuzzyMatch('  ', 'abc')).toEqual({ score: 0, indices: [] });
  });

  it('prefers word starts', () => {
    expect(fuzzyMatch('sd', 'Solarized dark')?.indices).toEqual([0, 10]);
  });

  it('does not jump to a word start that leaves no room for the rest', () => {
    // The "t" of ".txt" starts a word, but "e" must still come after "t".
    expect(fuzzyMatch('note 24', 'note 24.txt')?.indices).toEqual([0, 1, 2, 3, 5, 6]);
  });

  it('ignores spaces in the query', () => {
    expect(fuzzyMatch('sol dark', 'Solarized dark')).not.toBeNull();
  });
});

describe('fuzzyFilter', () => {
  const themes = ['Clair', 'Sombre', 'Solarized clair', 'Solarized sombre', 'Nord'];

  it('ranks word-start and prefix matches first', () => {
    expect(fuzzyFilter('so', themes, (t) => t).map((r) => r.item)).toEqual([
      'Sombre',
      'Solarized clair',
      'Solarized sombre',
    ]);
    expect(fuzzyFilter('ssom', themes, (t) => t)[0]?.item).toBe('Solarized sombre');
  });

  it('keeps the original order with an empty query', () => {
    expect(fuzzyFilter('', themes, (t) => t).map((r) => r.item)).toEqual(themes);
  });
});
