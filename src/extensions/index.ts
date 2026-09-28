import type { CascadesExtension } from '../api';
import cascades from './cascades';
import defaultKeybindings from './default-keybindings';
import editorCommands from './editor-commands';
import editorSettings from './editor-settings';
import fileOps from './file-ops';
import indentKeep from './indent-keep';
import smartLists from './smart-lists';
import session from './session';
import statusBar from './status-bar';
import tabs from './tabs';

/** Built-in extensions, in activation order. */
export const builtinExtensions: CascadesExtension[] = [
  editorSettings,
  indentKeep,
  smartLists,
  cascades,
  editorCommands,
  fileOps,
  // Before tabs, which opens an untitled tab only when nothing was restored.
  session,
  tabs,
  statusBar,
  defaultKeybindings,
];
