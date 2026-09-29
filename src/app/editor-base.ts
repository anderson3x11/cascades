import { EditorState, type Extension } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  keymap,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentLess, insertTab } from '@codemirror/commands';
import { bracketMatching, foldKeymap, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { language } from '../core/i18n/i18n';
import { FRENCH_PHRASES } from './editor-phrases';
import { editorTheme } from './editor-theme';
import { hangingIndent } from './hanging-indent';

/**
 * Editing behavior that every tab gets. Anything a user may want to toggle
 * (line numbers, wrapping, tab size...) is contributed by extensions instead.
 */
export function baseExtensions(): Extension {
  return [
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    language() === 'fr' ? EditorState.phrases.of(FRENCH_PHRASES) : [],
    // The search panel above the text, where the eye already is.
    search({ top: true }),
    indentOnInput(),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightSelectionMatches(),
    keymap.of([
      { key: 'Tab', run: insertTab, shift: indentLess },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
    ]),
    hangingIndent(),
    editorTheme(),
  ];
}
