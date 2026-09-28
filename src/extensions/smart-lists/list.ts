/**
 * List editing on plain text: bullets (- * +), numbers (1. 1)), letters
 * (a. a)) and task boxes ([ ] [x]). Pure functions from an EditorState to a
 * transaction, or null when they do not apply.
 */
import {
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type TransactionSpec,
} from '@codemirror/state';
import { getIndentUnit, indentString } from '@codemirror/language';

const ITEM = /^([ \t]*)(?:([-*+])|(\d{1,9})([.)])|([a-zA-Z])([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/;

export interface ListItem {
  indent: string;
  kind: 'bullet' | 'number' | 'letter';
  /** "-", "*" or "+" for bullets, the delimiter "." or ")" otherwise. */
  mark: string;
  number: number;
  letter: string;
  /** Spaces between the marker and the content (or the box). */
  gap: string;
  /** null when the item has no task box. */
  checked: boolean | null;
  /** Offset in the line where the content starts. */
  contentStart: number;
  /** Offset of the number or letter (for renumbering) and its length. */
  labelStart: number;
  labelLength: number;
}

export function parseItem(text: string): ListItem | null {
  const m = ITEM.exec(text);
  if (!m) return null;
  const [all, indent = '', bullet, num, numDelim, letter, letterDelim, gap = '', box] = m;
  const base = {
    indent,
    gap,
    checked: box ? box[1] !== ' ' : null,
    contentStart: all.length,
    labelStart: indent.length,
  };
  if (bullet) {
    return { ...base, kind: 'bullet', mark: bullet, number: 0, letter: '', labelLength: 1 };
  }
  if (num) {
    return {
      ...base,
      kind: 'number',
      mark: numDelim ?? '.',
      number: Number(num),
      letter: '',
      labelLength: num.length,
    };
  }
  return {
    ...base,
    kind: 'letter',
    mark: letterDelim ?? '.',
    number: 0,
    letter: letter ?? 'a',
    labelLength: 1,
  };
}

function nextLetter(letter: string): string {
  if (letter === 'z' || letter === 'Z') return letter;
  return String.fromCharCode(letter.charCodeAt(0) + 1);
}

/** Marker of the item that follows `item` at the same level, including its box. */
function followingMarker(item: ListItem): string {
  const label =
    item.kind === 'bullet'
      ? item.mark
      : item.kind === 'number'
        ? `${item.number + 1}${item.mark}`
        : `${nextLetter(item.letter)}${item.mark}`;
  return `${label}${item.gap}${item.checked === null ? '' : '[ ] '}`;
}

// Enter -----------------------------------------------------------------------

/**
 * Enter on a list item: starts the next item, or on an empty item leaves the
 * list (or goes up one level when indented). Null if a cursor is not after
 * the marker of a list item, so the default Enter applies.
 */
export function continueList(state: EditorState): TransactionSpec | null {
  const unit = getIndentUnit(state);
  let applies = true;
  const result = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.head);
    const item = parseItem(line.text);
    if (
      !item ||
      range.from - line.from < item.contentStart ||
      state.doc.lineAt(range.to).number !== line.number
    ) {
      applies = false;
      return { range };
    }
    const empty = line.text.slice(item.contentStart).trim() === '' && range.empty;
    if (empty) {
      if (item.indent.length > 0) {
        // Go up one level: remove one indent unit from the line start.
        const width = Math.max(0, countColumns(item.indent, state.tabSize) - unit);
        const indent = indentString(state, width);
        return {
          changes: { from: line.from, to: line.from + item.indent.length, insert: indent },
          range: EditorSelection.cursor(range.head - item.indent.length + indent.length),
        };
      }
      // Leave the list: clear the marker.
      return {
        changes: { from: line.from, to: line.to, insert: '' },
        range: EditorSelection.cursor(line.from),
      };
    }
    const insert = `\n${item.indent}${followingMarker(item)}`;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length),
    };
  });
  if (!applies) return null;
  return { ...result, scrollIntoView: true, userEvent: 'input' };
}

function countColumns(indent: string, tabSize: number): number {
  let col = 0;
  for (const ch of indent) col += ch === '\t' ? tabSize - (col % tabSize) : 1;
  return col;
}

