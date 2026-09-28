import { describe, expect, it } from 'vitest';
import { countChars, countWords } from './counts';
import { formatSize } from '.';

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

describe('formatSize', () => {
  it('uses the largest fitting unit', () => {
    expect(formatSize(12)).toBe('12 octets');
    expect(formatSize(1)).toBe('1 octet');
    expect(formatSize(2048)).toBe('2 Ko');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2,5 Mo');
    expect(formatSize(830 * 1024)).toBe('830 Ko');
  });
});
