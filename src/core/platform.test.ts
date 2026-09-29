import { afterEach, describe, expect, it } from 'vitest';
import { samePath, setPlatform } from './platform';

describe('samePath', () => {
  afterEach(() => setPlatform('windows'));

  it('ignores case and separators on Windows and macOS', () => {
    expect(samePath('C:\\Notes\\A.txt')).toBe(samePath('c:/notes/a.txt'));
    setPlatform('macos');
    expect(samePath('/Users/ana/Notes.txt')).toBe(samePath('/users/ana/notes.txt'));
  });

  it('keeps case on Linux', () => {
    setPlatform('linux');
    expect(samePath('/home/ana/Notes.txt')).not.toBe(samePath('/home/ana/notes.txt'));
  });
});
