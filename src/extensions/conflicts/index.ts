import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { defineExtension, t } from '../../api';
import { findConflicts, resolve, type Choice, type ConflictBlock } from './blocks';

const choices = (): [Choice, string][] => [
  ['mine', t('Keep mine')],
  ['theirs', t('Keep the one on disk')],
  ['both', t('Keep both')],
];

function docLines(state: EditorState): string[] {
  const lines: string[] = [];
  for (const line of state.doc.iterLines()) lines.push(line);
  return lines;
}

function applyChoice(view: EditorView, start: number, choice: Choice): void {
  // Re-read the block from the current document: positions may have moved.
  const lines = docLines(view.state);
  const block = findConflicts(lines).find((b) => b.start === start);
  if (!block) return;
  const { doc } = view.state;
  const kept = resolve(lines, block, choice);
  const from = doc.line(block.start).from;
  const to = doc.line(block.end).to;
  // With nothing kept, also remove the line break after the block.
  const end = kept.length === 0 && to < doc.length ? to + 1 : to;
  view.dispatch({
    changes: { from, to: end, insert: kept.join('\n') },
    selection: { anchor: from },
    userEvent: 'input.conflict',
  });
  view.focus();
}

class ChoiceButtons extends WidgetType {
  constructor(readonly start: number) {
    super();
  }

  override eq(other: ChoiceButtons): boolean {
    return other.start === this.start;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('span');
    box.className = 'cm-conflict-actions';
    for (const [choice, label] of choices()) {
      const button = document.createElement('button');
      button.textContent = label;
      // Keep the editor selection where it is until the click is handled.
      button.onmousedown = (e) => e.preventDefault();
      button.onclick = () => applyChoice(view, this.start, choice);
      box.appendChild(button);
    }
    return box;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function decorate(state: EditorState, blocks: readonly ConflictBlock[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = state;
  const line = (n: number, cls: string) => {
    const from = doc.line(n).from;
    builder.add(from, from, Decoration.line({ class: cls }));
  };
  for (const block of blocks) {
    line(block.start, 'cm-conflict-marker');
    builder.add(
      doc.line(block.start).to,
      doc.line(block.start).to,
      Decoration.widget({ widget: new ChoiceButtons(block.start), side: 1 }),
    );
    for (let n = block.start + 1; n < block.end; n++) {
      if (n === block.separator || n === block.base) line(n, 'cm-conflict-marker');
      else if (n < (block.base ?? block.separator)) line(n, 'cm-conflict-mine');
      else if (n > block.separator) line(n, 'cm-conflict-theirs');
      else line(n, 'cm-conflict-base');
    }
    line(block.end, 'cm-conflict-marker');
  }
  return builder.finish();
}

const conflictField = StateField.define<DecorationSet>({
  create: (state) => decorate(state, findConflicts(docLines(state))),
  update: (value, tr) =>
    tr.docChanged ? decorate(tr.state, findConflicts(docLines(tr.state))) : value,
  provide: (field) => EditorView.decorations.from(field),
});

const theme = EditorView.theme({
  '.cm-conflict-marker': { backgroundColor: 'var(--conflict-marker-bg)', color: 'var(--ui-fg)' },
  '.cm-conflict-mine': { backgroundColor: 'var(--conflict-mine-bg)' },
  '.cm-conflict-theirs': { backgroundColor: 'var(--conflict-theirs-bg)' },
  '.cm-conflict-base': { backgroundColor: 'var(--conflict-marker-bg)', opacity: '0.7' },
  '.cm-conflict-actions': { marginLeft: '12px', fontFamily: 'var(--font-ui)', fontSize: '12px' },
  '.cm-conflict-actions button': {
    marginRight: '6px',
    padding: '0 8px',
    border: '1px solid var(--ui-border)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    font: 'inherit',
    cursor: 'pointer',
  },
  '.cm-conflict-actions button:hover': {
    backgroundColor: 'var(--menu-active-bg)',
    borderColor: 'var(--menu-active-bg)',
    color: 'var(--menu-active-fg)',
  },
});

/** Highlights conflict blocks and offers to keep one side or both. Works for git conflicts too. */
export default defineExtension({
  id: 'cascades.conflicts',
  activate(ctx) {
    ctx.editor.addExtension(() => [conflictField, theme]);
  },
});
