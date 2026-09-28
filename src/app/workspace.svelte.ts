import {
  Compartment,
  EditorSelection,
  EditorState,
  Text,
  type Extension,
  type StateEffect,
} from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import type {
  AppEvents,
  EditorExtensionHandle,
  EditorExtensionProvider,
  OpenOptions,
  TabInfo,
  TabPatch,
  ViewState,
} from '../api';
import type { EventBus } from '../core/events/emitter';
import { baseExtensions } from './editor-base';
import { findLanguage, languageId, loadLanguage } from './languages';
import { Tab } from './tab.svelte';

/**
 * Open tabs and the single EditorView that shows the active one. Each tab
 * keeps its own EditorState (undo history, selection); switching tabs swaps
 * the state in the view.
 */
export class Workspace {
  tabs = $state<Tab[]>([]);
  activeId = $state<string | null>(null);

  private view: EditorView | null = null;
  private providers: EditorExtensionProvider[] = [];
  private readonly contributions = new Compartment();
  private readonly language = new Compartment();
  private nextId = 1;
  private nextUntitled = 1;

  constructor(private readonly events: EventBus<AppEvents>) {}

  /** Creates the editor view inside `parent`. */
  attach(parent: HTMLElement): EditorView {
    const active = this.activeTab();
    this.view = new EditorView({ parent, state: active?.state ?? this.emptyState() });
    return this.view;
  }

  detach(): void {
    const active = this.activeTab();
    if (active && this.view) active.state = this.view.state;
    this.view?.destroy();
    this.view = null;
  }

  editorView(): EditorView | null {
    return this.view;
  }

  activeTab(): Tab | null {
    return this.tabs.find((t) => t.id === this.activeId) ?? null;
  }

  /** Current state of a tab, taken from the view when the tab is shown. */
  stateOf(tab: Tab): EditorState {
    return tab.id === this.activeId && this.view ? this.view.state : tab.state;
  }

  // Operations exposed through WorkspaceApi --------------------------------------------------------------

  active(): TabInfo | null {
    return this.activeTab();
  }

  findByPath(path: string): TabInfo | null {
    return this.tabs.find((t) => t.path === path) ?? null;
  }

  open(options: OpenOptions): TabInfo {
    const untitled = options.path ? '' : `Sans titre ${this.nextUntitled++}`;
    const tab = new Tab(`tab-${this.nextId++}`, EditorState.create(), untitled);
    tab.path = options.path;
    tab.encoding = options.encoding ?? 'utf-8';
    tab.bom = options.bom ?? false;
    tab.lineEnding = options.lineEnding ?? 'lf';
    tab.language = languageId(findLanguage(options.path));
    tab.state = this.createState(options.text, tab);
    tab.savedDoc =
      options.savedText === undefined ? tab.state.doc : Text.of(options.savedText.split('\n'));
    tab.dirty = !tab.state.doc.eq(tab.savedDoc);
    const length = tab.state.doc.length;
    const clamp = (pos: number) => Math.max(0, Math.min(pos, length));
    if (options.selection) {
      const { anchor, head } = options.selection;
      tab.state = tab.state.update({
        selection: EditorSelection.single(clamp(anchor), clamp(head)),
      }).state;
    }
    if (options.scrollTop !== undefined) {
      tab.topPos = clamp(options.scrollTop);
      tab.scroll = EditorView.scrollIntoView(tab.topPos, { y: 'start' });
    }

    const index = this.tabs.findIndex((t) => t.id === this.activeId);
    this.tabs.splice(index + 1, 0, tab);
    this.events.emit('workspace.didOpen', tab);
    this.activate(tab.id);
    void this.loadLanguage(tab);
    return tab;
  }

  activate(id: string): void {
    if (id === this.activeId) return;
    const next = this.get(id);
    const prev = this.activeTab();
    if (prev && this.view) {
      prev.state = this.view.state;
      prev.scroll = this.view.scrollSnapshot();
      prev.topPos = this.topPosition(this.view);
    }
    this.activeId = id;
    if (this.view) {
      this.view.setState(next.state);
      if (next.scroll) this.view.dispatch({ effects: next.scroll });
    }
    this.events.emit('workspace.didChangeActive', next);
  }

  close(id: string): void {
    const tab = this.get(id);
    const index = this.tabs.indexOf(tab);
    if (id === this.activeId) {
      const neighbor = this.tabs[index + 1] ?? this.tabs[index - 1];
      if (neighbor) {
        this.activate(neighbor.id);
      } else {
        tab.state = this.view?.state ?? tab.state;
        this.activeId = null;
        this.view?.setState(this.emptyState());
        this.events.emit('workspace.didChangeActive', null);
      }
    }
    this.tabs.splice(this.tabs.indexOf(tab), 1);
    this.events.emit('workspace.didClose', tab);
  }

