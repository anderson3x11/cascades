import {
  EditorSelection,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import { Decoration, EditorView, gutter, GutterMarker } from '@codemirror/view';

class BookmarkMarker extends GutterMarker {
  override elementClass = 'cm-bookmark';
  override toDOM() {
    const dot = document.createElement('span');
    dot.className = 'cm-bookmark-dot';
    dot.setAttribute('aria-label', 'Signet');
    return dot;
  }
}
const marker = new BookmarkMarker();
const lineMark = Decoration.line({ class: 'cm-bookmarked-line' });

/** Adds or removes the bookmarks of these line starts. */
const toggle = StateEffect.define<number[]>();

/** Bookmarked lines, as markers at their line start; they follow the text as it changes. */
export const bookmarks = StateField.define<RangeSet<BookmarkMarker>>({
  create: () => RangeSet.empty,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(toggle)) continue;
      for (const from of effect.value) {
        let present = false;
        next.between(from, from, () => {
          present = true;
        });
        next = present
          ? next.update({ filter: (at) => at !== from, filterFrom: from, filterTo: from })
          : next.update({ add: [marker.range(from)], sort: true });
      }
    }
    // Two bookmarks that ended on the same line (a line was joined) make one.
    const builder = new RangeSetBuilder<BookmarkMarker>();
    let last = -1;
    for (let cursor = next.iter(); cursor.value; cursor.next()) {
      const lineStart = tr.state.doc.lineAt(cursor.from).from;
      if (lineStart !== last) builder.add(lineStart, lineStart, marker);
      last = lineStart;
    }
    return builder.finish();
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) => {
      const builder = new RangeSetBuilder<Decoration>();
      for (let cursor = state.field(field).iter(); cursor.value; cursor.next()) {
        builder.add(cursor.from, cursor.from, lineMark);
      }
      return builder.finish();
    }),
});

/** Line numbers (1-based) of the bookmarks, top to bottom. */
export function bookmarkedLines(state: EditorState): number[] {
  const lines: number[] = [];
  const set = state.field(bookmarks, false);
  for (let cursor = set?.iter(); cursor?.value; cursor.next()) {
    lines.push(state.doc.lineAt(cursor.from).number);
  }
  return lines;
}

/** Bookmarks on the lines of the cursors, or off if there was one. */
export function toggleBookmarks(view: EditorView): void {
  const starts = [
    ...new Set(view.state.selection.ranges.map((r) => view.state.doc.lineAt(r.head).from)),
  ];
  view.dispatch({ effects: toggle.of(starts) });
}

/** Moves to the next (or previous) bookmark, round the document; false if there is none. */
export function goToBookmark(view: EditorView, direction: 1 | -1): boolean {
  const lines = bookmarkedLines(view.state);
  if (lines.length === 0) return false;
  const current = view.state.doc.lineAt(view.state.selection.main.head).number;
  const target =
    direction > 0
      ? (lines.find((n) => n > current) ?? (lines[0] as number))
      : ([...lines].reverse().find((n) => n < current) ?? (lines.at(-1) as number));
  goToLine(view, target);
  return true;
}

/** Puts the cursor at the start of a line, in the middle of the view. */
export function goToLine(view: EditorView, line: number): void {
  const pos = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines)).from;
  view.dispatch({
    selection: EditorSelection.cursor(pos),
    effects: EditorView.scrollIntoView(pos, { y: 'center' }),
  });
  view.focus();
}

export const bookmarkExtension: Extension = [
  bookmarks,
  gutter({
    class: 'cm-bookmark-gutter',
    markers: (view) => view.state.field(bookmarks),
  }),
  EditorView.baseTheme({
    '.cm-bookmark-gutter': { width: '10px' },
    '.cm-bookmark-gutter .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.cm-bookmark-dot': {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: 'var(--accent)',
    },
    '.cm-bookmarked-line': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)',
    },
  }),
];
