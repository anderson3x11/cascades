import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppEvents, CascadesExtension, ExtensionContext } from '../api';
import { CommandRegistry } from '../core/commands/registry';
import { ContextKeys } from '../core/context/context-keys';
import { DisposableStore, type Disposable } from '../core/disposable';
import { EventBus } from '../core/events/emitter';
import { ExtensionHost } from '../core/extensions/host';
import { checkKeybindings } from '../core/keybindings/check';
import { parseKeybindings } from '../core/keybindings/file';
import {
  chordFromEvent,
  formatKeySequence,
  keyNotation,
  LEADER,
  parseKeySequence,
} from '../core/keybindings/keys';
import { KeybindingRegistry } from '../core/keybindings/registry';
import { MenuRegistry } from '../core/menus/registry';
import { checkSettings } from '../core/settings/check';
import { editSettings, parseSettings, type ConfigProblem } from '../core/settings/file';
import { SettingsRegistry } from '../core/settings/registry';
import { parseTheme } from '../core/themes/theme';
import * as dialogs from '../platform/dialogs';
import * as fs from '../platform/fs';
import * as search from '../platform/search';
import { watchDir, watchFile } from '../platform/watch';
import { BannerModel } from './banners.svelte';
import { loadUserScript } from './user-script';
import { StatusBarModel } from './status-bar.svelte';
import { highlightCode } from './highlight-code';
import { KeyHintModel } from './key-hint.svelte';
import { LayoutModel } from './layout.svelte';
import { ContextMenuModel } from './context-menu.svelte';
import { ModalModel } from './modals.svelte';
import { PanelModel } from './panels.svelte';
import { QuickPickModel } from './quick-pick.svelte';
import { ThemeService } from './themes';
import { ViewerService } from './viewers.svelte';
import { fileUrl, openExternal } from '../platform/assets';
import { Workspace } from './workspace.svelte';

/** How long closing the window waits for onWillQuit handlers. */
const WILL_QUIT_TIMEOUT_MS = 3000;
const SETTINGS_FILE = 'settings.json';
const KEYBINDINGS_FILE = 'keybindings.json';

export class Workbench {
  readonly commands = new CommandRegistry();
  readonly keybindings = new KeybindingRegistry();
  readonly menus = new MenuRegistry();
  readonly settings = new SettingsRegistry();
  readonly contextKeys = new ContextKeys();
  readonly events = new EventBus<AppEvents>();
  readonly workspace = new Workspace(this.events);
  readonly statusBar = new StatusBarModel();
  readonly banners = new BannerModel();
  readonly themes = new ThemeService();
  readonly quickPick = new QuickPickModel();
  readonly layout = new LayoutModel();
  readonly keyHint = new KeyHintModel();
  readonly viewers = new ViewerService();
  readonly panels = new PanelModel();
  readonly modals = new ModalModel();
  readonly contextMenu = new ContextMenuModel();
  readonly extensions = new ExtensionHost<ExtensionContext>((id, subs) =>
    this.createContext(id, subs),
  );
  private readonly willQuit = new Set<() => void | Promise<void>>();

