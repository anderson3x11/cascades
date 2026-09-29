import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { deleteMarkdownPair, markdownInput } from './markdown';

/** State from text where "|" is the cursor, or "[" and "]" the selection. */
function stateOf(marked: string): EditorState {
  const anchor = marked.includes('[') ? marked.indexOf('[') : marked.indexOf('|');
  const head = marked.includes(']') ? marked.indexOf(']') - 1 : anchor;
  const doc = marked.replace(/[[\]|]/g, '');
  return EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
}

/** Text after typing, with the cursor or selection marked the same way. */
function type(marked: string, text: string): string | null {
  const state = stateOf(marked);
  const spec = markdownInput(state, text);
  if (!spec) return null;
  const next = state.update(spec).state;
  const { from, to } = next.selection.main;
  const doc = next.doc.toString();
  return from === to
    ? `${doc.slice(0, from)}|${doc.slice(from)}`
    : `${doc.slice(0, from)}[${doc.slice(from, to)}]${doc.slice(to)}`;
}

describe('markdownInput', () => {
  it('wraps a selection and keeps it selected', () => {
    expect(type('un [mot] ici', '*')).toBe('un *[mot]* ici');
    expect(type('un *[mot]* ici', '*')).toBe('un **[mot]** ici');
    expect(type('[code]', '`')).toBe('`[code]`');
    expect(type('[barré]', '~')).toBe('~~[barré]~~');
  });

  it('pairs ** on the second star, not the first', () => {
    expect(type('|', '*')).toBeNull();
    expect(type('*|', '*')).toBe('**|**');
    expect(type('**gras|**', '*')).toBe('**gras*|*');
    expect(type('**gras*|*', '*')).toBe('**gras**|');
  });

  it('pairs backticks, but not in a fence', () => {
    expect(type('|', '`')).toBe('`|`');
    expect(type('`code|`', '`')).toBe('`code`|');
    expect(type('``|', '`')).toBeNull();
  });

  it('outside Markdown, only wraps selections', () => {
    const state = stateOf('*|');
    expect(markdownInput(state, '*', false)).toBeNull();
    const selected = stateOf('[mot]');
    const spec = markdownInput(selected, '_', false);
    expect(spec && selected.update(spec).state.doc.toString()).toBe('_mot_');
  });

  it('leaves _ alone without a selection (snake_case)', () => {
    expect(type('snake|', '_')).toBeNull();
  });
});

describe('deleteMarkdownPair', () => {
  it('removes an empty pair', () => {
    const state = stateOf('a **|** b');
    const spec = deleteMarkdownPair(state);
    expect(spec && state.update(spec).state.doc.toString()).toBe('a  b');
    expect(deleteMarkdownPair(stateOf('**x|**'))).toBeNull();
  });
});
