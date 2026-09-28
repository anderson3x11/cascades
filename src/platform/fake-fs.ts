/**
 * Files and folders in memory, standing in for the disk outside the desktop
 * app (dev server in a browser, e2e tests). Tests fill it through
 * `window.__cascadesFs` (see main.ts). Paths use "/" and no trailing slash.
 */

export interface FakeEntry {
  name: string;
  isDir: boolean;
}

const files = new Map<string, string>();
const dirs = new Set<string>();
const CHANGE_EVENT = 'cascades:fake-dir-change';

const parentOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf('/'), 0));
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

function changed(path: string): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: parentOf(path) }));
}

function ensureParents(path: string): void {
  for (let dir = parentOf(path); dir && !dirs.has(dir); dir = parentOf(dir)) dirs.add(dir);
}

function exists(path: string): boolean {
  return files.has(path) || dirs.has(path);
}

/** Whether a name matches a pattern where "*" stands for any text, ignoring case. */
function wildcard(name: string, pattern: string): boolean {
  const [first = '', ...rest] = pattern.toLowerCase().split('*');
  let text = name.toLowerCase();
  if (!text.startsWith(first)) return false;
  text = text.slice(first.length);
  if (rest.length === 0) return text === '';
  const last = rest.pop() ?? '';
  for (const part of rest) {
    const at = text.indexOf(part);
    if (at === -1) return false;
    text = text.slice(at + part.length);
  }
  return text.endsWith(last);
}

function fail(message: string): never {
  throw new Error(message);
}

export const fakeFs = {
  /** Adds a file, and its folders. */
  addFile(path: string, text = ''): void {
    ensureParents(path);
    files.set(path, text);
    changed(path);
  },

  addDir(path: string): void {
    ensureParents(path);
    dirs.add(path);
    changed(path);
  },

  has(path: string): boolean {
    return exists(path);
  },

  read(path: string): string {
    return files.get(path) ?? fail(`${path}: fichier introuvable`);
  },

  write(path: string, text: string): void {
    files.set(path, text);
  },

  list(dir: string): FakeEntry[] {
    if (!dirs.has(dir)) fail(`${dir}: dossier introuvable`);
    const entries: FakeEntry[] = [];
    for (const path of files.keys()) {
      if (parentOf(path) === dir) entries.push({ name: nameOf(path), isDir: false });
    }
    for (const path of dirs) {
      if (parentOf(path) === dir) entries.push({ name: nameOf(path), isDir: true });
    }
    return entries;
  },

  /** Files under the folders; `exclude` patterns may use "*". No .gitignore here. */
  listFiles(roots: string[], exclude: string[], limit: number) {
    const excluded = (name: string) => exclude.some((pattern) => wildcard(name, pattern));
    const kept = [...files.keys()].filter((path) =>
      roots.some(
        (root) =>
          path.startsWith(`${root}/`) &&
          !path
            .slice(root.length + 1)
            .split('/')
            .some(excluded),
      ),
    );
    return { files: kept.slice(0, limit), truncated: kept.length > limit };
  },

  createFile(path: string): void {
    if (exists(path)) fail(`${path}: existe déjà`);
    files.set(path, '');
    changed(path);
  },

  createDir(path: string): void {
    if (exists(path)) fail(`${path}: existe déjà`);
    dirs.add(path);
    changed(path);
  },

  rename(from: string, to: string): void {
    if (exists(to)) fail(`${to}: un fichier ou dossier porte déjà ce nom`);
    const move = (path: string) => (path === from ? to : `${to}${path.slice(from.length)}`);
    const inside = (path: string) => path === from || path.startsWith(`${from}/`);
    for (const [path, text] of [...files]) {
      if (!inside(path)) continue;
      files.delete(path);
      files.set(move(path), text);
    }
    for (const path of [...dirs]) {
      if (!inside(path)) continue;
      dirs.delete(path);
      dirs.add(move(path));
    }
    changed(from);
    changed(to);
  },

  remove(path: string): void {
    const inside = (p: string) => p === path || p.startsWith(`${path}/`);
    for (const p of [...files.keys()]) if (inside(p)) files.delete(p);
    for (const p of [...dirs]) if (inside(p)) dirs.delete(p);
    changed(path);
  },
};

export function onFakeDirChange(dir: string, listener: () => void): { dispose(): void } {
  const handler = (event: Event) => {
    if ((event as CustomEvent<string>).detail === dir) listener();
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return { dispose: () => window.removeEventListener(CHANGE_EVENT, handler) };
}
