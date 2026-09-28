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

/** The opened folder and what is shown of it. */
export class ExplorerModel {
  root = $state<string | null>(null);
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
    /** Called when the folder or the expanded folders change, to remember them. */
    private onStateChange: () => void,
  ) {}

  /** Visible rows, depth first. */
  rows(): Row[] {
    const out: Row[] = [];
    const walk = (dir: string, depth: number) => {
      for (const node of this.children.get(dir) ?? []) {
        const expanded = node.isDir && this.expanded.has(node.path);
        out.push({ ...node, depth, expanded });
        if (expanded) walk(node.path, depth + 1);
      }
    };
    if (this.root) walk(this.root, 0);
    return out;
  }

  async open(root: string, expanded: string[] = []): Promise<void> {
    this.close();
    this.root = root;
    await this.load(root);
    this.watch(root);
    // Parents before children, so that each folder is loaded once.
    for (const dir of [...expanded].sort((a, b) => a.length - b.length)) {
      if (isWithin(dir, root) && dir !== root) await this.expand(dir, false);
    }
    this.onStateChange();
  }

  close(): void {
    for (const watch of this.watches.values()) watch.dispose();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.watches.clear();
    this.timers.clear();
    this.children.clear();
    this.expanded.clear();
    this.root = null;
    this.selected = null;
    this.editing = null;
    this.error = null;
    this.onStateChange();
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
    this.watches.get(dir)?.dispose();
    this.watches.delete(dir);
    this.onStateChange();
  }

  collapseAll(): void {
    for (const dir of [...this.expanded]) {
      this.watches.get(dir)?.dispose();
      this.watches.delete(dir);
    }
    this.expanded.clear();
    this.onStateChange();
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
      if (dir === this.root) this.error = null;
    } catch (err) {
      this.children.set(dir, []);
      if (dir === this.root) this.error = `Impossible de lire le dossier : ${message(err)}`;
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

  /** The folder a new entry goes in when `path` is selected: itself if a folder, else its parent. */
  folderFor(path: string | null): string | null {
    if (!path || !this.root) return this.root;
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
    if (dir !== this.root && !this.expanded.has(dir)) await this.expand(dir);
    this.editing = { kind, dir };
  }

  startRename(path: string): void {
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
