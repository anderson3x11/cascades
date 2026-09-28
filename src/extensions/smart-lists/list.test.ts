import { indentUnit } from '@codemirror/language';
import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { continueList, indentList, parseItem, renumberChanges, toggleTask } from './list';

/** "|" marks the cursor, "[" and "]" a selection. */
function state(doc: string, unit = '\t'): EditorState {
  const cursor = doc.indexOf('|');
  const text = doc.replace('|', '');
  return EditorState.create({
    doc: text,
    selection: EditorSelection.cursor(cursor === -1 ? text.length : cursor),
    extensions: [indentUnit.of(unit), EditorState.tabSize.of(4)],
  });
}

function apply(s: EditorState, spec: TransactionSpec | null): string | null {
  if (!spec) return null;
  const next = s.update(spec).state;
  const head = next.selection.main.head;
  const doc = next.doc.toString();
  return doc.slice(0, head) + '|' + doc.slice(head);
}

const enter = (doc: string) => {
  const s = state(doc);
  return apply(s, continueList(s));
};

describe('parseItem', () => {
  it('recognizes bullets, numbers, letters and boxes', () => {
    expect(parseItem('- a')).toMatchObject({ kind: 'bullet', mark: '-', contentStart: 2 });
    expect(parseItem('\t12) a')).toMatchObject({ kind: 'number', number: 12, mark: ')' });
    expect(parseItem('b. a')).toMatchObject({ kind: 'letter', letter: 'b', mark: '.' });
    expect(parseItem('- [x] fait')).toMatchObject({ checked: true, contentStart: 6 });
    expect(parseItem('* [ ] à faire')).toMatchObject({ checked: false });
  });

  it('rejects text that only looks like a list', () => {
    expect(parseItem('-sans espace')).toBeNull();
    expect(parseItem('1.5 litre')).toBeNull();
    expect(parseItem('Elden Ring')).toBeNull();
    expect(parseItem('')).toBeNull();
  });
});

describe('continueList', () => {
  it('continues bullets at the same level', () => {
    expect(enter('\t- idée|')).toBe('\t- idée\n\t- |');
    expect(enter('+ a|')).toBe('+ a\n+ |');
  });

  it('increments numbers and letters', () => {
    expect(enter('1. un|')).toBe('1. un\n2. |');
    expect(enter('9) neuf|')).toBe('9) neuf\n10) |');
    expect(enter('a) premier|')).toBe('a) premier\nb) |');
  });

  it('adds an empty box after a task', () => {
    expect(enter('- [x] fait|')).toBe('- [x] fait\n- [ ] |');
  });

  it('splits an item when the cursor is in the middle', () => {
    expect(enter('- avant|après')).toBe('- avant\n- |après');
  });

  it('leaves the list on an empty item', () => {
    expect(enter('- a\n- |')).toBe('- a\n|');
    expect(enter('- a\n- [ ] |')).toBe('- a\n|');
  });

  it('goes up one level on an empty indented item', () => {
    expect(enter('- a\n\t- |')).toBe('- a\n- |');
    expect(enter('- a\n\t\t- |')).toBe('- a\n\t- |');
  });

  it('does not apply outside list items or inside the marker', () => {
    expect(enter('texte|')).toBeNull();
    expect(enter('-| a')).toBeNull();
  });
});

describe('indentList', () => {
  it('indents and outdents a list line wherever the cursor is', () => {
    const s = state('- a\n- b|');
    expect(apply(s, indentList(s, 1))).toBe('- a\n\t- b|');
    const t = state('- a\n\t- |b');
    expect(apply(t, indentList(t, -1))).toBe('- a\n- |b');
  });

  it('restarts numbering when nesting an ordered item', () => {
    const s = state('1. a\n2. b|');
    expect(apply(s, indentList(s, 1))).toBe('1. a\n\t1. b|');
    const t = state('a) x\nb) y|');
    expect(apply(t, indentList(t, 1))).toBe('a) x\n\ta) y|');
  });

  it('uses spaces when the indent unit is spaces', () => {
    const s = state('- b|', '  ');
    expect(apply(s, indentList(s, 1))).toBe('  - b|');
  });

  it('does not apply to other lines', () => {
    expect(indentList(state('texte|'), 1)).toBeNull();
  });
});

describe('toggleTask', () => {
  it('toggles an existing box', () => {
    const s = state('- [ ] tâche|');
    expect(apply(s, toggleTask(s))).toBe('- [x] tâche|');
    const t = state('1. [x] tâche|');
    expect(apply(t, toggleTask(t))).toBe('1. [ ] tâche|');
  });

  it('adds a box to a list item without one', () => {
    const s = state('- tâche|');
    expect(apply(s, toggleTask(s))).toBe('- [ ] tâche|');
  });

  it('does nothing on other lines', () => {
    expect(toggleTask(state('texte|'))).toBeNull();
  });
});

describe('renumberChanges', () => {
  const renumber = (doc: string) => {
    const s = state(doc);
    return s.update({ changes: renumberChanges(s, 1, s.doc.lines) }).state.doc.toString();
  };

  it('renumbers a run of siblings from its first number', () => {
    expect(renumber('1. a\n1. b\n5. c')).toBe('1. a\n2. b\n3. c');
    expect(renumber('3. a\n1. b')).toBe('3. a\n4. b');
  });

  it('numbers nested levels separately and resumes the parent level', () => {
    expect(renumber('1. a\n\t1. x\n\t3. y\n4. b')).toBe('1. a\n\t1. x\n\t2. y\n2. b');
  });

  it('keeps counting across blank lines but not across text', () => {
    expect(renumber('1. a\n\n1. b')).toBe('1. a\n\n2. b');
    expect(renumber('1. a\ntexte\n1. b')).toBe('1. a\ntexte\n1. b');
  });

  it('renumbers letters and leaves bullets alone', () => {
    expect(renumber('a) x\na) y\n- z')).toBe('a) x\nb) y\n- z');
  });
});
