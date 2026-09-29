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
  /** Not listed in the command palette (e.g. commands that need arguments). */
  hidden?: boolean;
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
  /** "Leader" in a key ("Leader Z") stands for the leader key, see setLeader. */
  register(bindings: KeybindingSpec | KeybindingSpec[]): Disposable;
  /** Sets the leader key ("Ctrl+Space"). Throws on an invalid key. */
  setLeader(key: string): void;
  /** Shortcut of a command as shown to the user ("Ctrl+Space T"), or null. */
  label(command: string): string | null;
  /** A key written as in keybindings.json, as shown to the user ("Leader S" -> "Ctrl+Space S"). Throws if invalid. */
  format(key: string): string;
  /** Shortcuts in effect (removed ones are left out), in registration order. */
  list(): KeybindingInfo[];
  /**
   * Waits for the next key combination and returns it as written in
   * keybindings.json ("Ctrl+Shift+N", "Leader S"), or null when Escape is
   * pressed. The keys pressed meanwhile do nothing else.
   */
  capture(): Promise<string | null>;
  /** Called when shortcuts are added or removed, or the leader key changes. */
  onDidChange(listener: () => void): Disposable;
}

export interface KeybindingInfo {
  /** As written: "Ctrl+D", "Leader S". */
  key: string;
  /** As shown: "Ctrl+Space S". */
  label: string;
  command: string;
  when: string | undefined;
  /** "user" for keybindings.json, "default" for the app and its extensions. */
  source: 'default' | 'user';
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
  /** Every declared setting with its schema. */
  schemas(): (SettingSchema & { key: string })[];
  /**
   * Where a value comes from: the default, and what settings.json sets
   * globally and for `language` (undefined when not set there).
   */
  inspect(
    key: string,
    language?: string,
  ): { defaultValue: unknown; globalValue: unknown; languageValue: unknown };
  /** Languages with a "[language]" block in settings.json. */
  overriddenLanguages(): string[];
  /**
   * Writes a user setting to settings.json (or to its "[language]" block).
   * `undefined` removes it, going back to the default.
   */
  update(key: string, value: unknown, language?: string): Promise<void>;
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
  /** Id of the viewer shown instead of the editor (images), or null for a text tab. */
  readonly viewer: string | null;
  /** A big file opened in light mode: extensions leave out their costly work (colors, cascades, counts). */
  readonly large: boolean;
  /** Group (split pane) the tab is in. */
  readonly groupId: string;
  /** Tabs showing the same document (clones in other groups) share this id. */
  readonly documentId: string;
}

export interface GroupInfo {
  id: string;
  tabs: readonly TabInfo[];
  active: TabInfo | null;
}

/**
 * Where a tab goes: an existing group by id, the next or previous one
 * (created if needed), or a new group at the end.
 */
export type GroupTarget = string | 'next' | 'previous' | 'new';

export interface OpenOptions {
  path: string | null;
  text: string;
  /** Opens a view-only tab shown by this "replace" viewer (the text is ignored). */
  viewer?: string;
  /** Name of a tab without a file ("Welcome"); otherwise "Untitled N". */
  title?: string;
  /** A big file: light mode, without syntax colors (see TabInfo.large). */
  large?: boolean;
  encoding?: string;
  bom?: boolean;
  lineEnding?: LineEnding;
  /** Content as saved on disk, when `text` has unsaved changes. Defaults to `text` (clean tab). */
  savedText?: string;
  selection?: { anchor: number; head: number };
  /** Document position shown at the top of the editor. */
  scrollTop?: number;
}

export interface ViewState {
  selection: { anchor: number; head: number };
  /** Document position shown at the top of the editor. */
  scrollTop: number;
}

export interface TabPatch {
  path?: string | null;
  encoding?: string;
  bom?: boolean;
  lineEnding?: LineEnding;
}

