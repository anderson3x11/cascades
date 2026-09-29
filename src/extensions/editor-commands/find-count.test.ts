import { SearchQuery } from '@codemirror/search';
import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { countLabel, countMatches } from './find-count';

describe('countMatches', () => {
  it('counts matches and finds the selected one', () => {
    const doc = 'pain, lait, pain, PAIN';
    const state = EditorState.create({ doc, selection: EditorSelection.single(12, 16) });
    const count = countMatches(state, new SearchQuery({ search: 'pain' }));
    expect(count).toEqual({ total: 3, current: 2, capped: false });
    expect(countLabel(count)).toBe('2 sur 3');
    expect(countLabel({ total: 3, current: null, capped: false })).toBe('3 résultats');
    expect(countLabel({ total: 0, current: null, capped: false })).toBe('Aucun résultat');
  });

  it('respects case and ignores an invalid expression', () => {
    const state = EditorState.create({ doc: 'Pain pain' });
    expect(
      countMatches(state, new SearchQuery({ search: 'Pain', caseSensitive: true })).total,
    ).toBe(1);
    expect(countMatches(state, new SearchQuery({ search: '(', regexp: true })).total).toBe(0);
  });
});
