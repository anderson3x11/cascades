import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { invoke } from './invoke';

/**
 * Files given to the app from outside ("Open with", a double-click, a second
 * launch): those waiting since the start, then each new one.
 */
export async function onOpenFiles(listener: (paths: string[]) => void): Promise<void> {
  if (!isTauri()) return;
  // Listen first: the backend sends events once the waiting files are taken.
  await listen<string[]>('open-files', (event) => listener(event.payload));
  const waiting = await invoke<string[]>('take_pending_files');
  if (waiting.length > 0) listener(waiting);
}
