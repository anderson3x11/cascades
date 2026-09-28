import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Disposable, ExtensionContext } from '../../api';
import {
  baseName,
  isExcluded,
  isWithin,
  join,
  moved,
  nameProblem,
  parentOf,
  samePath,
  sortEntries,
} from './paths';

export interface Node {
  path: string;
  name: string;
  isDir: boolean;
}

/** A row of the tree as displayed: a node at a depth. */
export interface Row extends Node {
  depth: number;
  expanded: boolean;
}

/** A name being typed: a new file or folder in `dir`, or a new name for `path`. */
export type Editing =
  { kind: 'file' | 'folder'; dir: string } | { kind: 'rename'; path: string; isDir: boolean };

const RELOAD_DELAY_MS = 100;

/** The opened folders and what is shown of them. */
export class ExplorerModel {
  /** Folders shown as the top rows of the tree, in the order they were added. */
  roots = $state<string[]>([]);
  /** Listings of the folders loaded, sorted, without excluded names. */
  readonly children = new SvelteMap<string, Node[]>();
  readonly expanded = new SvelteSet<string>();
  selected = $state<string | null>(null);
  editing = $state<Editing | null>(null);
  /** A problem to show at the top of the panel (folder gone, failed rename…). */
  error = $state<string | null>(null);
  /** Path of the active tab, highlighted in the tree. */
  activePath = $state<string | null>(null);

  private watches = new SvelteMap<string, Disposable>();
  private timers = new SvelteMap<string, ReturnType<typeof setTimeout>>();

  constructor(
    private ctx: ExtensionContext,
    /** Called when the folders or the expanded folders change, to remember them. */
    private onStateChange: () => void,
  ) {}

  isRoot(path: string): boolean {
    return this.roots.some((root) => samePath(root) === samePath(path));
  }

  /** Visible rows, depth first; each folder added is a row of depth 0. */
  rows(): Row[] {
    const out: Row[] = [];
    const walk = (dir: string, depth: number) => {
      for (const node of this.children.get(dir) ?? []) {
        const expanded = node.isDir && this.expanded.has(node.path);
        out.push({ ...node, depth, expanded });
        if (expanded) walk(node.path, depth + 1);
      }
    };
    for (const root of this.roots) {
      const expanded = this.expanded.has(root);
      out.push({ path: root, name: baseName(root), isDir: true, depth: 0, expanded });
      if (expanded) walk(root, 1);
    }
    return out;
  }

  /** Adds a folder (unfolded), or selects it if it is already there. */
  async add(root: string, expanded: string[] = [root]): Promise<void> {
    if (!this.isRoot(root)) {
      this.roots = [...this.roots, root];
      // Parents before children, so that each folder is loaded once.
      for (const dir of [...expanded].sort((a, b) => a.length - b.length)) {
        if (isWithin(dir, root)) await this.expand(dir, false);
      }
      this.onStateChange();
    }
    this.selected = root;
  }

  /** Takes a folder off the list (nothing is deleted). */
  remove(root: string): void {
    this.roots = this.roots.filter((r) => samePath(r) !== samePath(root));
    for (const dir of [...this.children.keys()]) {
      if (!isWithin(dir, root)) continue;
      this.children.delete(dir);
      this.stopWatching(dir);
    }
    for (const dir of [...this.expanded]) if (isWithin(dir, root)) this.expanded.delete(dir);
    if (this.selected && isWithin(this.selected, root)) this.selected = null;
    this.error = null;
    this.onStateChange();
  }

  removeAll(): void {
    for (const root of [...this.roots]) this.remove(root);
  }

  async toggle(dir: string): Promise<void> {
    if (this.expanded.has(dir)) this.collapse(dir);
    else await this.expand(dir);
  }

  async expand(dir: string, remember = true): Promise<void> {
    this.expanded.add(dir);
    await this.load(dir);
    this.watch(dir);
    if (remember) this.onStateChange();
  }

  collapse(dir: string): void {
    this.expanded.delete(dir);
    this.stopWatching(dir);
    this.onStateChange();
  }

  /** Folds every folder, the added ones included: only their names stay. */
  collapseAll(): void {
    for (const dir of [...this.expanded]) this.collapse(dir);
  }

  /** Lists every loaded folder again (after the exclusions changed). */
  async reloadAll(): Promise<void> {
    await Promise.all([...this.children.keys()].map((dir) => this.load(dir)));
  }

