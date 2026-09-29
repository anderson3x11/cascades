import { describe, expect, it } from 'vitest';
import {
  joinLines,
  lowerCase,
  removeDuplicateLines,
  sentenceCase,
  sortLines,
  titleCase,
  trimTrailingWhitespace,
  upperCase,
} from './text';

describe('case', () => {
  it('changes case, accents included', () => {
    expect(upperCase('déjà vu')).toBe('DÉJÀ VU');
    expect(lowerCase('ÉTÉ')).toBe('été');
  });

  it('capitalizes each word, not after an apostrophe', () => {
    expect(titleCase("l'ÉTÉ de jean-pierre à paris")).toBe("L'été De Jean-Pierre À Paris");
  });

  it('capitalizes sentences and lines, after list markers', () => {
    expect(sentenceCase('ELDEN RING. UN JEU DIFFICILE ! vraiment…')).toBe(
      'Elden ring. Un jeu difficile ! Vraiment…',
    );
    expect(sentenceCase('- COMBAT\n\t- [ ] BOSS\n2. FIN')).toBe('- Combat\n\t- [ ] Boss\n2. Fin');
  });
});

describe('lines', () => {
  it('sorts ignoring accents and case, numbers as numbers', () => {
    expect(sortLines(['Été', 'avion', 'note 10', 'note 2', 'Zèbre'])).toEqual([
      'avion',
      'Été',
      'note 2',
      'note 10',
      'Zèbre',
    ]);
    expect(sortLines(['b', 'a', 'c'], true)).toEqual(['c', 'b', 'a']);
  });

  it('removes repeated lines but keeps blank ones', () => {
    expect(removeDuplicateLines(['lait', '', 'pain', 'lait', '', 'pain '])).toEqual([
      'lait',
      '',
      'pain',
      '',
      'pain ',
    ]);
  });

  it('trims line ends and joins lines', () => {
    expect(trimTrailingWhitespace(['a  ', '\tb\t'])).toEqual(['a', '\tb']);
    expect(joinLines(['\tElden Ring ', '\t\tcombat', '', '  exigeant'])).toEqual([
      '\tElden Ring combat exigeant',
    ]);
  });
});
