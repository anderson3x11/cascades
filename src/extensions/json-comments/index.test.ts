import { describe, expect, it } from 'vitest';
import { commentRanges } from '.';

describe('commentRanges', () => {
  it('finds line and block comments, not slashes in strings', () => {
    const text = '// titre\n{ "url": "http://a" /* note */ }';
    expect(commentRanges(text).map(({ from, to }) => text.slice(from, to))).toEqual([
      '// titre',
      '/* note */',
    ]);
  });
});