  private async load(dir: string): Promise<void> {
    try {
      const exclude = this.ctx.settings.get<string[]>('explorer.exclude');
      const entries = (await this.ctx.fs.listDir(dir)).filter((e) => !isExcluded(e.name, exclude));
      this.children.set(
        dir,
        sortEntries(entries).map((e) => ({
          path: join(dir, e.name),
          name: e.name,
          isDir: e.isDir,
        })),
      );
    } catch (err) {
      this.children.set(dir, []);
      if (this.isRoot(dir)) this.error = `Impossible de lire ${dir} : ${message(err)}`;
    }
  }

  private watch(dir: string): void {
    if (this.watches.has(dir)) return;
    const reload = () => {
      clearTimeout(this.timers.get(dir));
      this.timers.set(
        dir,
        setTimeout(() => {
          this.timers.delete(dir);
          if (this.children.has(dir)) void this.load(dir);
        }, RELOAD_DELAY_MS),
      );
    };
    this.watches.set(dir, this.ctx.fs.watchDir(dir, reload));
  }

  private stopWatching(dir: string): void {
    this.watches.get(dir)?.dispose();
    this.watches.delete(dir);
    clearTimeout(this.timers.get(dir));
    this.timers.delete(dir);
  }

  /** The folder a new entry goes in when `path` is selected: itself if a folder, else its parent. */
  folderFor(path: string | null): string | null {
    if (!path) return this.roots[0] ?? null;
    if (this.isRoot(path)) return path;
    const node = this.find(path);
    return node?.isDir ? node.path : parentOf(path);
  }

  find(path: string): Node | undefined {
    const key = samePath(path);
    for (const nodes of this.children.values()) {
      const node = nodes.find((n) => samePath(n.path) === key);
      if (node) return node;
    }
    return undefined;
  }

  async startNew(kind: 'file' | 'folder', dir: string): Promise<void> {
    if (!this.expanded.has(dir)) await this.expand(dir);
    this.editing = { kind, dir };
  }

  /** A new file or folder next to the selection (or in the first folder). */
  async newNearSelection(kind: 'file' | 'folder'): Promise<void> {
    const dir = this.folderFor(this.selected);
    if (dir) await this.startNew(kind, dir);
  }

  startRename(path: string): void {
    if (this.isRoot(path)) return;
    const node = this.find(path);
    if (node) this.editing = { kind: 'rename', path, isDir: node.isDir };
  }

  /**
   * Applies the name typed. Returns an error to show next to the field, or
   * null when done (the field then closes).
   */
  async commit(name: string): Promise<string | null> {
    const editing = this.editing;
    if (!editing) return null;
    name = name.trim();
    if (editing.kind === 'rename' && name === baseName(editing.path)) {
      this.editing = null;
      return null;
    }
    const problem = nameProblem(name);
    if (problem) return problem;
    try {
      if (editing.kind === 'rename') await this.rename(editing.path, name);
      else await this.create(editing.kind, editing.dir, name);
    } catch (err) {
      return message(err);
    }
    this.editing = null;
    return null;
  }

  private async create(kind: 'file' | 'folder', dir: string, name: string): Promise<void> {
    const path = join(dir, name);
    if (kind === 'file') await this.ctx.fs.createFile(path);
    else await this.ctx.fs.createDir(path);
    await this.load(dir);
    this.selected = path;
    if (kind === 'file') await this.ctx.commands.execute('file.openPath', path);
  }

  private async rename(from: string, name: string): Promise<void> {
    const dir = parentOf(from);
    const to = join(dir, name);
    await this.ctx.fs.rename(from, to);
    // Open tabs follow their file, or the files of a renamed folder.
    for (const tab of this.ctx.workspace.tabs()) {
      if (tab.path && isWithin(tab.path, from)) {
        this.ctx.workspace.update(tab.id, { path: moved(tab.path, from, to) });
      }
    }
    for (const old of [...this.expanded]) {
      if (isWithin(old, from)) {
        this.expanded.delete(old);
        this.expanded.add(moved(old, from, to));
      }
    }
    await this.load(dir);
    this.selected = to;
    this.onStateChange();
  }

  /** Sends to the recycle bin after asking. */
  async trash(path: string): Promise<void> {
    if (this.isRoot(path)) return;
    const node = this.find(path);
    if (!node) return;
    const what = node.isDir ? 'le dossier' : 'le fichier';
    const answer = await this.ctx.dialogs.choose(
      `Mettre ${what} « ${node.name} » à la corbeille ?`,
      { buttons: ['Mettre à la corbeille', 'Annuler'] },
    );
    if (answer !== 'Mettre à la corbeille') return;
    try {
      await this.ctx.fs.trash(path);
      await this.load(parentOf(path));
      if (this.selected === path) this.selected = null;
    } catch (err) {
      this.error = `Impossible de supprimer : ${message(err)}`;
    }
  }
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
