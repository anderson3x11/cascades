import { describe, expect, it } from 'vitest';
import {
  baseName,
  isExcluded,
  isWithin,
  join,
  moved,
  nameProblem,
  parentOf,
  sortEntries,
} from './paths';

describe('paths', () => {
  it('joins and splits with the folder’s separator', () => {
    expect(join('C:\\notes', 'a.txt')).toBe('C:\\notes\\a.txt');
    expect(join('C:\\', 'a.txt')).toBe('C:\\a.txt');
    expect(join('/home/moi', 'a.txt')).toBe('/home/moi/a.txt');
    expect(parentOf('C:\\notes\\a.txt')).toBe('C:\\notes');
    expect(baseName('C:\\notes\\a.txt')).toBe('a.txt');
  });

  it('tells whether a path is inside a folder, ignoring case on Windows', () => {
    expect(isWithin('C:\\Notes\\a.txt', 'c:/notes')).toBe(true);
    expect(isWithin('C:\\notes2\\a.txt', 'C:\\notes')).toBe(false);
    expect(moved('C:\\a\\b\\c.txt', 'C:\\a\\b', 'C:\\a\\z')).toBe('C:\\a\\z\\c.txt');
  });

  it('sorts folders first, then numbers as numbers', () => {
    const entries = [
      { name: 'notes 10.txt', isDir: false },
      { name: 'Zeta', isDir: true },
      { name: 'notes 2.txt', isDir: false },
      { name: 'archives', isDir: true },
    ];
    expect(sortEntries(entries).map((e) => e.name)).toEqual([
      'archives',
      'Zeta',
      'notes 2.txt',
      'notes 10.txt',
    ]);
  });

  it('matches exclusion patterns', () => {
    expect(isExcluded('node_modules', ['.git', 'node_modules'])).toBe(true);
    expect(isExcluded('debug.LOG', ['*.log'])).toBe(true);
    expect(isExcluded('notes.txt', ['*.log', '.git'])).toBe(false);
  });

  it('refuses names Windows does not accept', () => {
    expect(nameProblem('idées.md')).toBeNull();
    expect(nameProblem('  ')).toMatch(/vide/);
    expect(nameProblem('a:b')).toMatch(/interdits/);
    expect(nameProblem('notes.')).toMatch(/finir/);
  });
});
