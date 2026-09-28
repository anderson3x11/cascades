import { describe, expect, it } from 'vitest';
import { pickTheme } from './pick';

describe('pickTheme', () => {
  it('follows the OS in auto mode', () => {
    expect(pickTheme('auto', false, 'light', 'nord')).toBe('light');
    expect(pickTheme('auto', true, 'light', 'nord')).toBe('nord');
  });

  it('uses a forced theme as is', () => {
    expect(pickTheme('gruvbox', false, 'light', 'dark')).toBe('gruvbox');
  });
});
