/**
 * Public extension API. Built-in features and user code (init.js, later
 * plugins) go through this module only. Anything an extension needs that is
 * missing here is a gap in the API, not a reason to import app internals.
 */
import type { EditorState, Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export type { EditorState, Extension, EditorView };

export interface Disposable {
  dispose(): void;
}

// Commands ------------------------------------------------------------------

export type CommandHandler = (...args: unknown[]) => unknown;

export interface CommandMeta {
  title?: string;
  category?: string;
}

export interface CommandsApi {
  register(id: string, handler: CommandHandler, meta?: CommandMeta): Disposable;
  execute(id: string, ...args: unknown[]): Promise<unknown>;
  list(): ({ id: string } & CommandMeta)[];
}

// Keybindings ---------------------------------------------------------------

export interface KeybindingSpec {
  /** "Ctrl+Shift+P", sequences with spaces: "Ctrl+K Z". */
  key: string;
  command: string;
  args?: unknown[];
  /** Context condition, e.g. "editorFocus && !previewOpen". */
  when?: string;
}

export interface KeybindingsApi {
  register(bindings: KeybindingSpec | KeybindingSpec[]): Disposable;
}

// Menus ---------------------------------------------------------------------

export interface MenuSpec {
  id: string;
  title: string;
  /** Position in the menu bar, lower first (Fichier 10, Édition 20, Affichage 30). */
  order?: number;
}

export interface MenuItemSpec {
  command: string;
  /** Defaults to the command title. */
  title?: string;
  /** Items are grouped by this key (sorted as strings, e.g. "1_new"), separated by a line. */
  group?: string;
  /** Position inside the group, lower first. */
  order?: number;
}

export interface MenusApi {
  registerMenu(menu: MenuSpec): Disposable;
  /** Adds an item to a menu, which may be registered by another extension. */
  registerItem(menuId: string, item: MenuItemSpec): Disposable;
}

// Settings ------------------------------------------------------------------

export interface SettingSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default: unknown;
  description?: string;
  enum?: readonly unknown[];
}

export interface SettingsApi {
  /** Declares settings under `namespace` ("editor" -> "editor.tabSize"). */
  register(namespace: string, properties: Record<string, SettingSchema>): Disposable;
  /** Effective value, with the per-language override when `language` is given. */
  get<T>(key: string, language?: string): T;
  onDidChange(listener: (change: { keys: string[] }) => void): Disposable;
}

// Context keys --------------------------------------------------------------

export type ContextValue = string | number | boolean | undefined;

export interface ContextApi {
  get(key: string): ContextValue;
  set(key: string, value: ContextValue): void;
}

// Workspace -----------------------------------------------------------------

export type LineEnding = 'lf' | 'crlf';

export interface TabInfo {
  readonly id: string;
  /** null for an untitled buffer. */
  readonly path: string | null;
  readonly title: string;
  readonly encoding: string;
  readonly bom: boolean;
  readonly lineEnding: LineEnding;
  /** Lower-case language name ("markdown", "javascript", "plaintext"). */
  readonly language: string;
  readonly dirty: boolean;
}

export interface OpenOptions {
  path: string | null;
  text: string;
  encoding?: string;
  bom?: boolean;
  lineEnding?: LineEnding;
}

export interface TabPatch {
  path?: string | null;
  encoding?: string;
  bom?: boolean;
  lineEnding?: LineEnding;
}

export interface WorkspaceApi {
  tabs(): readonly TabInfo[];
  active(): TabInfo | null;
  findByPath(path: string): TabInfo | null;
  /** Opens a new tab and activates it. */
  open(options: OpenOptions): TabInfo;
  activate(id: string): void;
  /** Closes without asking. Prompting for unsaved changes is the caller's job. */
  close(id: string): void;
  /** Document text with "\n" line endings. */
  getText(id: string): string;
  update(id: string, patch: TabPatch): void;
  /** Marks the current content as the saved state (clears `dirty`). */
  markSaved(id: string): void;
}

// Editor --------------------------------------------------------------------

/** Builds the CodeMirror extension for one tab. Called again on refresh() or language change. */
export type EditorExtensionProvider = (tab: TabInfo) => Extension;

export interface EditorExtensionHandle extends Disposable {
  /** Rebuilds this provider's extension for every tab (e.g. after a settings change). */
  refresh(): void;
}

export interface EditorApi {
  addExtension(provider: EditorExtensionProvider): EditorExtensionHandle;
  /** The view showing the active tab. */
  view(): EditorView | null;
  state(): EditorState | null;
}

// Status bar ----------------------------------------------------------------

export interface StatusItemOptions {
  id: string;
  alignment: 'left' | 'right';
  /** Higher comes first. */
  priority?: number;
  /** Command run on click. */
  command?: string;
}

export interface StatusItem extends Disposable {
  text: string;
  tooltip: string;
  visible: boolean;
}

export interface StatusBarApi {
  addItem(options: StatusItemOptions): StatusItem;
}

// Files and dialogs ----------------------------------------------------------

export interface TextFile {
  text: string;
  encoding: string;
  bom: boolean;
  lineEnding: LineEnding;
  binary: boolean;
}

export interface FsApi {
  readTextFile(path: string): Promise<TextFile>;
  writeTextFile(
    path: string,
    text: string,
    info: { encoding: string; bom: boolean; lineEnding: LineEnding },
  ): Promise<void>;
}

export interface DialogsApi {
  alert(message: string, title?: string): Promise<void>;
  pickFilesToOpen(): Promise<string[]>;
  /** The first filter's extension is appended when the user types a name without one. */
  pickSavePath(
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[],
  ): Promise<string | null>;
  /** Message box with 2 or 3 buttons; returns the clicked label (last one on cancel). */
  choose<T extends string>(
    message: string,
    options: { title?: string; buttons: [T, T] | [T, T, T] },
  ): Promise<T>;
}

// Events --------------------------------------------------------------------

export interface AppEvents {
  'workspace.didOpen': TabInfo;
  'workspace.didClose': TabInfo;
  'workspace.didChangeActive': TabInfo | null;
  'workspace.didSave': TabInfo;
  /** Path, encoding, line ending, language or dirty flag changed. */
  'workspace.didChangeTab': TabInfo;
  'editor.didUpdate': { tab: TabInfo; docChanged: boolean; selectionChanged: boolean };
}

export interface EventsApi {
  on<K extends keyof AppEvents>(name: K, listener: (payload: AppEvents[K]) => void): Disposable;
}

// Context -------------------------------------------------------------------

export interface ExtensionContext {
  readonly extensionId: string;
  /** Disposed when the extension is deactivated. Everything registered through ctx is added automatically. */
  readonly subscriptions: { add(disposable: Disposable): void };
  readonly commands: CommandsApi;
  readonly keybindings: KeybindingsApi;
  readonly menus: MenusApi;
  readonly settings: SettingsApi;
  readonly context: ContextApi;
  readonly workspace: WorkspaceApi;
  readonly editor: EditorApi;
  readonly statusBar: StatusBarApi;
  readonly events: EventsApi;
  readonly fs: FsApi;
  readonly dialogs: DialogsApi;
}

export interface CascadesExtension {
  /** Unique id: "cascades.*" for built-ins, "user.init" for init.js. */
  id: string;
  activate(ctx: ExtensionContext): void | Promise<void>;
  deactivate?(): void;
}

/** Identity helper that gives type inference to extension modules. */
export function defineExtension(extension: CascadesExtension): CascadesExtension {
  return extension;
}
