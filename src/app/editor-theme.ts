import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/** Syntax colors, read from the theme's CSS variables so light and dark share one style. */
export const highlight = HighlightStyle.define([
  {
    tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword],
    color: 'var(--syn-keyword)',
  },
  { tag: [t.operator, t.derefOperator], color: 'var(--syn-operator)' },
  { tag: [t.string, t.special(t.string), t.character], color: 'var(--syn-string)' },
  { tag: [t.regexp, t.escape], color: 'var(--syn-regexp)' },
  { tag: [t.number, t.integer, t.float], color: 'var(--syn-number)' },
  { tag: [t.bool, t.null, t.atom, t.constant(t.name), t.unit], color: 'var(--syn-constant)' },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: 'var(--syn-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName],
    color: 'var(--syn-function)',
  },
  {
    tag: [t.typeName, t.className, t.namespace, t.definition(t.typeName)],
    color: 'var(--syn-type)',
  },
  { tag: [t.propertyName, t.labelName], color: 'var(--syn-property)' },
  { tag: [t.variableName, t.definition(t.variableName)], color: 'var(--syn-variable)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--syn-tag)' },
  { tag: t.attributeName, color: 'var(--syn-attribute)' },
  { tag: t.heading, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: [t.link, t.url], color: 'var(--syn-link)', textDecoration: 'underline' },
  { tag: [t.meta, t.processingInstruction, t.documentMeta], color: 'var(--syn-meta)' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.invalid, color: 'var(--syn-invalid)' },
]);

/** CodeMirror chrome (gutters, panels, search, tooltips) mapped onto the theme variables. */
const chrome = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--bg)', color: 'var(--fg)' },
  '.cm-scroller': { fontFamily: 'var(--font-editor)', lineHeight: '1.6' },
  '.cm-gutters': { backgroundColor: 'var(--bg)', color: 'var(--ui-fg)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--active-line)' },
  '.cm-activeLineGutter': { color: 'var(--fg)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
  '& > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
    { backgroundColor: 'var(--selection)' },
  '.cm-searchMatch, .cm-selectionMatch': { backgroundColor: 'var(--match)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--match-selected)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--bracket-match)', outline: 'none' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--ui-hover)',
    color: 'var(--ui-fg)',
    border: 'none',
  },
  '.cm-panels': { backgroundColor: 'var(--ui-bg)', color: 'var(--fg)' },
  '.cm-panels-top': { borderBottom: '1px solid var(--ui-border)' },
  '.cm-panels-bottom': { borderTop: '1px solid var(--ui-border)' },
  '.cm-panel input, .cm-panel button, .cm-panel label': {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
  },
  '.cm-textfield': {
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--ui-border)',
    borderRadius: '4px',
  },
  '.cm-textfield:focus': { outline: '1px solid var(--accent)', borderColor: 'var(--accent)' },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--ui-hover)',
    color: 'var(--fg)',
    border: '1px solid var(--ui-border)',
    borderRadius: '4px',
  },
  '.cm-button:active': { backgroundImage: 'none', backgroundColor: 'var(--ui-border)' },
  '.cm-panel.cm-search [name=close]': { color: 'var(--ui-fg)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--menu-bg)',
    color: 'var(--fg)',
    border: '1px solid var(--ui-border)',
  },
});

export function editorTheme(): Extension {
  return [chrome, syntaxHighlighting(highlight)];
}
