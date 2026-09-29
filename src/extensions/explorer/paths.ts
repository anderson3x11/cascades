/** Path helpers for the explorer. Paths keep the separator of the opened folder. */
import { t } from '../../api';

export const separatorOf = (path: string) => (path.includes('\\') ? '\\' : '/');

export function join(dir: string, name: string): string {
  const sep = separatorOf(dir);
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

const lastSeparator = (path: string) => Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));

export const parentOf = (path: string) => path.slice(0, Math.max(lastSeparator(path), 0));

export const baseName = (path: string) => path.slice(lastSeparator(path) + 1) || path;

/** Comparison form: Windows paths ignore case and separator style. */
export const samePath = (path: string) => path.replace(/\\/g, '/').toLowerCase();

/** Whether `path` is `dir` itself or inside it. */
export function isWithin(path: string, dir: string): boolean {
  const p = samePath(path);
  const d = samePath(dir).replace(/\/$/, '');
  return p === d || p.startsWith(`${d}/`);
}

/** `path` moved from under `from` to under `to` ("C:/a/b.txt", "C:/a", "C:/z" -> "C:/z/b.txt"). */
export const moved = (path: string, from: string, to: string) => `${to}${path.slice(from.length)}`;

export interface Entry {
  name: string;
  isDir: boolean;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Folders first, then by name as people read them ("notes 2" before "notes 10"). */
export function sortEntries<T extends Entry>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => Number(b.isDir) - Number(a.isDir) || collator.compare(a.name, b.name),
  );
}

/** Whether a name matches one of the patterns ("node_modules", "*.log"), ignoring case. */
export function isExcluded(name: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const source = pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${source}$`, 'i').test(name);
  });
}

/** Why a file or folder name cannot be used on Windows, or null. */
export function nameProblem(name: string): string | null {
  if (name.trim() === '') return t('The name is empty.');
  if (/[\\/:*?"<>|]/.test(name)) return t('These characters are not allowed: \\ / : * ? " < > |');
  if (name === '.' || name === '..') return t('This name is reserved.');
  if (/[. ]$/.test(name)) return t('A name cannot end with a dot or a space.');
  return null;
}
