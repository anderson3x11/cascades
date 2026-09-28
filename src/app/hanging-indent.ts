import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';

/** CodeMirror's default left padding of a line, kept on top of the indent. */
const LINE_PADDING = '6px';

function indentWidth(text: string, tabSize: number): number {
  let col = 0;
  for (const ch of text) {
    if (ch === ' ') col++;
    else if (ch === '\t') col += tabSize - (col % tabSize);
    else break;
  }
  return col;
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc, tabSize } = view.state;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = doc.lineAt(pos);
      pos = line.to + 1;
      const width = indentWidth(line.text, tabSize);
      if (width === 0 || width === line.length) continue;
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          attributes: {
            style: `padding-left: calc(${width}ch + ${LINE_PADDING}); text-indent: -${width}ch`,
          },
        }),
      );
    }
  }
  return builder.finish();
}

/**
 * Hanging indent: when an indented line wraps, the continuation lines start
 * under its text instead of at the left edge (and do not cross cascades).
 * Harmless when nothing wraps: the first line stays where it was.
 */
export function hangingIndent(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.startState.tabSize !== update.state.tabSize
        ) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
