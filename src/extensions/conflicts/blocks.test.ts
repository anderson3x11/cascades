import { describe, expect, it } from 'vitest';
import { findConflicts, resolve } from './blocks';

const DOC = [
  'avant', //                        1
  '<<<<<<< ma version', //           2
  '\t- canettes redbull', //         3
  '=======', //                      4
  '\t- pepsi mangue', //             5
  '>>>>>>> version du disque', //    6
  'après', //                        7
];

describe('findConflicts', () => {
  it('finds a block and its markers', () => {
    expect(findConflicts(DOC)).toEqual([{ start: 2, base: null, separator: 4, end: 6 }]);
  });

  it('supports the diff3 base section and plain git markers', () => {
    const doc = ['<<<<<<< HEAD', 'a', '||||||| base', 'o', '=======', 'b', '>>>>>>> branch'];
    expect(findConflicts(doc)).toEqual([{ start: 1, base: 3, separator: 5, end: 7 }]);
  });

  it('ignores incomplete blocks and look-alike lines', () => {
    expect(findConflicts(['<<<<<<< x', 'a', '======='])).toEqual([]);
    expect(findConflicts(['<<<<<<<<<< not a marker', '=======', '>>>>>>>'])).toEqual([]);
  });
});

describe('resolve', () => {
  const [block] = findConflicts(DOC);
  if (!block) throw new Error('no block');

  it('keeps one side or both', () => {
    expect(resolve(DOC, block, 'mine')).toEqual(['\t- canettes redbull']);
    expect(resolve(DOC, block, 'theirs')).toEqual(['\t- pepsi mangue']);
    expect(resolve(DOC, block, 'both')).toEqual(['\t- canettes redbull', '\t- pepsi mangue']);
  });

  it('leaves the base section out', () => {
    const doc = ['<<<<<<< a', 'mine', '||||||| base', 'old', '=======', 'theirs', '>>>>>>> b'];
    const [b] = findConflicts(doc);
    if (!b) throw new Error('no block');
    expect(resolve(doc, b, 'both')).toEqual(['mine', 'theirs']);
  });
});
