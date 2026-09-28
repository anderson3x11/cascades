import { describe, expect, it } from 'vitest';
import { chordFromEvent, formatKeySequence, normalizeChord, parseKeySequence } from './keys';

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

describe('formatKeySequence', () => {
  it('capitalizes and joins chords', () => {
    expect(formatKeySequence(parseKeySequence('Ctrl+Shift+S'))).toBe('Ctrl+Shift+S');
    expect(formatKeySequence(parseKeySequence('Ctrl+K Z'))).toBe('Ctrl+K Z');
  });

  it('uses symbols for arrows and keeps punctuation', () => {
    expect(formatKeySequence(parseKeySequence('Shift+Alt+Down'))).toBe('Alt+Shift+↓');
    expect(formatKeySequence(parseKeySequence('Ctrl+/'))).toBe('Ctrl+/');
    expect(formatKeySequence(parseKeySequence('Ctrl++'))).toBe('Ctrl++');
  });
});

describe('chordFromEvent', () => {
  it('builds a normalized chord', () => {
    expect(chordFromEvent(event('P', { ctrl: true, shift: true }))).toBe('ctrl+shift+p');
    expect(chordFromEvent(event('ArrowDown', { alt: true }))).toBe('alt+down');
  });

  it('uses the physical digit on AZERTY', () => {
    expect(chordFromEvent({ ...event('à', { ctrl: true }), code: 'Digit0' })).toBe('ctrl+0');
    expect(chordFromEvent({ ...event('&', { ctrl: true }), code: 'Digit1' })).toBe('ctrl+1');
    // Without Ctrl/Alt the typed character is kept.
    expect(chordFromEvent({ ...event('à'), code: 'Digit0' })).toBe('à');
  });

  it('uses the physical letter when Ctrl+Alt (AltGr) gives a character', () => {
    const ctrlAlt = { ctrl: true, alt: true };
    expect(chordFromEvent({ ...event('ñ', ctrlAlt), code: 'KeyN' })).toBe('ctrl+alt+n');
    expect(chordFromEvent({ ...event('€', ctrlAlt), code: 'KeyE' })).toBe('ctrl+alt+e');
    // A plain letter follows the layout: the A key of AZERTY sits at KeyQ.
    expect(chordFromEvent({ ...event('a', { ctrl: true }), code: 'KeyQ' })).toBe('ctrl+a');
    expect(chordFromEvent({ ...event('ñ'), code: 'KeyN' })).toBe('ñ');
    // The webview may report AltGraph instead of Ctrl and Alt.
    const altGraph = (key: string) => key === 'AltGraph';
    expect(chordFromEvent({ ...event('ñ'), code: 'KeyN', getModifierState: altGraph })).toBe(
      'ctrl+alt+n',
    );
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
