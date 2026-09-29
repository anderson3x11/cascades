import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { cascadeLines, deselectLine, paragraphLines, selectLine, selectParagraph } from './select';

const DOC = [
  'Elden Ring',
  '\tCombat',
  '\t\tBoss',
  '',
  '\tDirection artistique',
  'Hollow Knight',
  '\tAmbiance',
  '',
  'Une phrase.',
  'Une autre.',
].join('\n');

const stateAt = (anchor: number, head = anchor) =>
  EditorState.create({ doc: DOC, selection: EditorSelection.single(anchor, head) });
const selected = (state: EditorState, selection: EditorSelection) =>
  state.sliceDoc(selection.main.from, selection.main.to);

describe('line selection', () => {
  it('selects the line, then one more on each press, then removes the last one', () => {
    let state = stateAt(3);
    state = state.update({ selection: selectLine(state) }).state;
    expect(selected(state, state.selection)).toBe('Elden Ring\n');
    state = state.update({ selection: selectLine(state) }).state;
    expect(selected(state, state.selection)).toBe('Elden Ring\n\tCombat\n');
    state = state.update({ selection: deselectLine(state) }).state;
    expect(selected(state, state.selection)).toBe('Elden Ring\n');
    // One line left: it stays.
    expect(selected(state, deselectLine(state))).toBe('Elden Ring\n');
  });

  it('takes the last line of the document without a line break', () => {
    const state = stateAt(DOC.length - 2);
    expect(selected(state, selectLine(state))).toBe('Une autre.');
  });
});

describe('paragraphs and cascades', () => {
  it('finds the block between blank lines', () => {
    const state = stateAt(0);
    expect(paragraphLines(state.doc, 9)).toEqual([9, 10]);
    expect(paragraphLines(state.doc, 2)).toEqual([1, 3]);
  });

  it('finds the cascade, blank lines inside included', () => {
    const state = stateAt(0);
    expect(cascadeLines(state.doc, 3)).toEqual([1, 5]);
    expect(cascadeLines(state.doc, 7)).toEqual([6, 7]);
    expect(cascadeLines(state.doc, 9)).toBeNull();
  });

  it('selects the cascade, then the paragraph', () => {
    let state = stateAt(DOC.indexOf('Boss'));
    state = state.update({ selection: selectParagraph(state) }).state;
    expect(selected(state, state.selection)).toBe(
      'Elden Ring\n\tCombat\n\t\tBoss\n\n\tDirection artistique',
    );
    const inProse = stateAt(DOC.indexOf('autre'));
    expect(selected(inProse, selectParagraph(inProse))).toBe('Une phrase.\nUne autre.');
  });
});
