import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { visit } from 'jsonc-parser';
import { defineExtension } from '../../api';

/** Past this size the whole file is not scanned on each edit. */
const MAX_LENGTH = 1_000_000;

const comment = Decoration.mark({ class: 'cm-json-comment' });

/** Ranges of the `//` and `/* *\/` comments of a JSON text. */
export function commentRanges(text: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  visit(text, {
    onComment: (offset, length) => ranges.push({ from: offset, to: offset + length }),
  });
  return ranges;
}

function decorate(view: EditorView): DecorationSet {
  if (view.state.doc.length > MAX_LENGTH) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of commentRanges(view.state.doc.toString())) {
    builder.add(from, to, comment);
  }
  return builder.finish();
}

const commentHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = decorate(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = decorate(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

// The JSON grammar does not know comments and colors their words as code:
// the comment color must win over those inner spans.
const theme = EditorView.baseTheme({
  '.cm-json-comment, .cm-json-comment *': {
    color: 'var(--syn-comment) !important',
    fontStyle: 'italic',
  },
});

/**
 * Colors comments in JSON files (settings.json, keybindings.json, tsconfig…)
 * like comments of any other language.
 */
export default defineExtension({
  id: 'cascades.json-comments',
  activate(ctx) {
    ctx.editor.addExtension((tab) => (tab.language === 'json' ? [commentHighlighter, theme] : []));
  },
});
