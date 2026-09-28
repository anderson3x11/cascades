import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppEvents, CascadesExtension, ExtensionContext } from '../api';
import { CommandRegistry } from '../core/commands/registry';
import { ContextKeys } from '../core/context/context-keys';
import { DisposableStore, type Disposable } from '../core/disposable';
import { EventBus } from '../core/events/emitter';
import { ExtensionHost } from '../core/extensions/host';
import { chordFromEvent } from '../core/keybindings/keys';
import { KeybindingRegistry } from '../core/keybindings/registry';
import { SettingsRegistry } from '../core/settings/registry';
import * as dialogs from '../platform/dialogs';
import * as fs from '../platform/fs';
import { loadUserScript } from './user-script';
import { StatusBarModel } from './status-bar.svelte';
import { Workspace } from './workspace.svelte';

export class Workbench {
  readonly commands = new CommandRegistry();
  readonly keybindings = new KeybindingRegistry();
  readonly settings = new SettingsRegistry();
  readonly contextKeys = new ContextKeys();
  readonly events = new EventBus<AppEvents>();
  readonly workspace = new Workspace(this.events);
  readonly statusBar = new StatusBarModel();
  readonly extensions = new ExtensionHost<ExtensionContext>((id, subs) =>
    this.createContext(id, subs),
  );

  async start(builtins: CascadesExtension[]): Promise<void> {
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    this.events.on('workspace.didChangeActive', (tab) =>
      this.contextKeys.set('editorLangId', tab?.language),
    );
    this.events.on('workspace.didChangeTab', (tab) => {
      if (tab.id === this.workspace.activeId) this.contextKeys.set('editorLangId', tab.language);
    });

    for (const extension of builtins) {
      try {
        await this.extensions.activate(extension);
      } catch (err) {
        console.error(err);
      }
    }

    if (isTauri()) {
      await this.loadUserSettings();
      await this.loadUserScript();
      this.guardUnsavedOnClose();
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

  private guardUnsavedOnClose(): void {
    void getCurrentWindow().onCloseRequested(async (event) => {
      const dirty = this.workspace.tabs.filter((t) => t.dirty);
      if (dirty.length === 0) return;
      const choice = await dialogs.choose(
        `${dirty.length} fichier(s) non enregistré(s). Quitter quand même ?`,
        { buttons: ['Quitter', 'Annuler'] },
      );
      if (choice !== 'Quitter') event.preventDefault();
    });
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
      events: { on: (name, listener) => track(this.events.on(name, listener)) },
      fs: { readTextFile: fs.readTextFile, writeTextFile: fs.writeTextFile },
      dialogs: {
        pickFilesToOpen: dialogs.pickFilesToOpen,
        pickSavePath: dialogs.pickSavePath,
        choose: dialogs.choose,
        alert: dialogs.alert,
      },
    };
  }
}
