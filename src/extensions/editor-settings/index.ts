import { EditorState, Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  ViewPlugin,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view';
import { codeFolding, foldGutter, indentUnit } from '@codemirror/language';
import { defineExtension, t } from '../../api';

const CHEVRON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.5 6l3.5 3.5L11.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Folding with a large clickable chevron and a "⋯ N lignes" placeholder. */
const folding = [
  codeFolding({
    preparePlaceholder: (state, range) =>
      state.doc.lineAt(range.to).number - state.doc.lineAt(range.from).number,
    placeholderDOM(_view, onclick, lines: number) {
      const el = document.createElement('span');
      el.className = 'cm-foldPlaceholder';
      el.textContent = `⋯ ${lines === 1 ? t('1 line') : t('{count} lines', { count: lines })}`;
      el.title = t('Unfold');
      el.onclick = onclick;
      return el;
    },
  }),
  foldGutter({
    markerDOM(open) {
      const el = document.createElement('span');
      el.className = open ? 'cm-fold-marker' : 'cm-fold-marker cm-fold-closed';
      el.title = open ? t('Fold') : t('Unfold');
      el.innerHTML = CHEVRON;
      return el;
    },
  }),
  EditorView.theme({
    '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer' },
    '.cm-fold-marker': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '100%',
      color: 'var(--ui-fg)',
      opacity: '0',
      transition: 'opacity 120ms, transform 120ms',
    },
    // Open markers show when the gutter is hovered, closed ones always.
    '.cm-gutters:hover .cm-fold-marker, .cm-fold-marker.cm-fold-closed': { opacity: '0.8' },
    '.cm-fold-marker:hover': { opacity: '1', color: 'var(--fg)' },
    '.cm-fold-closed': { transform: 'rotate(-90deg)' },
    '.cm-foldPlaceholder': {
      margin: '0 6px',
      padding: '0 8px',
      borderRadius: '10px',
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      cursor: 'pointer',
    },
    '.cm-foldPlaceholder:hover': { color: 'var(--fg)' },
  }),
];

const STATE_FILE = 'ui-state.json';
const MIN_FONT = 6;
const MAX_FONT = 72;
/** Wheel distance for one zoom step: one mouse notch (touchpads add up smaller deltas). */
const WHEEL_STEP = 100;

/** Ctrl+wheel zooms; the listener is not passive so the page itself does not zoom. */
function wheelZoom(zoomBy: (steps: number) => void): Extension {
  return ViewPlugin.define((view) => {
    let accumulated = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      accumulated += event.deltaY;
      const steps = Math.trunc(accumulated / WHEEL_STEP);
      if (steps === 0) return;
      accumulated -= steps * WHEEL_STEP;
      zoomBy(-steps);
    };
    view.scrollDOM.addEventListener('wheel', onWheel, { passive: false });
    return { destroy: () => view.scrollDOM.removeEventListener('wheel', onWheel) };
  });
}

/** Editor options driven by settings, overridable per language, and zoom. */
export default defineExtension({
  id: 'cascades.editor-settings',
  async activate(ctx) {
    ctx.settings.register('editor', {
      tabSize: { type: 'number', default: 4, description: t('Width of a tab.') },
      insertSpaces: {
        type: 'boolean',
        default: false,
        description: t('Indent with spaces instead of tabs.'),
      },
      wordWrap: { type: 'boolean', default: false, description: t('Wrap long lines.') },
      lineNumbers: {
        type: 'boolean',
        default: true,
        description: t('Show line numbers.'),
      },
      folding: { type: 'boolean', default: true, description: t('Show the folding margin.') },
      highlightActiveLine: {
        type: 'boolean',
        default: true,
        description: t('Highlight the line of the cursor.'),
      },
      fontSize: { type: 'number', default: 14, description: t('Font size of the editor (px).') },
      fontFamily: {
        type: 'string',
        default: "'Cascadia Code', Consolas, monospace",
        description: t('Font of the editor (a CSS list, the first installed one is used).'),
      },
      lineHeight: {
        type: 'number',
        default: 1.6,
        description: t('Line height, as a multiple of the font size.'),
      },
      fontLigatures: {
        type: 'boolean',
        default: false,
        description: t('Use the ligatures of the font (=> becomes ⇒ with Cascadia Code…).'),
      },
    });

    // Zoom: a number of 1px steps added to every editor font size, kept across restarts.
    let zoom = 0;
    try {
      const saved: unknown = JSON.parse((await ctx.configFiles.read(STATE_FILE)) ?? '{}');
      const value = (saved as { zoom?: unknown }).zoom;
      if (typeof value === 'number' && Number.isInteger(value)) zoom = value;
    } catch {
      // A broken state file only loses the zoom level.
    }

    const zoomBy = (steps: number) => {
      // Keep the zoom within what the font size limits allow, so no step is wasted.
      const base = ctx.settings.get<number>('editor.fontSize');
      const next =
        steps === 0 ? 0 : Math.max(MIN_FONT - base, Math.min(MAX_FONT - base, zoom + steps));
      if (next === zoom) return;
      zoom = next;
      handle.refresh();
      void ctx.configFiles.write(STATE_FILE, JSON.stringify({ zoom }));
    };

    const handle = ctx.editor.addExtension((tab) => {
      const get = <T>(key: string) => ctx.settings.get<T>(`editor.${key}`, tab.language);
      const tabSize = get<number>('tabSize');
      const fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, get<number>('fontSize') + zoom));
      return [
        EditorState.tabSize.of(tabSize),
        indentUnit.of(get<boolean>('insertSpaces') ? ' '.repeat(tabSize) : '\t'),
        get<boolean>('wordWrap') ? EditorView.lineWrapping : [],
        get<boolean>('lineNumbers') ? [lineNumbers(), highlightActiveLineGutter()] : [],
        get<boolean>('folding') ? folding : [],
        get<boolean>('highlightActiveLine') ? highlightActiveLine() : [],
        // Above the base theme, which sets default fonts.
        Prec.highest(
          EditorView.theme({
            '.cm-scroller': {
              fontSize: `${fontSize}px`,
              fontFamily: get<string>('fontFamily'),
              lineHeight: String(get<number>('lineHeight')),
              fontVariantLigatures: get<boolean>('fontLigatures') ? 'normal' : 'none',
            },
          }),
        ),
        wheelZoom((steps) => zoomBy(steps)),
      ];
    });

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('editor.'))) handle.refresh();
    });

    ctx.commands.register('view.zoomIn', () => zoomBy(1), {
      title: t('Zoom in'),
      category: t('View'),
    });
    ctx.commands.register('view.zoomOut', () => zoomBy(-1), {
      title: t('Zoom out'),
      category: t('View'),
    });
    ctx.commands.register('view.zoomReset', () => zoomBy(0), {
      title: t('Reset zoom'),
      category: t('View'),
    });
    ctx.menus.registerItem('view', { command: 'view.zoomIn', group: '3_zoom', order: 1 });
    ctx.menus.registerItem('view', { command: 'view.zoomOut', group: '3_zoom', order: 2 });
    ctx.menus.registerItem('view', { command: 'view.zoomReset', group: '3_zoom', order: 3 });
  },
});
