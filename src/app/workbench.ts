import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppEvents, CascadesExtension, ExtensionContext } from '../api';
import { CommandRegistry } from '../core/commands/registry';
import { ContextKeys } from '../core/context/context-keys';
import { DisposableStore, type Disposable } from '../core/disposable';
import { EventBus } from '../core/events/emitter';
import { ExtensionHost } from '../core/extensions/host';
import { chordFromEvent } from '../core/keybindings/keys';
import { KeybindingRegistry } from '../core/keybindings/registry';
import { MenuRegistry } from '../core/menus/registry';
import { SettingsRegistry } from '../core/settings/registry';
import * as dialogs from '../platform/dialogs';
import * as fs from '../platform/fs';
import { watchFile } from '../platform/watch';
import { BannerModel } from './banners.svelte';
import { loadUserScript } from './user-script';
import { StatusBarModel } from './status-bar.svelte';
import { Workspace } from './workspace.svelte';

/** How long closing the window waits for onWillQuit handlers. */
const WILL_QUIT_TIMEOUT_MS = 3000;

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
    if (isTauri()) await this.loadUserSettings();

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
    if (result.kind === 'match') {
      const { command, args } = result.binding;
      this.commands.execute(command, ...args).catch((err: unknown) => console.error(err));
    }
  };

  private async loadUserSettings(): Promise<void> {
    try {
      const source = await fs.readConfigFile('settings.json');
      if (source === null) return;
      const parsed: unknown = JSON.parse(source);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('settings.json must contain an object');
      }
      this.settings.setUserSettings(parsed as Record<string, unknown>);
    } catch (err) {
      console.error('[cascades] could not load settings.json', err);
    }
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
      },
      menus: {
        registerMenu: (menu) => track(this.menus.registerMenu(menu)),
        registerItem: (menuId, item) => track(this.menus.registerItem(menuId, item)),
      },
      settings: {
        register: (ns, props) => track(this.settings.registerSchema(ns, props)),
        get: (key, language) => this.settings.get(key, language),
        onDidChange: (listener) => track(this.settings.onDidChange.on(listener)),
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
      },
      statusBar: { addItem: (options) => track(this.statusBar.addItem(options)) },
      banners: { show: (options) => track(this.banners.show(options)) },
      events: { on: (name, listener) => track(this.events.on(name, listener)) },
      fs: {
        readTextFile: fs.readTextFile,
        writeTextFile: fs.writeTextFile,
        watch: (path, listener) => track(watchFile(path, listener)),
      },
      dialogs: {
        pickFilesToOpen: dialogs.pickFilesToOpen,
        pickSavePath: dialogs.pickSavePath,
        choose: dialogs.choose,
        alert: dialogs.alert,
      },
      configFiles: { read: fs.readConfigFile, write: fs.writeConfigFile },
      app: {
        onWillQuit: (handler) => {
          this.willQuit.add(handler);
          return track({ dispose: () => void this.willQuit.delete(handler) });
        },
      },
    };
  }
}