  /** Moves a tab to a new position in the tab bar. */
  move(id: string, toIndex: number): void {
    const tab = this.get(id);
    this.tabs.splice(this.tabs.indexOf(tab), 1);
    this.tabs.splice(Math.max(0, Math.min(toIndex, this.tabs.length)), 0, tab);
  }

  getText(id: string): string {
    return this.stateOf(this.get(id)).doc.toString();
  }

  update(id: string, patch: TabPatch): void {
    const tab = this.get(id);
    const pathChanged = patch.path !== undefined && patch.path !== tab.path;
    if (patch.path !== undefined) tab.path = patch.path;
    if (patch.encoding !== undefined) tab.encoding = patch.encoding;
    if (patch.bom !== undefined) tab.bom = patch.bom;
    if (patch.lineEnding !== undefined) tab.lineEnding = patch.lineEnding;
    this.events.emit('workspace.didChangeTab', tab);
    if (pathChanged) void this.loadLanguage(tab);
  }

  markSaved(id: string): void {
    const tab = this.get(id);
    tab.savedDoc = this.stateOf(tab).doc;
    tab.dirty = false;
    this.events.emit('workspace.didChangeTab', tab);
    this.events.emit('workspace.didSave', tab);
  }

  viewState(id: string): ViewState {
    const tab = this.get(id);
    const view = tab.id === this.activeId ? this.view : null;
    const { anchor, head } = (view ? view.state : tab.state).selection.main;
    return {
      selection: { anchor, head },
      scrollTop: view ? this.topPosition(view) : tab.topPos,
    };
  }

  // Editor extensions ---------------------------------------------------------

  addExtension(provider: EditorExtensionProvider): EditorExtensionHandle {
    this.providers.push(provider);
    this.refreshContributions();
    return {
      refresh: () => this.refreshContributions(),
      dispose: () => {
        this.providers = this.providers.filter((p) => p !== provider);
        this.refreshContributions();
      },
    };
  }

  private refreshContributions(): void {
    for (const tab of this.tabs) {
      this.reconfigure(tab, this.contributions.reconfigure(this.contributionsFor(tab)));
    }
  }

  private contributionsFor(tab: Tab): Extension[] {
    const result: Extension[] = [];
    for (const provider of this.providers) {
      try {
        result.push(provider(tab));
      } catch (err) {
        console.error('[cascades] editor extension provider failed', err);
      }
    }
    return result;
  }

  // Internals -----------------------------------------------------------------

  private get(id: string): Tab {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) throw new Error(`Unknown tab: ${id}`);
    return tab;
  }

  private createState(doc: string, tab: Tab): EditorState {
    return EditorState.create({
      doc,
      extensions: [
        baseExtensions(),
        this.language.of([]),
        this.contributions.of(this.contributionsFor(tab)),
        EditorView.updateListener.of((update) => this.onUpdate(tab, update)),
      ],
    });
  }

  /** Start of the first line visible at the top of the view. */
  private topPosition(view: EditorView): number {
    const height = view.scrollDOM.scrollTop - view.documentPadding.top;
    return view.lineBlockAtHeight(Math.max(0, height)).from;
  }

  private emptyState(): EditorState {
    return EditorState.create({ extensions: [EditorView.editable.of(false)] });
  }

  private reconfigure(tab: Tab, effects: StateEffect<unknown> | StateEffect<unknown>[]): void {
    if (tab.id === this.activeId && this.view) {
      this.view.dispatch({ effects });
    } else {
      tab.state = tab.state.update({ effects }).state;
    }
  }

  private onUpdate(tab: Tab, update: ViewUpdate): void {
    if (update.docChanged) {
      const dirty = !update.state.doc.eq(tab.savedDoc);
      if (dirty !== tab.dirty) {
        tab.dirty = dirty;
        this.events.emit('workspace.didChangeTab', tab);
      }
    }
    if (update.docChanged || update.selectionSet) {
      this.events.emit('editor.didUpdate', {
        tab,
        docChanged: update.docChanged,
        selectionChanged: update.selectionSet,
      });
    }
  }

  private async loadLanguage(tab: Tab): Promise<void> {
    const description = findLanguage(tab.path);
    const id = languageId(description);
    const changed = id !== tab.language;
    tab.language = id;
    let support: Extension = [];
    try {
      support = (await loadLanguage(description)) ?? [];
    } catch (err) {
      console.error(`[cascades] failed to load language ${id}`, err);
    }
    // The tab may have been closed or renamed while loading.
    if (!this.tabs.includes(tab) || tab.language !== id) return;
    this.reconfigure(tab, [
      this.language.reconfigure(support),
      this.contributions.reconfigure(this.contributionsFor(tab)),
    ]);
    if (changed) this.events.emit('workspace.didChangeTab', tab);
  }
}
