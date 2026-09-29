import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

// Tuesday 29 September 2026, 08:05:09.
const date = new Date(2026, 8, 29, 8, 5, 9);

describe('formatDate', () => {
  it('writes numbers', () => {
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('29/09/2026');
    expect(formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-09-29 08:05:09');
    expect(formatDate(date, 'D/M/YY H:mm')).toBe('29/9/26 8:05');
  });

  it('writes names in French', () => {
    expect(formatDate(date, 'dddd D MMMM YYYY', 'fr')).toBe('mardi 29 septembre 2026');
    expect(formatDate(date, 'ddd D MMM', 'fr')).toBe('mar. 29 sept.');
    expect(formatDate(new Date(2026, 4, 1), 'D MMM', 'fr')).toBe('1 mai');
  });

  it('keeps text in brackets', () => {
    expect(formatDate(date, '[Le] DD/MM [à] HH[h]mm')).toBe('Le 29/09 à 08h05');
  });
});