  async start(builtins: CascadesExtension[]): Promise<void> {
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    // The webview's own menu (Back, Reload, Inspect…) makes no sense in the app.
    // Text fields and the editor keep it, for cut, copy and paste.
    window.addEventListener('contextmenu', (event) => {
      const target = event.target as Element | null;
      if (!target?.closest('input, textarea, [contenteditable="true"]')) event.preventDefault();
    });
    this.events.on('workspace.didChangeActive', (tab) =>
      this.contextKeys.set('editorLangId', tab?.language),
    );
    this.events.on('workspace.didChangeTab', (tab) => {
      if (tab.id === this.workspace.activeId) this.contextKeys.set('editorLangId', tab.language);
    });

    // User values are stored before extensions declare their schemas, so
    // extensions read them from their very first activation.
    await this.loadUserSettings();
    // Hand edits of settings.json apply right away (our own writes change nothing).
    this.watchConfigFile(SETTINGS_FILE, () => void this.loadUserSettings());

    for (const extension of builtins) {
      try {
        await this.extensions.activate(extension);
      } catch (err) {
        console.error(err);
      }
    }
    // After the defaults, so that user shortcuts take precedence.
    await this.loadUserKeybindings();
    this.watchConfigFile(KEYBINDINGS_FILE, () => void this.loadUserKeybindings());

    this.runWillQuitOnClose();
    if (isTauri()) {
      void getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === 'drop')
          this.events.emit('app.didDropFiles', event.payload.paths);
      });
      await this.loadUserScript();
    }
  }

  /** Mounts the editor view of a group and tracks its focus for `when` clauses. */
  attachEditor(groupId: string, parent: HTMLElement): Disposable {
    const attached = this.workspace.attach(groupId, parent);
    const { view } = attached;
    const onFocus = () => this.contextKeys.set('editorFocus', view.hasFocus);
    view.dom.addEventListener('focusin', onFocus);
    view.dom.addEventListener('focusout', onFocus);
    if (groupId === this.workspace.activeGroupId) view.focus();
    return {
      dispose: () => {
        view.dom.removeEventListener('focusin', onFocus);
        view.dom.removeEventListener('focusout', onFocus);
        attached.dispose();
      },
    };
  }

  /** A key combination being recorded (see captureKey). */
  private capturing: { chords: string[]; resolve: (key: string | null) => void } | null = null;

  /**
   * Records the next key combination, in keybindings.json notation. The
   * leader key waits for the key after it ("Leader S"). Escape cancels (null).
   */
  private captureKey(): Promise<string | null> {
    this.capturing?.resolve(null);
    return new Promise((resolve) => (this.capturing = { chords: [], resolve }));
  }

  /** Feeds a key press to the capture in progress. */
  private capture(capturing: NonNullable<typeof this.capturing>, event: KeyboardEvent): void {
    const chord = chordFromEvent(event);
    if (!chord) return;
    event.preventDefault();
    event.stopPropagation();
    if (chord === 'escape') {
      this.capturing = null;
      capturing.resolve(null);
    } else if (capturing.chords.length === 0 && chord === this.keybindings.leaderChord) {
      capturing.chords.push(LEADER);
    } else {
      this.capturing = null;
      capturing.resolve(keyNotation([...capturing.chords, chord]));
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing) return;
    if (this.capturing) return this.capture(this.capturing, event);
    // A modal handles its own keys.
    if (this.modals.current) return;
    const chord = chordFromEvent(event);
    if (!chord) return;
    const hadPending = this.keybindings.pendingChords.length > 0;
    const result = this.keybindings.resolve(chord, this.contextKeys.get);
    if (result.kind === 'none' && !hadPending) return;

    // Swallow matches, sequence prefixes and the chord that broke a sequence.
    event.preventDefault();
    event.stopPropagation();
    this.updateKeyHint();
    if (result.kind === 'match') {
      const { command, args } = result.binding;
      this.commands.execute(command, ...args).catch((err: unknown) => console.error(err));
    }
  };

  /** Banner shown while settings.json cannot be read. */
  private settingsError: Disposable | null = null;

  private async loadUserSettings(): Promise<void> {
    this.settingsError?.dispose();
    this.settingsError = null;
    try {
      this.settings.setUserSettings(parseSettings(await fs.readConfigFile(SETTINGS_FILE)));
    } catch (err) {
      // The previous values stay in effect until the file is fixed.
      this.settingsError = this.showFileError(
        SETTINGS_FILE,
        'preferences.openSettingsFile',
        `ignoré : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** User shortcuts from keybindings.json, replaced on each load. */
  private userKeybindings = new DisposableStore();
  private keybindingsError: Disposable | null = null;

  private async loadUserKeybindings(): Promise<void> {
    this.keybindingsError?.dispose();
    this.keybindingsError = null;
    let problem: string | null = null;
    try {
      const { bindings, errors } = parseKeybindings(await fs.readConfigFile(KEYBINDINGS_FILE));
      this.userKeybindings.dispose();
      this.userKeybindings = new DisposableStore();
      for (const binding of bindings) {
        this.userKeybindings.add(this.keybindings.register(binding, 'user'));
      }
      if (errors.length > 0) {
        const more = errors.length > 1 ? ` (et ${errors.length - 1} autre(s))` : '';
        problem = `${errors[0]}${more}, ignorée.`;
      }
    } catch (err) {
      // The previous shortcuts stay in effect until the file is fixed.
      problem = `ignoré : ${err instanceof Error ? err.message : String(err)}`;
    }
    this.keyHint.clear();
    if (problem) {
      this.keybindingsError = this.showFileError(
        KEYBINDINGS_FILE,
        'preferences.openKeybindingsFile',
        problem,
      );
    }
  }

  private checkConfigFile(name: string, text: string): ConfigProblem[] {
    if (name === SETTINGS_FILE) return checkSettings(text, (key) => this.settings.schema(key));
    if (name === KEYBINDINGS_FILE) return checkKeybindings(text, (id) => this.commands.has(id));
    return [];
  }

  private showFileError(file: string, openCommand: string, problem: string): Disposable {
    const open = () => this.commands.execute(openCommand).catch(console.error);
    return this.banners.show({
      kind: 'warning',
      message: `${file} ${problem}`,
      actions: [{ label: 'Ouvrir le fichier', run: () => void open() }],
    });
  }

  /**
   * Writes one user setting to settings.json. Only that value changes in the
   * file: comments and everything else are kept as written.
   */
  private async updateSetting(key: string, value: unknown, language?: string): Promise<void> {
    // Re-read the file so that edits made by hand are not lost, and refuse to
    // touch a file the user is in the middle of fixing.
    const text = await fs.readConfigFile(SETTINGS_FILE);
    try {
      parseSettings(text);
    } catch (err) {
      throw new Error(`${SETTINGS_FILE} contient une erreur, corrige-la d'abord.`, { cause: err });
    }
    const next = editSettings(text, key, value, language);
    this.settings.setUserSettings(parseSettings(next));
    await fs.writeConfigFile(SETTINGS_FILE, next);
  }

  /** Shows what can follow an unfinished key sequence, like which-key in Neovim. */
  private updateKeyHint(): void {
    const pending = this.keybindings.pendingChords;
    if (pending.length === 0) {
      this.keyHint.clear();
      return;
    }
    const titles = new Map(this.commands.list().map((c) => [c.id, c.title ?? c.id]));
    this.keyHint.show(
      formatKeySequence(pending),
      this.keybindings.continuations(this.contextKeys.get).map((c) => ({
        key: formatKeySequence([c.chord]),
        title: c.prefix ? '…' : (titles.get(c.command) ?? c.command),
        prefix: c.prefix,
      })),
    );
  }

  private async setZen(on: boolean): Promise<void> {
    if (this.layout.zen === on) return;
    this.layout.zen = on;
    this.contextKeys.set('zenMode', on);
    if (isTauri()) await getCurrentWindow().setFullscreen(on);
    this.workspace.editorView()?.focus();
  }

  /** Watches a file of the config folder (desktop app only). */
  private watchConfigFile(name: string, listener: () => void): Disposable {
    let watch: Disposable | null = null;
    let disposed = false;
    if (isTauri()) {
      void fs.configFilePath(name).then((path) => {
        if (!disposed) watch = watchFile(path, listener);
      });
    } else {
      watch = fs.onBrowserConfigWrite(name, listener);
    }
    return {
      dispose: () => {
        disposed = true;
        watch?.dispose();
      },
    };
  }

  private async loadUserScript(): Promise<void> {
    try {
      const source = await fs.readConfigFile('init.js');
      if (source === null) return;
      await this.extensions.activate(await loadUserScript(source));
    } catch (err) {
      console.error('[cascades] could not load init.js', err);
    }
  }

  /**
   * Runs the onWillQuit handlers when the window closes. Unsaved work is kept
   * by the session, so closing never asks for confirmation.
   */
  private runWillQuitOnClose(): void {
    const run = () =>
      Promise.race([
        Promise.allSettled([...this.willQuit].map((handler) => handler())),
        new Promise((resolve) => setTimeout(resolve, WILL_QUIT_TIMEOUT_MS)),
      ]);
    if (isTauri()) {
      void getCurrentWindow().onCloseRequested(async () => {
        await run();
      });
    } else {
      // Plain browser: handlers get to run their synchronous part.
      window.addEventListener('beforeunload', () => void run());
    }
  }

  private createContext(extensionId: string, subs: DisposableStore): ExtensionContext {
    const track = <T extends Disposable>(d: T): T => subs.add(d);
    const ws = this.workspace;
    return {
      extensionId,
      subscriptions: { add: (d) => void subs.add(d) },
      commands: {
        register: (id, handler, meta) => track(this.commands.register(id, handler, meta)),
        execute: (id, ...args) => this.commands.execute(id, ...args),
        list: () => this.commands.list(),
      },
      keybindings: {
        register: (bindings) => {
          const store = new DisposableStore();
          for (const b of Array.isArray(bindings) ? bindings : [bindings]) {
            store.add(this.keybindings.register(b));
          }
          return track(store);
        },
        setLeader: (key) => {
          this.keybindings.setLeader(key);
          this.keyHint.clear();
        },
        label: (command) => {
          const binding = this.keybindings.forCommand(command)[0];
          return binding ? formatKeySequence(binding.chords) : null;
        },
        list: () =>
          this.keybindings.list().map((b) => ({
            key: b.key,
            label: formatKeySequence(b.chords),
            command: b.command,
            when: b.when,
            source: b.source,
          })),
        capture: () => this.captureKey(),
        format: (key) => formatKeySequence(this.keybindings.actualChords(parseKeySequence(key))),
        onDidChange: (listener) => track(this.keybindings.onDidChange.on(listener)),
      },
      menus: {
        registerMenu: (menu) => track(this.menus.registerMenu(menu)),
        registerItem: (menuId, item) => track(this.menus.registerItem(menuId, item)),
      },
      settings: {
        register: (ns, props) => track(this.settings.registerSchema(ns, props)),
        get: (key, language) => this.settings.get(key, language),
        onDidChange: (listener) => track(this.settings.onDidChange.on(listener)),
        update: (key, value, language) => this.updateSetting(key, value, language),
        schemas: () => this.settings.allSchemas().map(([key, schema]) => ({ key, ...schema })),
        inspect: (key, language) => this.settings.inspect(key, language),
        overriddenLanguages: () => this.settings.overriddenLanguages(),
      },
      context: {
        get: (key) => this.contextKeys.get(key),
        set: (key, value) => this.contextKeys.set(key, value),
      },
      workspace: {
        tabs: () => ws.tabs,
        active: () => ws.active(),
        findByPath: (path) => ws.findByPath(path),
        open: (options, group) => ws.open(options, group),
        activate: (id) => ws.activate(id),
        close: (id) => ws.close(id),
        groups: () => ws.groupInfos(),
        activeGroup: () => ws.activeGroupId,
        focusGroup: (index) => ws.focusGroup(index),
        clone: (id, target) => ws.clone(id, target),
        moveToGroup: (id, target) => ws.moveToGroup(id, target),
        orientation: () => ws.orientation,
        setOrientation: (orientation) => ws.setOrientation(orientation),
        getText: (id) => ws.getText(id),
        update: (id, patch) => ws.update(id, patch),
        markSaved: (id) => ws.markSaved(id),
        viewState: (id) => ws.viewState(id),
        savedText: (id) => ws.savedText(id),
        setSavedText: (id, text) => ws.setSavedText(id, text),
        reload: (id, text) => ws.reload(id, text),
      },
      editor: {
        addExtension: (provider) => track(ws.addExtension(provider)),
        view: () => ws.editorView(),
        state: () => {
          const tab = ws.activeTab();
          return tab ? ws.stateOf(tab) : null;
        },
        highlightCode,
      },
      statusBar: { addItem: (options) => track(this.statusBar.addItem(options)) },
      banners: { show: (options) => track(this.banners.show(options)) },
      quickPick: { show: (items, options) => this.quickPick.show(items, options) },
      layout: {
        setVisible: (part, visible) => {
          this.layout[part] = visible;
        },
        isVisible: (part) => this.layout[part],
        setZen: (on) => this.setZen(on),
        isZen: () => this.layout.zen,
        setStyle: (name, value) => {
          if (value === null) document.documentElement.style.removeProperty(`--${name}`);
          else document.documentElement.style.setProperty(`--${name}`, value);
        },
      },
      themes: {
        register: (theme) => track(this.themes.register(theme)),
        list: () => this.themes.list(),
        current: () => this.themes.current(),
        apply: (id) => this.themes.apply(id),
        parse: parseTheme,
      },
      events: { on: (name, listener) => track(this.events.on(name, listener)) },
      fs: {
        readTextFile: fs.readTextFile,
        writeTextFile: fs.writeTextFile,
        watch: (path, listener) => track(watchFile(path, listener)),
        fileUrl,
        readBinary: fs.readBinary,
        fileSize: fs.fileSize,
        listDir: fs.listDir,
        listFiles: fs.listFiles,
        searchFiles: search.searchFiles,
        replaceInFiles: search.replaceInFiles,
        createFile: fs.createFile,
        createDir: fs.createDir,
        rename: fs.renamePath,
        trash: fs.trashPath,
        watchDir: (path, listener) => track(watchDir(path, listener)),
      },
      dialogs: {
        pickFilesToOpen: dialogs.pickFilesToOpen,
        pickFolder: dialogs.pickFolder,
        pickSavePath: dialogs.pickSavePath,
        choose: dialogs.choose,
        alert: dialogs.alert,
      },
      configFiles: {
        read: fs.readConfigFile,
        write: fs.writeConfigFile,
        list: fs.listConfigFolder,
        path: fs.configFilePath,
        watch: (name, listener) => track(this.watchConfigFile(name, listener)),
        check: (name, text) => this.checkConfigFile(name, text),
      },
      app: {
        onWillQuit: (handler) => {
          this.willQuit.add(handler);
          return track({ dispose: () => void this.willQuit.delete(handler) });
        },
        openExternal,
      },
      viewers: {
        register: (viewer) => track(this.viewers.register(viewer)),
        previewFor: (tab) => this.viewers.previewFor(tab),
        replaceFor: (path) => this.viewers.replaceFor(path),
        binaryViewer: () => this.viewers.binaryViewer(),
        get: (id) => this.viewers.get(id),
        previewMode: (tabId) => this.viewers.previewMode(tabId),
        setPreviewMode: (tabId, mode) => this.viewers.setPreviewMode(tabId, mode),
      },
      modals: { show: (modal) => track(this.modals.show(modal)) },
      panels: {
        register: (panel) => track(this.panels.register(panel)),
        show: (id) => this.panels.show(id),
        hide: (id) => this.panels.hide(id),
        toggle: (id) => this.panels.toggle(id),
        isVisible: (id) => this.panels.isVisible(id),
        toggleSide: (side) => this.panels.toggleSide(side),
      },
      contextMenu: {
        show: (position, items) => this.contextMenu.show(position, items),
      },
    };
  }
}
