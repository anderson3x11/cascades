import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { newlineKeepingIndent } from './newline';

function enter(doc: string, ...cursors: number[]) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.create(cursors.map((c) => EditorSelection.cursor(c))),
    extensions: EditorState.allowMultipleSelections.of(true),
  });
  const next = state.update(newlineKeepingIndent(state)).state;
  return { doc: next.doc.toString(), heads: next.selection.ranges.map((r) => r.head) };
}

describe('newlineKeepingIndent', () => {
  it('keeps tabs as tabs', () => {
    expect(enter('\t\tidea', 6).doc).toBe('\t\tidea\n\t\t');
  });

  it('keeps mixed whitespace exactly', () => {
    expect(enter(' \t x', 4).doc).toBe(' \t x\n \t ');
  });

  it('puts the cursor after the copied indentation', () => {
    expect(enter('\tab', 3).heads).toEqual([5]);
  });

  it('splits a line in the middle', () => {
    expect(enter('\tabcd', 3).doc).toBe('\tab\n\tcd');
  });

  it('only keeps indentation before the cursor', () => {
    expect(enter('\t\tx', 1).doc).toBe('\t\n\t\tx');
  });

  it('works on an unindented line', () => {
    expect(enter('root', 4).doc).toBe('root\n');
  });

  it('handles several cursors', () => {
    expect(enter('\ta\n\t\tb', 2, 6).doc).toBe('\ta\n\t\n\t\tb\n\t\t');
  });
});
