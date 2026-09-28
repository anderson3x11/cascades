import { describe, expect, it } from 'vitest';
import { cellAt, cellRange, findTable, formatTable, moveInTable, splitRow } from './table';

const DOC = [
  'Des jeux :',
  '',
  '|Jeu|Note|Prix|',
  '|:--|:-:|--:|',
  '| Elden Ring | 18 | 60 € |',
  '|Celeste|19|',
  '',
  'Fin.',
];

describe('tables', () => {
  it('splits rows, keeping escaped pipes', () => {
    expect(splitRow('| a | b \\| c |')).toEqual(['a', 'b \\| c']);
    expect(splitRow('a | b')).toEqual(['a', 'b']);
  });

  it('finds the table around a line', () => {
    const table = findTable(DOC, 4);
    expect(table && [table.first, table.last, table.aligns]).toEqual([
      2,
      5,
      ['left', 'center', 'right'],
    ]);
    expect(findTable(DOC, 0)).toBeNull();
    expect(findTable(['a | b', 'pas un tableau'], 0)).toBeNull();
  });

  it('aligns every column, filling missing cells', () => {
    const table = findTable(DOC, 2);
    expect(table && formatTable(table)).toEqual([
      '| Jeu        | Note | Prix |',
      '| :--------- | :--: | ---: |',
      '| Elden Ring |  18  | 60 € |',
      '| Celeste    |  19  |      |',
    ]);
  });

  it('finds cells from a column and back', () => {
    const line = '| Elden Ring |  18  | 60 € |';
    expect(cellAt(line, 3)).toBe(0);
    expect(cellAt(line, 16)).toBe(1);
    expect(cellRange(line, 1)).toEqual({ from: 16, to: 18 });
    expect(cellRange('| a |     |', 1)).toEqual({ from: 6, to: 6 });
  });

  it('moves to the next cell, over the delimiter row, and adds a row at the end', () => {
    const table = findTable(DOC, 2);
    if (!table) throw new Error('no table');
    expect(moveInTable(table, 0, 2, 1)).toMatchObject({ row: 2, cell: 0 });
    expect(moveInTable(table, 2, 0, -1)).toMatchObject({ row: 0, cell: 2 });
    const added = moveInTable(table, 3, 2, 1);
    expect(added.lines).toHaveLength(5);
    expect(added).toMatchObject({ row: 4, cell: 0 });
    expect(added.lines[4]).toBe('|            |      |      |');
  });
});
