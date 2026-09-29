import type { CascadesExtension } from '../api';
import autoPairs from './auto-pairs';
import cascades from './cascades';
import conflicts from './conflicts';
import defaultKeybindings from './default-keybindings';
import editorCommands from './editor-commands';
import editorSettings from './editor-settings';
import explorer from './explorer';
import fileOps from './file-ops';
import fileWatcher from './file-watcher';
import indentKeep from './indent-keep';
import insertDate from './insert-date';
import jsonComments from './json-comments';
import layout from './layout';
import links from './links';
import markdownTables from './markdown-tables';
import smartLists from './smart-lists';
import palette from './palette';
import preferences from './preferences';
import preview from './preview';
import viewers from './viewers';
import quarantine from './quarantine';
import quickOpen from './quick-open';
import search from './search';
import session from './session';
import split from './split';
import statusBar from './status-bar';
import tabs from './tabs';
import textTools from './text-tools';
import themes from './themes';

/** Built-in extensions, in activation order. */
export const builtinExtensions: CascadesExtension[] = [
  themes,
  layout,
  editorSettings,
  indentKeep,
  autoPairs,
  links,
  insertDate,
  markdownTables,
  textTools,
  jsonComments,
  smartLists,
  cascades,
  conflicts,
  editorCommands,
  fileOps,
  fileWatcher,
  // Before the session, which reopens images with their viewer.
  viewers,
  preview,
  // Before tabs, which opens an untitled tab only when nothing was restored.
  session,
  tabs,
  split,
  palette,
  quickOpen,
  explorer,
  // After the explorer: its tab comes second in the left panel.
  search,
  quarantine,
  statusBar,
  preferences,
  defaultKeybindings,
];
