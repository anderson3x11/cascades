import type { CascadesExtension } from '../api';
import cascades from './cascades';
import conflicts from './conflicts';
import defaultKeybindings from './default-keybindings';
import editorCommands from './editor-commands';
import editorSettings from './editor-settings';
import fileOps from './file-ops';
import fileWatcher from './file-watcher';
import indentKeep from './indent-keep';
import layout from './layout';
import smartLists from './smart-lists';
import palette from './palette';
import preview from './preview';
import viewers from './viewers';
import quarantine from './quarantine';
import quickOpen from './quick-open';
import session from './session';
import statusBar from './status-bar';
import tabs from './tabs';
import themes from './themes';

/** Built-in extensions, in activation order. */
export const builtinExtensions: CascadesExtension[] = [
  themes,
  layout,
  editorSettings,
  indentKeep,
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
  palette,
  quickOpen,
  quarantine,
  statusBar,
  defaultKeybindings,
];
