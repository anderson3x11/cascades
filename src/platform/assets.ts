import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

const allowed = new Set<string>();

function parentDir(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut > 0 ? path.slice(0, cut) : path;
}

/** URL the page can load for a local file; access is granted to its folder first. */
export async function fileUrl(path: string): Promise<string> {
  if (!isTauri()) return path;
  const dir = parentDir(path);
  if (!allowed.has(dir)) {
    await invoke('allow_asset_dir', { dir });
    allowed.add(dir);
  }
  return convertFileSrc(path);
}

/** Opens a web link in the default browser (a new tab outside the app). */
export async function openExternal(url: string): Promise<void> {
  if (!/^(https?|mailto):/i.test(url)) throw new Error(`Lien non pris en charge : ${url}`);
  if (isTauri()) await openUrl(url);
  else window.open(url, '_blank', 'noopener');
}
