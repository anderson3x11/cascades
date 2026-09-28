import { EditorState } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view';
import { foldGutter, indentUnit } from '@codemirror/language';
import { defineExtension } from '../../api';

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
        get<boolean>('folding') ? foldGutter() : [],
        get<boolean>('highlightActiveLine') ? highlightActiveLine() : [],
        EditorView.theme({ '.cm-scroller': { fontSize: `${get<number>('fontSize')}px` } }),
      ];
    });

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('editor.'))) handle.refresh();
    });
  },
});
