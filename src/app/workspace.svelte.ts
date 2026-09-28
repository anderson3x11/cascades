import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  Text,
  Transaction,
  type ChangeSet,
  type Extension,
  type StateEffect,
  type TransactionSpec,
} from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import type {
  AppEvents,
  EditorExtensionHandle,
  EditorExtensionProvider,
  GroupInfo,
  GroupTarget,
  OpenOptions,
  TabInfo,
  TabPatch,
  ViewState,
} from '../api';
import type { EventBus } from '../core/events/emitter';
import { baseExtensions } from './editor-base';
import { findLanguage, languageId, loadLanguage } from './languages';
import { Doc, Group, Tab } from './tab.svelte';

/** Most groups side by side; beyond that panes get too narrow to write in. */
export const MAX_GROUPS = 4;

/** Marks the copy of an edit into the other tabs of the same document. */
const syncEdit = Annotation.define<boolean>();

/**
 * Groups of tabs (split panes), each with its own EditorView showing its
 * active tab. A document can be shown by tabs in several groups: every tab
 * keeps its own EditorState (cursor, scroll, undo history) and edits made in
 * one are copied into the others.
 */
export class Workspace {
  groups = $state<Group[]>([]);
  activeGroupId = $state('');
  orientation = $state<'row' | 'column'>('row');

  private providers: EditorExtensionProvider[] = [];
  private readonly contributions = new Compartment();
  private readonly language = new Compartment();
  private readonly languageSupport = new WeakMap<Doc, Extension>();
  private nextTab = 1;
  private nextDoc = 1;
  private nextGroup = 1;
  private nextUntitled = 1;

  constructor(private readonly events: EventBus<AppEvents>) {
    const group = this.newGroup();
    this.groups = [group];
    this.activeGroupId = group.id;
  }

  // Groups and views ----------------------------------------------------------

  /** Every tab of every group. */
  get tabs(): Tab[] {
    return this.groups.flatMap((g) => g.tabs);
  }

  activeGroupObject(): Group {
    return this.groups.find((g) => g.id === this.activeGroupId) ?? (this.groups[0] as Group);
  }

  /** Active tab of the active group. */
  get activeId(): string | null {
    return this.activeGroupObject().activeId;
  }

  activeTab(): Tab | null {
    return this.activeGroupObject().activeTab();
  }

  /** Creates the editor view of a group inside `parent`. */
  attach(groupId: string, parent: HTMLElement): { view: EditorView; dispose(): void } {
    const group = this.getGroup(groupId);
    const shown = group.activeTab();
    const view = new EditorView({ parent, state: shown?.state ?? this.emptyState() });
    group.view = view;
    // A group created by a split gets its view after its tab: apply that tab's scroll now.
    if (shown?.scroll) view.dispatch({ effects: shown.scroll });
    // Working in an editor makes its group the active one.
    const onFocus = () => this.setActiveGroup(group.id);
    view.dom.addEventListener('focusin', onFocus);
    return {
      view,
      dispose: () => {
        view.dom.removeEventListener('focusin', onFocus);
        const tab = group.activeTab();
        if (tab && group.view === view) tab.state = view.state;
        if (group.view === view) group.view = null;
        view.destroy();
      },
    };
  }

  /** View of the active group. */
  editorView(): EditorView | null {
    return this.activeGroupObject().view;
  }

  /** Current state of a tab, taken from its group's view when the tab is shown. */
  stateOf(tab: Tab): EditorState {
    return this.isShown(tab) && tab.group.view ? tab.group.view.state : tab.state;
  }

  groupInfos(): GroupInfo[] {
    return this.groups.map((g) => ({ id: g.id, tabs: g.tabs, active: g.activeTab() }));
  }

  focusGroup(index: number): void {
    const group = this.groups[index];
    if (!group) return;
    this.setActiveGroup(group.id);
    group.view?.focus();
  }

  setOrientation(orientation: 'row' | 'column'): void {
    this.orientation = orientation;
  }

