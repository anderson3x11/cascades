import { EditorState } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view';
import { codeFolding, foldGutter, indentUnit } from '@codemirror/language';
import { defineExtension } from '../../api';

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
      el.textContent = `⋯ ${lines} ligne${lines > 1 ? 's' : ''}`;
      el.title = 'Déplier';
      el.onclick = onclick;
      return el;
    },
  }),
  foldGutter({
    markerDOM(open) {
      const el = document.createElement('span');
      el.className = open ? 'cm-fold-marker' : 'cm-fold-marker cm-fold-closed';
      el.title = open ? 'Replier' : 'Déplier';
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

/** Editor options driven by settings, overridable per language. */
export default defineExtension({
  id: 'cascades.editor-settings',
  activate(ctx) {
    ctx.settings.register('editor', {
      tabSize: { type: 'number', default: 4, description: 'Largeur d’une tabulation.' },
      insertSpaces: {
        type: 'boolean',
        default: false,
        description: 'Indenter avec des espaces plutôt qu’avec des tabulations.',
      },
      wordWrap: { type: 'boolean', default: false, description: 'Retour à la ligne automatique.' },
      lineNumbers: {
        type: 'boolean',
        default: true,
        description: 'Afficher les numéros de ligne.',
      },
      folding: { type: 'boolean', default: true, description: 'Afficher la marge de repli.' },
      highlightActiveLine: {
        type: 'boolean',
        default: true,
        description: 'Surligner la ligne du curseur.',
      },
      fontSize: { type: 'number', default: 14, description: 'Taille de police de l’éditeur (px).' },
    });

    const handle = ctx.editor.addExtension((tab) => {
      const get = <T>(key: string) => ctx.settings.get<T>(`editor.${key}`, tab.language);
      const tabSize = get<number>('tabSize');
      return [
        EditorState.tabSize.of(tabSize),
        indentUnit.of(get<boolean>('insertSpaces') ? ' '.repeat(tabSize) : '\t'),
        get<boolean>('wordWrap') ? EditorView.lineWrapping : [],
        get<boolean>('lineNumbers') ? [lineNumbers(), highlightActiveLineGutter()] : [],
        get<boolean>('folding') ? folding : [],
        get<boolean>('highlightActiveLine') ? highlightActiveLine() : [],
        EditorView.theme({ '.cm-scroller': { fontSize: `${get<number>('fontSize')}px` } }),
      ];
    });

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('editor.'))) handle.refresh();
    });
  },
});