export interface WorkspaceApi {
  /** Every tab of every group. */
  tabs(): readonly TabInfo[];
  /** Active tab of the active group. */
  active(): TabInfo | null;
  /** A tab of the file, preferably in the active group. */
  findByPath(path: string): TabInfo | null;
  /** Opens a new document in a tab of the active group (or `group`) and activates it. */
  open(options: OpenOptions, group?: GroupTarget): TabInfo;
  /** Activates a tab and its group. */
  activate(id: string): void;
  /** Closes without asking. Prompting for unsaved changes is the caller's job. */
  close(id: string): void;

  /** Groups (split panes), in screen order. */
  groups(): readonly GroupInfo[];
  activeGroup(): string;
  /** Focuses a group by position (0-based). */
  focusGroup(index: number): void;
  /** Shows the tab's document in another group too (same text, own cursor). Returns the new tab. */
  clone(id: string, target?: GroupTarget): TabInfo | null;
  /** Moves a tab to another group. */
  moveToGroup(id: string, target?: GroupTarget): void;
  /** Groups side by side ("row") or stacked ("column"). */
  orientation(): 'row' | 'column';
  setOrientation(orientation: 'row' | 'column'): void;

  /** Document text with "\n" line endings. */
  getText(id: string): string;
  update(id: string, patch: TabPatch): void;
  /** Marks the current content as the saved state (clears `dirty`). */
  markSaved(id: string): void;
  /** Cursor and scroll position of a tab, to restore it later with `open`. */
  viewState(id: string): ViewState;
  /** Text as last saved (or loaded), which `dirty` compares against. */
  savedText(id: string): string;
  /**
   * Chooses the language of a tab's document by name ("Python", "plaintext"
   * for plain text), or null to detect it from the file name and content.
   */
  setLanguage(id: string, language: string | null): void;
  /** Names of the languages that can be chosen ("Markdown", "Python"…). */
  availableLanguages(): string[];
  /** Changes the saved reference without touching the document (updates `dirty`). */
  setSavedText(id: string, text: string): void;
  /** Replaces the document with `text` (undoable) and marks it saved, e.g. after an external change. */
  reload(id: string, text: string): void;
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
  /**
   * HTML of `code` colored like the editor ("javascript", "python", "rust"...),
   * or null for an unknown language. The HTML is escaped and safe to insert.
   */
  highlightCode(code: string, language: string): Promise<string | null>;
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

// Layout --------------------------------------------------------------------

export type LayoutPart = 'menuBar' | 'tabs' | 'statusBar';

export interface LayoutApi {
  setVisible(part: LayoutPart, visible: boolean): void;
  isVisible(part: LayoutPart): boolean;
  /** Zen mode: full screen, every bar hidden, text centered. */
  setZen(on: boolean): Promise<void>;
  isZen(): boolean;
  /** Sets a CSS variable of the window ("font-ui" for --font-ui); null resets it. */
  setStyle(name: string, value: string | null): void;
}

// Viewers (previews) ------------------------------------------------------------

export interface ViewerInput {
  path: string | null;
  /** Document text ("" for replace viewers). */
  text: string;
}

export interface ViewerInstance {
  /** New text or path; called as the document changes (debounced). */
  update(input: ViewerInput): void;
  /** Keeps the preview aligned with the editor's first visible line (1-based). */
  scrollToLine?(line: number): void;
  dispose(): void;
}

export interface ViewerFactory {
  create(host: HTMLElement, input: ViewerInput): ViewerInstance;
}

export interface ViewerSpec {
  id: string;
  title: string;
  /** File extensions it handles, lower case, without the dot ("md"). */
  extensions: string[];
  /** Languages it handles when the file has no known extension ("markdown"). */
  languages?: string[];
  /** "preview": next to the editor of a text file. "replace": instead of the editor (images). */
  kind: 'preview' | 'replace';
  /** Loaded the first time the viewer is needed, to keep startup fast. */
  load(): Promise<ViewerFactory>;
  /** A "replace" viewer for files that are not text, when no viewer handles their extension. */
  binary?: boolean;
}

export type PreviewMode = 'off' | 'side' | 'full';

export interface ViewersApi {
  register(viewer: ViewerSpec): Disposable;
  /** Preview viewer for a text tab, or null. */
  previewFor(tab: TabInfo): ViewerSpec | null;
  /** Replace viewer for a file path (by extension), or null. */
  replaceFor(path: string): ViewerSpec | null;
  /** Viewer for files that are not text (hex view), or null. */
  binaryViewer(): ViewerSpec | null;
  /** A viewer by id (the `viewer` of a tab). */
  get(id: string): ViewerSpec | undefined;
  previewMode(tabId: string): PreviewMode;
  setPreviewMode(tabId: string, mode: PreviewMode): void;
}

// Side panels -----------------------------------------------------------------

export type PanelSide = 'left' | 'right';

export interface PanelSpec {
  id: string;
  title: string;
  /** Right by default. The panels of one side are shown one at a time, as tabs on the left. */
  side?: PanelSide;
  /** Buttons in the panel header. Called again when the state it reads changes. */
  actions?: () => PanelAction[];
  /** Builds the panel content in `host` when it is shown; disposed when hidden. */
  render(host: HTMLElement): Disposable;
}

export interface PanelAction {
  label: string;
  /** SVG path data on a 16×16 grid, drawn as a 1.2 px stroke. */
  icon: string;
  run(): void;
}

export interface PanelsApi {
  /** A panel beside the editor; one is shown at a time on each side. */
  register(panel: PanelSpec): Disposable;
  show(id: string): void;
  hide(id: string): void;
  toggle(id: string): void;
  isVisible(id: string): boolean;
  /** Hides a side, or shows the panel it showed last. */
  toggleSide(side: PanelSide): void;
}

// Spelling --------------------------------------------------------------------

export interface SpellingApi {
  /**
   * Misspelled words of each line ({ start, length } in string units), with
   * the system's dictionary for a language tag ("fr", "en-US").
   */
  check(language: string, lines: string[]): Promise<{ start: number; length: number }[][]>;
  suggest(language: string, word: string): Promise<string[]>;
  /** Adds a word to the user's dictionary, kept by the system. */
  add(language: string, word: string): Promise<void>;
  /** Language tags with a dictionary installed ("fr-FR", "en-US"). */
  languages(): Promise<string[]>;
}

// Context menu ----------------------------------------------------------------

export type ContextMenuItem =
  { label: string; run: () => void; disabled?: boolean; shortcut?: string } | 'separator';

export interface ContextMenuApi {
  /** Shows a right-click menu at a point of the window (usually the mouse event's clientX/Y). */
  show(position: { x: number; y: number }, items: ContextMenuItem[]): void;
}

// Modals ----------------------------------------------------------------------

export interface ModalSpec {
  title: string;
  /** Builds the content in `host`; disposed when the modal closes. */
  render(host: HTMLElement): Disposable;
}

export interface ModalsApi {
  /**
   * Shows a window over the app (one at a time), closed by its × button,
   * Escape or a click outside. Shortcuts are paused while it is open.
   * Dispose to close it.
   */
  show(modal: ModalSpec): Disposable;
}

// Quick pick ------------------------------------------------------------------

export interface QuickPickItem<T> {
  label: string;
  /** Shown after the label, dimmed. */
  description?: string;
  value: T;
}

export interface QuickPickOptions<T> {
  placeholder?: string;
  /** Item highlighted when the list opens. */
  activeValue?: T;
  /** Called as the highlighted item changes (e.g. to preview a theme). */
  onHighlight?: (item: QuickPickItem<T>) => void;
  /** Items added to the list once ready, for those that take time to find. */
  more?: Promise<QuickPickItem<T>[]>;
}

export interface QuickPickApi {
  /** Floating list with fuzzy search. Resolves to the chosen value, or undefined if cancelled. */
  show<T>(items: QuickPickItem<T>[], options?: QuickPickOptions<T>): Promise<T | undefined>;
}

// Banners -------------------------------------------------------------------

export interface BannerOptions {
  message: string;
  kind?: 'info' | 'warning';
  /** Show the banner only while this tab is active. */
  tabId?: string;
  /** Buttons; clicking one runs it and closes the banner. */
  actions?: { label: string; run: () => void }[];
}

export interface BannersApi {
  /** Shows a non-blocking message above the editor. Dispose to remove it. */
  show(options: BannerOptions): Disposable;
}

// Translation ---------------------------------------------------------------

export interface I18nApi {
  /**
   * Text of the interface, written in English, in the user's language:
   * the text "Close {file}?" with params { file }. Without a translation, the
   * English is shown.
   */
  t(text: string, params?: Record<string, string | number>): string;
  /** Language of the interface ("en", "fr"), fixed until the app restarts. */
  language(): string;
  /** Translations of English texts into `language`, e.g. ("fr", { Hello: 'Bonjour' }). */
  addTranslations(language: string, catalog: Record<string, string>): Disposable;
}

/**
 * Same as ctx.i18n.t, for code that runs outside activate(). Text is
 * translated when t() is called, so call it when the text is needed, never
 * at module load.
 */
export { t } from '../core/i18n/i18n';

// Files and dialogs ----------------------------------------------------------

export interface TextFile {
  text: string;
  encoding: string;
  bom: boolean;
  lineEnding: LineEnding;
  binary: boolean;
}

export interface FsApi {
  /** Detects the encoding, unless one is given ("windows-1252") to read the file with. */
  readTextFile(path: string, encoding?: string): Promise<TextFile>;
  writeTextFile(
    path: string,
    text: string,
    info: { encoding: string; bom: boolean; lineEnding: LineEnding },
  ): Promise<void>;
  /**
   * Calls `listener` when the file is created, modified or removed by any
   * program, this one included: read the file to find out what changed.
   */
  watch(path: string, listener: () => void): Disposable;
  /**
   * URL the page can load for a local file (an image in a preview). Grants
   * access to the file's folder only. Returns the path as is outside the app.
   */
  fileUrl(path: string): Promise<string>;
  /** Size of a file in bytes, without reading it. */
  fileSize(path: string): Promise<number>;
  /** Raw bytes of a file (PDF, binary files), or of `length` bytes from `offset`. */
  readBinary(path: string, range?: { offset: number; length: number }): Promise<Uint8Array>;
  /** Entries of a folder, unsorted. */
  listDir(path: string): Promise<{ name: string; isDir: boolean }[]>;
  /**
   * Every file under the folders, at most `limit`, skipping what .gitignore
   * files ignore and the names matching `exclude` ("node_modules", "*.log").
   */
  listFiles(
    roots: string[],
    exclude: string[],
    limit: number,
  ): Promise<{ files: string[]; truncated: boolean }>;
  /** Creates an empty file; fails if the name is taken. */
  createFile(path: string): Promise<void>;
  createDir(path: string): Promise<void>;
  /** Renames a file or folder; fails if the new name is taken. */
  rename(from: string, to: string): Promise<void>;
  /** Sends a file or folder to the recycle bin. */
  trash(path: string): Promise<void>;
  /** Calls `listener` when an entry of the folder is created, removed or renamed. */
  watchDir(path: string, listener: () => void): Disposable;
  /**
   * Searches the text files of the folders line by line (same skipping as
   * listFiles); `onFile` gets each file with matches as it is found. A new
   * search cancels the previous one.
   */
  searchFiles(request: SearchRequest, onFile: (file: FileMatches) => void): SearchRun;
  /** Replaces what the same search finds in each file, keeping encodings and line endings. */
  replaceInFiles(
    paths: string[],
    query: string,
    options: SearchOptions,
    replacement: string,
  ): Promise<{ path: string; count: number; error: string | null }[]>;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface SearchRequest {
  roots: string[];
  exclude: string[];
  query: string;
  options: SearchOptions;
  /** To preview each replacement ("$1" refers to groups in regex mode). */
  replacement?: string | null;
  /** The search stops past this many matches. */
  maxMatches: number;
}

export interface LineMatch {
  /** 1-based. */
  line: number;
  /** Position and length in the line, in JavaScript string units. */
  column: number;
  length: number;
  /** Text around the match, cut on long lines. */
  before: string;
  matched: string;
  after: string;
  /** What the match becomes, when a replacement is given. */
  replacement: string | null;
}

export interface FileMatches {
  path: string;
  matches: LineMatch[];
}

export interface SearchRun {
  /** Resolves when the search is over; rejects on an invalid expression. */
  done: Promise<{ truncated: boolean; cancelled: boolean }>;
  cancel(): void;
}

export interface DialogsApi {
  alert(message: string, title?: string): Promise<void>;
  pickFilesToOpen(): Promise<string[]>;
  /** A folder chosen by the user, or null. */
  pickFolder(): Promise<string | null>;
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

// Config folder and app lifecycle --------------------------------------------

export interface ConfigFilesApi {
  /** Reads a file of the config folder by name ("session.json"). Null if missing. */
  read(name: string): Promise<string | null>;
  /** Writes a file of the config folder, atomically. */
  write(name: string, content: string): Promise<void>;
  /** File names in a subfolder of the config folder ("themes"). Empty if it does not exist. */
  list(folder: string): Promise<string[]>;
  /** Absolute path of a file of the config folder, to open it in a tab. */
  path(name: string): Promise<string>;
  /** Calls `listener` when the file changes on disk (in the browser: when written). */
  watch(name: string, listener: () => void): Disposable;
  /**
   * Mistakes in the text of settings.json or keybindings.json (syntax, unknown
   * settings or commands, wrong values), with their position. Empty for other files.
   */
  check(name: string, text: string): ConfigProblem[];
}

export interface ConfigProblem {
  from: number;
  to: number;
  severity: 'error' | 'warning';
  message: string;
}

// Themes --------------------------------------------------------------------

export interface ThemeSpec {
  /** "light", "nord"... User themes are "user.<file name>". */
  id: string;
  name: string;
  /** Base palette the colors apply on. */
  type: 'light' | 'dark';
  /** CSS variables without "--": { "bg": "#2e3440", "syn-keyword": "#81a1c1" }. */
  colors: Record<string, string>;
}

export interface ThemesApi {
  /** Registering an existing id replaces that theme. */
  register(theme: ThemeSpec): Disposable;
  list(): ThemeSpec[];
  current(): ThemeSpec | null;
  /** Applies a theme now. Returns false for an unknown id. */
  apply(id: string): boolean;
  /** Validates a theme file; throws an Error explaining the problem. */
  parse(id: string, json: string): ThemeSpec;
}

export interface AppApi {
  /** Runs before the window closes; the app waits for returned promises (a few seconds at most). */
  onWillQuit(handler: () => void | Promise<void>): Disposable;
  /** Opens a web link in the default browser. */
  openExternal(url: string): Promise<void>;
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
  /** Files dropped onto the window, as absolute paths. */
  'app.didDropFiles': string[];
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
  readonly banners: BannersApi;
  readonly quickPick: QuickPickApi;
  readonly layout: LayoutApi;
  readonly viewers: ViewersApi;
  readonly panels: PanelsApi;
  readonly modals: ModalsApi;
  readonly contextMenu: ContextMenuApi;
  readonly spelling: SpellingApi;
  readonly themes: ThemesApi;
  readonly events: EventsApi;
  readonly fs: FsApi;
  readonly dialogs: DialogsApi;
  readonly configFiles: ConfigFilesApi;
  readonly app: AppApi;
  readonly i18n: I18nApi;
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
