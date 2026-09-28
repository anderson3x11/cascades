import { describe, expect, it } from 'vitest';
import { formatAge } from './age';

describe('formatAge', () => {
  const now = 10 * 24 * 3600_000;
  it('rounds down to the largest unit', () => {
    expect(formatAge(now - 20_000, now)).toBe('à l’instant');
    expect(formatAge(now - 5 * 60_000, now)).toBe('il y a 5 min');
    expect(formatAge(now - 3 * 3600_000 - 1, now)).toBe('il y a 3 h');
    expect(formatAge(now - 2 * 24 * 3600_000, now)).toBe('il y a 2 j');
  });

  it('treats future dates as now', () => {
    expect(formatAge(now + 1000, now)).toBe('à l’instant');
  });
});
