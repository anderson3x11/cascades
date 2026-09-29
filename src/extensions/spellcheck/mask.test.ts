import { describe, expect, it } from 'vitest';
import { maskLine } from './mask';

describe('maskLine', () => {
  it('blanks out addresses, e-mails and code, keeping positions', () => {
    const line = 'Voir https://exempel.fr, écrire à moi@ici.fr ou `npm instal` ici';
    const masked = maskLine(line);
    expect(masked).toHaveLength(line.length);
    expect(masked).not.toMatch(/exempel|moi@|instal/);
    expect(masked.startsWith('Voir ')).toBe(true);
    expect(masked.endsWith(' ici')).toBe(true);
  });
});
