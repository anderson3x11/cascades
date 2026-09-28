import { describe, expect, it } from 'vitest';
import { isUrl, linkAt, markdownLink, resolve } from './links';

describe('linkAt', () => {
  it('finds a Markdown link anywhere on it', () => {
    const line = 'Voir [mes notes](../notes/idées.md "titre") ici';
    expect(linkAt(line, 6)?.target).toBe('../notes/idées.md');
    expect(linkAt(line, 30)?.target).toBe('../notes/idées.md');
    expect(linkAt(line, 2)).toBeNull();
  });

  it('finds bare and <angle> addresses, without the punctuation after them', () => {
    expect(linkAt('Site : https://exemple.fr/page.', 12)).toEqual({
      target: 'https://exemple.fr/page',
      from: 7,
      to: 30,
    });
    expect(linkAt('(voir www.exemple.fr)', 8)?.target).toBe('www.exemple.fr');
    expect(linkAt('https://fr.wikipedia.org/wiki/Paris_(ville)', 5)?.target).toBe(
      'https://fr.wikipedia.org/wiki/Paris_(ville)',
    );
    expect(linkAt('<mailto:moi@ici.fr>', 3)?.target).toBe('mailto:moi@ici.fr');
  });
});

describe('resolve', () => {
  it('opens web addresses in the browser', () => {
    expect(resolve('www.site.fr', null)).toEqual({ kind: 'url', url: 'https://www.site.fr' });
    expect(resolve('https://a.fr', null)).toEqual({ kind: 'url', url: 'https://a.fr' });
    expect(resolve('javascript:alert(1)', null)).toBeNull();
  });

  it('opens files relative to the current one', () => {
    expect(resolve('../jeux/Elden%20Ring.md#combat', 'C:\\notes\\2025\\a.md')).toEqual({
      kind: 'file',
      path: 'C:\\notes\\jeux\\Elden Ring.md',
    });
    expect(resolve('C:\\autre\\b.txt', 'C:\\notes\\a.md')).toEqual({
      kind: 'file',
      path: 'C:\\autre\\b.txt',
    });
    expect(resolve('#section', 'C:\\notes\\a.md')).toBeNull();
    expect(resolve('b.md', null)).toBeNull();
  });
});

describe('pasting a link', () => {
  it('recognizes one address and writes the link', () => {
    expect(isUrl('https://exemple.fr/a?b=c')).toBe(true);
    expect(isUrl('voir https://exemple.fr')).toBe(false);
    expect(markdownLink('ici', 'https://a.fr')).toBe('[ici](https://a.fr)');
    expect(markdownLink('ici', 'https://a.fr/x_(y)')).toBe('[ici](<https://a.fr/x_(y)>)');
  });
});
