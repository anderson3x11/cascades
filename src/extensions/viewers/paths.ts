/** Folder of a file path, with its own separator style ("C:\notes\a.md" -> "C:\notes"). */
export function dirname(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut > 0 ? path.slice(0, cut) : path;
}

/** True for URLs and absolute paths ("https://", "C:\", "/home", "\\server"). */
export function isAbsolute(ref: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('/') || ref.startsWith('\\');
}

/**
 * Resolves a relative reference ("img/a.png", "../b.md") against a folder,
 * using the folder's separator. Query and hash parts are dropped.
 */
export function resolvePath(dir: string, ref: string): string {
  const sep = dir.includes('\\') ? '\\' : '/';
  const clean = decodeURIComponent(ref.split(/[?#]/)[0] ?? '');
  const parts = dir.split(/[\\/]/);
  for (const segment of clean.split(/[\\/]/)) {
    if (segment === '' || segment === '.') continue;
    // Never climb above the drive or root.
    if (segment === '..') {
      if (parts.length > 1) parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join(sep);
}
