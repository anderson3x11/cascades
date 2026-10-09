import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  highlightWhitespace,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

class LineEnd extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-marker-eol';
    el.textContent = '¬';
    return el;
  }

  override eq(): boolean {
    return true;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

const lineEnd = Decoration.widget({ widget: new LineEnd(), side: 1 });

/** "¬" after every visible line that ends with a line break. */
const lineEnds = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view);
    }

    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const { doc } = view.state;
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
          const line = doc.lineAt(pos);
          if (line.number < doc.lines) builder.add(line.to, line.to, lineEnd);
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const theme = EditorView.theme({
  '.cm-marker-eol': { color: 'var(--ui-fg)', opacity: '0.55', pointerEvents: 'none' },
  // Drawn in the interface's muted color rather than CodeMirror's fixed gray.
  '.cm-highlightSpace': {
    backgroundImage: 'radial-gradient(circle at 50% 55%, var(--ui-fg) 12%, transparent 13%)',
    opacity: '0.7',
  },
  '&.cm-hide-spaces .cm-highlightSpace': { backgroundImage: 'none' },
  '&.cm-hide-tabs .cm-highlightTab': { backgroundImage: 'none' },
});

/** Invisible characters drawn as faint marks: spaces, tabs, line ends. */
export function markers(show: { spaces: boolean; tabs: boolean; lineEnds: boolean }): Extension {
  const parts: Extension[] = [];
  if (show.spaces || show.tabs) {
    parts.push(
      highlightWhitespace(),
      EditorView.editorAttributes.of({
        class: [!show.spaces && 'cm-hide-spaces', !show.tabs && 'cm-hide-tabs']
          .filter(Boolean)
          .join(' '),
      }),
    );
  }
  if (show.lineEnds) parts.push(lineEnds);
  return parts.length > 0 ? [parts, theme] : [];
}
