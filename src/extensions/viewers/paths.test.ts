import { describe, expect, it } from 'vitest';
import { dirname, isAbsolute, resolvePath } from './paths';

describe('paths', () => {
  it('takes the folder of a path', () => {
    expect(dirname('C:\\notes\\jeux.md')).toBe('C:\\notes');
    expect(dirname('/home/me/a.md')).toBe('/home/me');
  });

  it('resolves relative references with the folder separator', () => {
    expect(resolvePath('C:\\notes', 'img/boss.png')).toBe('C:\\notes\\img\\boss.png');
    expect(resolvePath('C:\\notes\\jeux', '../img/a.png')).toBe('C:\\notes\\img\\a.png');
    expect(resolvePath('/home/me', './a%20b.png?x=1#top')).toBe('/home/me/a b.png');
  });

  it('does not climb above the drive', () => {
    expect(resolvePath('C:\\notes', '../../../x.png')).toBe('C:\\x.png');
  });

  it('recognizes absolute references', () => {
    expect(isAbsolute('https://example.com/a.png')).toBe(true);
    expect(isAbsolute('C:\\a.png')).toBe(true);
    expect(isAbsolute('data:image/png;base64,AA')).toBe(true);
    expect(isAbsolute('img/a.png')).toBe(false);
  });
});
