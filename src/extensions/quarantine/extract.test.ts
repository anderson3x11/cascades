import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { passagesToQuarantine } from './extract';

const DOC = 'Elden Ring\n\tCombat exigeant\n\tMusique\nFin';

function passages(...ranges: [number, number][]) {
  const state = EditorState.create({
    doc: DOC,
    selection: EditorSelection.create(ranges.map(([a, h]) => EditorSelection.range(a, h))),
    extensions: EditorState.allowMultipleSelections.of(true),
  });
  const list = passagesToQuarantine(state);
  const after = state.update({ changes: list.map(({ from, to }) => ({ from, to })) }).state;
  return { list: list.map(({ text, line }) => ({ text, line })), after: after.doc.toString() };
}

describe('passagesToQuarantine', () => {
  it('takes a selection as is', () => {
    expect(passages([11, 27])).toEqual({
      list: [{ text: '\tCombat exigeant', line: 2 }],
      after: 'Elden Ring\n\n\tMusique\nFin',
    });
  });

  it('takes the whole line, with its line break, when nothing is selected', () => {
    expect(passages([14, 14])).toEqual({
      list: [{ text: '\tCombat exigeant', line: 2 }],
      after: 'Elden Ring\n\tMusique\nFin',
    });
  });

  it('takes the last line with the line break before it', () => {
    expect(passages([DOC.length, DOC.length]).after).toBe(
      'Elden Ring\n\tCombat exigeant\n\tMusique',
    );
  });

  it('makes one passage per selection, in document order', () => {
    expect(passages([29, 29], [0, 5]).list).toEqual([
      { text: 'Elden', line: 1 },
      { text: '\tMusique', line: 3 },
    ]);
  });

  it('skips empty lines', () => {
    const state = EditorState.create({ doc: 'a\n\nb', selection: { anchor: 2 } });
    expect(passagesToQuarantine(state)).toEqual([]);
  });
});
