import type { CascadesExtension } from '../api';
import cascades from './cascades';
import defaultKeybindings from './default-keybindings';
import editorCommands from './editor-commands';
import editorSettings from './editor-settings';
import fileOps from './file-ops';
import indentKeep from './indent-keep';
import statusBar from './status-bar';
import tabs from './tabs';

/** Built-in extensions, in activation order. */
export const builtinExtensions: CascadesExtension[] = [
  editorSettings,
  indentKeep,
  cascades,
  editorCommands,
  fileOps,
  tabs,
  statusBar,
  defaultKeybindings,
];
