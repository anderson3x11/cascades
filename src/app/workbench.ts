import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppEvents, CascadesExtension, ExtensionContext } from '../api';
import { CommandRegistry } from '../core/commands/registry';
import { ContextKeys } from '../core/context/context-keys';
import { DisposableStore, type Disposable } from '../core/disposable';
import { EventBus } from '../core/events/emitter';
import { ExtensionHost } from '../core/extensions/host';
import { chordFromEvent, formatKeySequence } from '../core/keybindings/keys';
import { KeybindingRegistry } from '../core/keybindings/registry';
import { MenuRegistry } from '../core/menus/registry';
import { withSetting } from '../core/settings/edit';
import { SettingsRegistry, type RawSettings } from '../core/settings/registry';
import { parseTheme } from '../core/themes/theme';
import * as dialogs from '../platform/dialogs';
import * as fs from '../platform/fs';
import { watchFile } from '../platform/watch';
import { BannerModel } from './banners.svelte';
import { loadUserScript } from './user-script';
import { StatusBarModel } from './status-bar.svelte';
import { highlightCode } from './highlight-code';
import { KeyHintModel } from './key-hint.svelte';
import { LayoutModel } from './layout.svelte';
import { QuickPickModel } from './quick-pick.svelte';
import { ThemeService } from './themes';
import { ViewerService } from './viewers.svelte';
import { fileUrl, openExternal } from '../platform/assets';
import { Workspace } from './workspace.svelte';

/** How long closing the window waits for onWillQuit handlers. */
const WILL_QUIT_TIMEOUT_MS = 3000;
const SETTINGS_FILE = 'settings.json';

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
  readonly extensions = new ExtensionHost<ExtensionContext>((id, subs) =>
    this.createContext(id, subs),
  );
  private readonly willQuit = new Set<() => void | Promise<void>>();

  async start(builtins: CascadesExtension[]): Promise<void> {
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
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

    this.runWillQuitOnClose();
    if (isTauri()) {
      void getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === 'drop')
          this.events.emit('app.didDropFiles', event.payload.paths);
      });
      await this.loadUserScript();
    }
  }

  /** Mounts the editor view and tracks its focus for `when` clauses. */
  attachEditor(parent: HTMLElement): Disposable {
    const view = this.workspace.attach(parent);
    const onFocus = () => this.contextKeys.set('editorFocus', view.hasFocus);
    view.dom.addEventListener('focusin', onFocus);
    view.dom.addEventListener('focusout', onFocus);
    view.focus();
    return {
      dispose: () => {
        view.dom.removeEventListener('focusin', onFocus);
        view.dom.removeEventListener('focusout', onFocus);
        this.workspace.detach();
      },
    };
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing) return;
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

  /** Parsed settings.json, {} when absent. Throws when the file is not a JSON object. */
  private async readUserSettings(): Promise<RawSettings> {
    const source = await fs.readConfigFile(SETTINGS_FILE);
    if (source === null || source.trim() === '') return {};
    const parsed: unknown = JSON.parse(source);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${SETTINGS_FILE} doit contenir un objet JSON`);
    }
    return parsed as RawSettings;
  }

  private async loadUserSettings(): Promise<void> {
    try {
      this.settings.setUserSettings(await this.readUserSettings());
    } catch (err) {
      console.error(`[cascades] could not load ${SETTINGS_FILE}`, err);
    }
  }

  /** Writes one user setting to settings.json, keeping everything else in the file. */
  private async updateSetting(key: string, value: unknown, language?: string): Promise<void> {
    // Re-read the file so that edits made by hand are not lost, and refuse to
    // overwrite a file the user is in the middle of fixing.
    let raw: RawSettings;
    try {
      raw = await this.readUserSettings();
    } catch (err) {
      throw new Error(`${SETTINGS_FILE} contient une erreur, corrige-la d'abord.`, { cause: err });
    }
    const next = withSetting(raw, key, value, language);
    this.settings.setUserSettings(next);
    await fs.writeConfigFile(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`);
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
      },
      context: {
        get: (key) => this.contextKeys.get(key),
        set: (key, value) => this.contextKeys.set(key, value),
      },
      workspace: {
        tabs: () => ws.tabs,
        active: () => ws.active(),
        findByPath: (path) => ws.findByPath(path),
        open: (options) => ws.open(options),
        activate: (id) => ws.activate(id),
        close: (id) => ws.close(id),
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
      },
      dialogs: {
        pickFilesToOpen: dialogs.pickFilesToOpen,
        pickSavePath: dialogs.pickSavePath,
        choose: dialogs.choose,
        alert: dialogs.alert,
      },
      configFiles: {
        read: fs.readConfigFile,
        write: fs.writeConfigFile,
        list: fs.listConfigFolder,
        watch: (name, listener) => track(this.watchConfigFile(name, listener)),
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
        previewMode: (tabId) => this.viewers.previewMode(tabId),
        setPreviewMode: (tabId, mode) => this.viewers.setPreviewMode(tabId, mode),
      },
    };
  }
}
