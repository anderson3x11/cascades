import { describe, expect, it } from 'vitest';
import { countChars, countWords } from './counts';

describe('countWords', () => {
  it('counts words separated by whitespace and punctuation', () => {
    expect(countWords('Elden Ring\n\tCombat exigeant, vraiment.')).toBe(5);
  });

  it('keeps apostrophes and hyphens inside words', () => {
    expect(countWords("l'arc-en-ciel aujourd’hui")).toBe(2);
  });

  it('ignores lone punctuation and markdown symbols', () => {
    expect(countWords('- [ ] tâche — ok')).toBe(2);
    expect(countWords('')).toBe(0);
  });
});

describe('countChars', () => {
  it('counts code points', () => {
    expect(countChars('abc')).toBe(3);
    expect(countChars('é😀')).toBe(2);
  });
});
