import { describe, expect, it } from 'vitest';
import { chordFromEvent, normalizeChord, parseKeySequence } from './keys';

const event = (
  key: string,
  mods: Partial<Record<'ctrl' | 'alt' | 'shift' | 'meta', boolean>> = {},
) => ({
  key,
  ctrlKey: !!mods.ctrl,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
  metaKey: !!mods.meta,
});

describe('normalizeChord', () => {
  it('orders modifiers and lowercases', () => {
    expect(normalizeChord('Shift+Ctrl+P')).toBe('ctrl+shift+p');
    expect(normalizeChord('Alt+Shift+Down')).toBe('alt+shift+down');
  });

  it('supports aliases and the + key', () => {
    expect(normalizeChord('Cmd+Esc')).toBe('meta+escape');
    expect(normalizeChord('Ctrl++')).toBe('ctrl++');
    expect(normalizeChord('Ctrl+=')).toBe('ctrl+=');
  });

  it('rejects unknown modifiers', () => {
    expect(() => normalizeChord('Hyper+A')).toThrow();
  });
});

describe('parseKeySequence', () => {
  it('splits chords on spaces', () => {
    expect(parseKeySequence('Ctrl+K Ctrl+S')).toEqual(['ctrl+k', 'ctrl+s']);
    expect(parseKeySequence('Ctrl+K Z')).toEqual(['ctrl+k', 'z']);
  });
});

describe('chordFromEvent', () => {
  it('builds a normalized chord', () => {
    expect(chordFromEvent(event('P', { ctrl: true, shift: true }))).toBe('ctrl+shift+p');
    expect(chordFromEvent(event('ArrowDown', { alt: true }))).toBe('alt+down');
  });

  it('ignores lone modifiers', () => {
    expect(chordFromEvent(event('Control', { ctrl: true }))).toBeNull();
  });

  it('matches what normalizeChord produces', () => {
    expect(chordFromEvent(event('Tab', { ctrl: true, shift: true }))).toBe(
      normalizeChord('Ctrl+Shift+Tab'),
    );
  });
});
