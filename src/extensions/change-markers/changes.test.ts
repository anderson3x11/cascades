import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { changedLines } from './changes';

const text = (lines: string[]) => Text.of(lines);
const changes = (saved: string[], current: string[]) =>
  Object.fromEntries(changedLines(text(saved), text(current)));

describe('changedLines', () => {
  it('finds nothing in the saved text', () => {
    expect(changes(['a', 'b'], ['a', 'b'])).toEqual({});
  });

  it('marks added and modified lines', () => {
    expect(changes(['lait', 'pain', 'fin'], ['lait', 'pain complet', 'œufs', 'fin'])).toEqual({
      2: 'modified',
      3: 'modified',
    });
    expect(changes(['lait', 'fin'], ['lait', 'pain', 'œufs', 'fin'])).toEqual({
      2: 'added',
      3: 'added',
    });
  });

  it('sees a line added at the end as added, not the last one as modified', () => {
    expect(changes(['lait', 'fin'], ['lait', 'fin', 'œufs'])).toEqual({ 3: 'added' });
  });

  it('marks where lines were deleted', () => {
    expect(changes(['lait', 'pain', 'œufs', 'fin'], ['lait', 'fin'])).toEqual({ 2: 'deleted' });
  });
});