  // Tabs ----------------------------------------------------------------------

  active(): TabInfo | null {
    return this.activeTab();
  }

  findByPath(path: string): TabInfo | null {
    return (
      this.activeGroupObject().tabs.find((t) => t.path === path) ??
      this.tabs.find((t) => t.path === path) ??
      null
    );
  }

  open(options: OpenOptions, target?: GroupTarget): TabInfo {
    const active = this.activeGroupObject();
    const group = (target ? this.resolveTarget(active, target) : null) ?? active;
    const untitled = options.path ? '' : `Sans titre ${this.nextUntitled++}`;
    const doc = new Doc(`doc-${this.nextDoc++}`, Text.empty, untitled);
    doc.path = options.path;
    doc.encoding = options.encoding ?? 'utf-8';
    doc.bom = options.bom ?? false;
    doc.lineEnding = options.lineEnding ?? 'lf';
    doc.language = languageId(findLanguage(options.path));
    doc.viewer = options.viewer ?? null;

    const tab = new Tab(`tab-${this.nextTab++}`, doc, group, EditorState.create());
    // A viewer document has no text: its editor is empty and hidden.
    tab.state = this.createState(doc.viewer ? '' : options.text, tab);
    doc.savedDoc =
      options.savedText === undefined ? tab.state.doc : Text.of(options.savedText.split('\n'));
    doc.dirty = !tab.state.doc.eq(doc.savedDoc);
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

    this.insertTab(group, tab);
    this.events.emit('workspace.didOpen', tab);
    this.activate(tab.id);
    void this.loadLanguage(doc);
    return tab;
  }

  activate(id: string): void {
    const tab = this.get(id);
    const changed = tab.group.activeId !== id || this.activeGroupId !== tab.group.id;
    this.show(tab);
    this.activeGroupId = tab.group.id;
    if (changed) this.events.emit('workspace.didChangeActive', tab);
  }

  close(id: string): void {
    const tab = this.get(id);
    const wasActive = this.activeTab() === tab;
    this.detachTab(tab);
    this.events.emit('workspace.didClose', tab);
    if (wasActive) this.events.emit('workspace.didChangeActive', this.activeTab());
  }

