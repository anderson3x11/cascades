import { describe, expect, it } from 'vitest';
import { formatAge } from './age';

describe('formatAge', () => {
  const now = 10 * 24 * 3600_000;
  it('rounds down to the largest unit', () => {
    expect(formatAge(now - 20_000, now)).toBe('just now');
    expect(formatAge(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatAge(now - 3 * 3600_000 - 1, now)).toBe('3 h ago');
    expect(formatAge(now - 2 * 24 * 3600_000, now)).toBe('2 d ago');
  });

  it('treats future dates as now', () => {
    expect(formatAge(now + 1000, now)).toBe('just now');
  });
});
