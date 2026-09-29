import { describe, expect, it } from 'vitest';
import { merge3, renderMerge } from './merge';

const lines = (...l: string[]) => l.join('\n');
const merged = (base: string, mine: string, theirs: string) =>
  renderMerge(merge3(base, mine, theirs));

describe('merge3', () => {
  it('combines changes made in different places', () => {
    const base = lines('a', 'b', 'c', 'd');
    const mine = lines('a', 'B', 'c', 'd');
    const theirs = lines('a', 'b', 'c', 'D');
    expect(merged(base, mine, theirs)).toEqual({ text: lines('a', 'B', 'c', 'D'), conflicts: 0 });
  });

  it('keeps lines added on both sides in different places', () => {
    const base = lines('Courses', '\t- lait', '\t- pain');
    const mine = lines('Courses', '\t- lait', '\t- chips', '\t- pain');
    const theirs = lines('Courses', '\t- lait', '\t- pain', '\t- pepsi');
    expect(merged(base, mine, theirs).text).toBe(
      lines('Courses', '\t- lait', '\t- chips', '\t- pain', '\t- pepsi'),
    );
  });

  it('reports a conflict when both sides add lines at the same place', () => {
    const base = lines('\t- chips', '1. boulangerie');
    const mine = lines('\t- chips', '\t- canettes redbull', '1. boulangerie');
    const theirs = lines('\t- chips', '\t- pepsi mangue', '1. boulangerie');
    expect(merge3(base, mine, theirs)).toEqual([
      { kind: 'ok', lines: ['\t- chips'] },
      { kind: 'conflict', mine: ['\t- canettes redbull'], theirs: ['\t- pepsi mangue'] },
      { kind: 'ok', lines: ['1. boulangerie'] },
    ]);
  });

  it('writes conflicts with markers', () => {
    const { text, conflicts } = merged('a', 'mine', 'theirs');
    expect(conflicts).toBe(1);
    expect(text).toBe(
      lines('<<<<<<< my version', 'mine', '=======', 'theirs', '>>>>>>> version on disk'),
    );
  });

  it('takes identical changes once', () => {
    expect(merged(lines('a', 'b'), lines('a', 'X'), lines('a', 'X')).text).toBe(lines('a', 'X'));
  });

  it('applies deletions from one side', () => {
    expect(merged(lines('a', 'b', 'c'), lines('a', 'c'), lines('a', 'b', 'c', 'd')).text).toBe(
      lines('a', 'c', 'd'),
    );
  });

  it('handles empty texts', () => {
    expect(merged('', 'x', '').text).toBe('x');
    expect(merged('', '', '')).toEqual({ text: '', conflicts: 0 });
  });
});