  /** Moves a tab to a new position in its group's tab bar. */
  move(id: string, toIndex: number): void {
    const tab = this.get(id);
    const tabs = tab.group.tabs;
    tabs.splice(tabs.indexOf(tab), 1);
    tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, tab);
  }

  clone(id: string, target: GroupTarget = 'next'): TabInfo | null {
    const tab = this.get(id);
    const group = this.resolveTarget(tab.group, target);
    if (!group || group === tab.group) return null;
    const existing = group.tabs.find((t) => t.doc === tab.doc);
    if (existing) {
      this.activate(existing.id);
      return existing;
    }
    const source = this.stateOf(tab);
    const copy = new Tab(`tab-${this.nextTab++}`, tab.doc, group, EditorState.create());
    copy.state = this.createState(source.doc.toString(), copy).update({
      selection: source.selection,
    }).state;
    const view = this.isShown(tab) ? tab.group.view : null;
    copy.topPos = view ? this.topPosition(view) : tab.topPos;
    copy.scroll = EditorView.scrollIntoView(copy.topPos, { y: 'start' });
    this.insertTab(group, copy);
    this.events.emit('workspace.didOpen', copy);
    this.activate(copy.id);
    return copy;
  }

  moveToGroup(id: string, target: GroupTarget = 'next'): void {
    const tab = this.get(id);
    const from = tab.group;
    const to = this.resolveTarget(from, target);
    if (!to || to === from) return;
    // The document is already shown there: that view takes over.
    const existing = to.tabs.find((t) => t.doc === tab.doc);
    if (existing) {
      this.close(tab.id);
      this.activate(existing.id);
      return;
    }
    this.detachTab(tab);
    tab.group = to;
    this.insertTab(to, tab);
    this.activate(tab.id);
  }

  getText(id: string): string {
    return this.stateOf(this.get(id)).doc.toString();
  }

  update(id: string, patch: TabPatch): void {
    const { doc } = this.get(id);
    const pathChanged = patch.path !== undefined && patch.path !== doc.path;
    if (patch.path !== undefined) doc.path = patch.path;
    if (patch.encoding !== undefined) doc.encoding = patch.encoding;
    if (patch.bom !== undefined) doc.bom = patch.bom;
    if (patch.lineEnding !== undefined) doc.lineEnding = patch.lineEnding;
    this.docChanged(doc);
    if (pathChanged) void this.loadLanguage(doc);
  }

  markSaved(id: string): void {
    const tab = this.get(id);
    tab.doc.savedDoc = this.stateOf(tab).doc;
    tab.doc.dirty = false;
    this.docChanged(tab.doc);
    this.events.emit('workspace.didSave', tab);
  }

  savedText(id: string): string {
    return this.get(id).doc.savedDoc.toString();
  }

  setSavedText(id: string, text: string): void {
    const tab = this.get(id);
    tab.doc.savedDoc = Text.of(text.split('\n'));
    tab.doc.dirty = !this.stateOf(tab).doc.eq(tab.doc.savedDoc);
    this.docChanged(tab.doc);
  }

  reload(id: string, text: string): void {
    const tab = this.get(id);
    const old = this.stateOf(tab).doc.toString();
    // Replace only the part that differs, so the cursor stays put when possible.
    let start = 0;
    while (start < old.length && start < text.length && old[start] === text[start]) start++;
    let endOld = old.length;
    let endNew = text.length;
    while (endOld > start && endNew > start && old[endOld - 1] === text[endNew - 1]) {
      endOld--;
      endNew--;
    }
    this.dispatchTo(tab, {
      changes: { from: start, to: endOld, insert: text.slice(start, endNew) },
      userEvent: 'reload',
    });
    this.setSavedText(id, text);
  }

  viewState(id: string): ViewState {
    const tab = this.get(id);
    const view = this.isShown(tab) ? tab.group.view : null;
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
      this.dispatchTo(tab, {
        effects: this.contributions.reconfigure(this.contributionsFor(tab)),
      });
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

  private getGroup(id: string): Group {
    const group = this.groups.find((g) => g.id === id);
    if (!group) throw new Error(`Unknown group: ${id}`);
    return group;
  }

  private newGroup(): Group {
    return new Group(`group-${this.nextGroup++}`);
  }

  private isShown(tab: Tab): boolean {
    return tab.group.activeId === tab.id;
  }

  private setActiveGroup(id: string): void {
    if (this.activeGroupId === id) return;
    this.activeGroupId = id;
    this.events.emit('workspace.didChangeActive', this.activeTab());
  }

  /** The group a target names, creating the next or previous one if there is room. */
  private resolveTarget(from: Group, target: GroupTarget): Group | null {
    if (target === 'new') {
      if (this.groups.length >= MAX_GROUPS) return null;
      const group = this.newGroup();
      this.groups.push(group);
      return group;
    }
    if (target !== 'next' && target !== 'previous') {
      return this.groups.find((g) => g.id === target) ?? null;
    }
    const index = this.groups.indexOf(from) + (target === 'next' ? 1 : -1);
    const existing = this.groups[index];
    if (existing) return existing;
    if (this.groups.length >= MAX_GROUPS) return null;
    const group = this.newGroup();
    if (target === 'next') this.groups.push(group);
    else this.groups.unshift(group);
    return group;
  }

  /** Inserts a tab after its group's active tab. */
  private insertTab(group: Group, tab: Tab): void {
    const index = group.tabs.findIndex((t) => t.id === group.activeId);
    group.tabs.splice(index + 1, 0, tab);
  }

  /** Shows a tab in its group's view, keeping the previous tab's state and scroll. */
  private show(tab: Tab): void {
    const group = tab.group;
    if (group.activeId === tab.id) return;
    const previous = group.activeTab();
    if (previous && group.view) {
      previous.state = group.view.state;
      previous.scroll = group.view.scrollSnapshot();
      previous.topPos = this.topPosition(group.view);
    }
    group.activeId = tab.id;
    if (group.view) {
      group.view.setState(tab.state);
      if (tab.scroll) group.view.dispatch({ effects: tab.scroll });
    }
  }

  /**
   * Takes a tab out of its group, showing a neighbor instead. An emptied
   * group is removed, unless it is the last one.
   */
  private detachTab(tab: Tab): void {
    const group = tab.group;
    const index = group.tabs.indexOf(tab);
    if (group.activeId === tab.id) {
      if (group.view) tab.state = group.view.state;
      const neighbor = group.tabs[index + 1] ?? group.tabs[index - 1];
      if (neighbor) {
        this.show(neighbor);
      } else {
        group.activeId = null;
        group.view?.setState(this.emptyState());
      }
    }
    group.tabs.splice(group.tabs.indexOf(tab), 1);
    if (group.tabs.length === 0 && this.groups.length > 1) {
      const at = this.groups.indexOf(group);
      this.groups.splice(at, 1);
      if (this.activeGroupId === group.id) {
        this.activeGroupId = (this.groups[Math.max(0, at - 1)] as Group).id;
      }
    }
  }

  private createState(text: string, tab: Tab): EditorState {
    return EditorState.create({
      doc: text,
      extensions: [
        baseExtensions(),
        this.language.of(this.languageSupport.get(tab.doc) ?? []),
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

  /** Applies a transaction to a tab, in its view when shown, and copies edits to its clones. */
  private dispatchTo(tab: Tab, spec: TransactionSpec): void {
    if (this.isShown(tab) && tab.group.view) {
      // The view's update listener copies the edit (see onUpdate).
      tab.group.view.dispatch(spec);
      return;
    }
    const tr = tab.state.update(spec);
    tab.state = tr.state;
    if (tr.docChanged && !tr.annotation(syncEdit)) this.propagate(tab, tr.changes);
  }

  /** Copies an edit into the other tabs of the same document (outside their undo history). */
  private propagate(source: Tab, changes: ChangeSet): void {
    for (const tab of this.tabs) {
      if (tab === source || tab.doc !== source.doc) continue;
      this.dispatchTo(tab, {
        changes,
        annotations: [syncEdit.of(true), Transaction.addToHistory.of(false)],
      });
    }
  }

  /** Tells listeners that a document's file side changed, once per tab showing it. */
  private docChanged(doc: Doc): void {
    for (const tab of this.tabs)
      if (tab.doc === doc) this.events.emit('workspace.didChangeTab', tab);
  }

  private onUpdate(tab: Tab, update: ViewUpdate): void {
    if (update.docChanged) {
      for (const tr of update.transactions) {
        if (tr.docChanged && !tr.annotation(syncEdit)) this.propagate(tab, tr.changes);
      }
      const dirty = !update.state.doc.eq(tab.doc.savedDoc);
      if (dirty !== tab.doc.dirty) {
        tab.doc.dirty = dirty;
        this.docChanged(tab.doc);
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

  private async loadLanguage(doc: Doc): Promise<void> {
    const description = findLanguage(doc.path);
    const id = languageId(description);
    const changed = id !== doc.language;
    doc.language = id;
    let support: Extension = [];
    try {
      support = (await loadLanguage(description)) ?? [];
    } catch (err) {
      console.error(`[cascades] failed to load language ${id}`, err);
    }
    // The document may have been closed or renamed while loading.
    if (doc.language !== id) return;
    this.languageSupport.set(doc, support);
    for (const tab of this.tabs) {
      if (tab.doc !== doc) continue;
      this.dispatchTo(tab, {
        effects: [
          this.language.reconfigure(support),
          this.contributions.reconfigure(this.contributionsFor(tab)),
        ] as StateEffect<unknown>[],
      });
    }
    if (changed) this.docChanged(doc);
  }
}