// Tab / Shift+Tab -------------------------------------------------------------

/**
 * Changes the level of every list line touched by the selection. Null when
 * a selected line is not a list item, so Tab keeps its usual meaning.
 */
export function indentList(state: EditorState, direction: 1 | -1): TransactionSpec | null {
  const unit = getIndentUnit(state);
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      const item = parseItem(line.text);
      if (!item) return null;
      const width = countColumns(item.indent, state.tabSize);
      const target = direction > 0 ? width + unit : Math.max(0, width - unit);
      if (target === width) continue;
      changes.push({
        from: line.from,
        to: line.from + item.indent.length,
        insert: indentString(state, target),
      });
      // A nested ordered item starts a new count; renumbering fixes it if the sublist exists.
      if (direction > 0 && item.kind !== 'bullet') {
        const first = item.kind === 'number' ? '1' : item.letter <= 'Z' ? 'A' : 'a';
        changes.push({
          from: line.from + item.labelStart,
          to: line.from + item.labelStart + item.labelLength,
          insert: first,
        });
      }
    }
  }
  if (changes.length === 0) return direction > 0 ? null : { userEvent: 'input.indent' };
  return { changes, userEvent: direction > 0 ? 'input.indent' : 'delete.dedent' };
}

// Task boxes ------------------------------------------------------------------

/**
 * Toggles "[ ]" / "[x]" on every selected list line. A list item without a
 * box gets one. Null when no selected line is a list item.
 */
export function toggleTask(state: EditorState): TransactionSpec | null {
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      const item = parseItem(line.text);
      if (!item) continue;
      const boxStart =
        line.from +
        item.labelStart +
        item.labelLength +
        (item.kind === 'bullet' ? 0 : 1) +
        item.gap.length;
      if (item.checked === null) {
        changes.push({ from: boxStart, insert: '[ ] ' });
      } else {
        changes.push({ from: boxStart + 1, to: boxStart + 2, insert: item.checked ? ' ' : 'x' });
      }
    }
  }
  return changes.length > 0 ? { changes, userEvent: 'input' } : null;
}

// Renumbering -----------------------------------------------------------------

/**
 * Changes that renumber the ordered lists touching lines `from`..`to`.
 * Within a list, each run of siblings at the same indentation counts up
 * from its first item; letters follow the same rule.
 */
export function renumberChanges(state: EditorState, from: number, to: number): ChangeSpec[] {
  const { doc } = state;
  const isListOrBlank = (n: number) => {
    const text = doc.line(n).text;
    return text.trim() === '' || parseItem(text) !== null;
  };
  let start = from;
  while (start > 1 && isListOrBlank(start - 1) && from - start < 1000) start--;
  let end = to;
  while (end < doc.lines && isListOrBlank(end + 1) && end - to < 1000) end++;

  const changes: ChangeSpec[] = [];
  /** Open runs by indentation width: the next expected label. */
  const runs: { width: number; kind: ListItem['kind']; next: number }[] = [];
  for (let n = start; n <= end; n++) {
    const line = doc.line(n);
    const item = parseItem(line.text);
    if (!item) {
      // Blank lines keep the list going, any other text ends it.
      if (line.text.trim() !== '') runs.length = 0;
      continue;
    }
    const width = countColumns(item.indent, state.tabSize);
    while (runs.length > 0 && (runs[runs.length - 1] as { width: number }).width > width)
      runs.pop();
    let run = runs[runs.length - 1];
    if (!run || run.width !== width || run.kind !== item.kind) {
      if (run && run.width === width) runs.pop();
      const first = item.kind === 'letter' ? item.letter.charCodeAt(0) : item.number;
      run = { width, kind: item.kind, next: first };
      runs.push(run);
    }
    if (item.kind === 'bullet') continue;
    const expected =
      item.kind === 'number'
        ? String(run.next)
        : String.fromCharCode(Math.min(run.next, item.letter <= 'Z' ? 90 : 122));
    const label = line.text.slice(item.labelStart, item.labelStart + item.labelLength);
    if (label !== expected) {
      changes.push({
        from: line.from + item.labelStart,
        to: line.from + item.labelStart + item.labelLength,
        insert: expected,
      });
    }
    run.next++;
  }
  return changes;
}
