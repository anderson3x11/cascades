import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
let subscribed: Promise<unknown> | null = null;

function subscribe(): void {
  subscribed ??= listen<{ path: string }>('file-changed', (event) => {
    for (const listener of listeners.get(event.payload.path) ?? []) listener();
  });
}

/**
 * Calls `listener` when the file at `path` is created, modified or removed
 * by any program (including this one). Does nothing outside Tauri.
 */
export function watchFile(path: string, listener: Listener): { dispose(): void } {
  if (!isTauri()) return { dispose() {} };
  subscribe();
  let set = listeners.get(path);
  if (!set) {
    listeners.set(path, (set = new Set()));
    invoke('watch_file', { path }).catch((err: unknown) => console.error(err));
  }
  set.add(listener);
  return {
    dispose() {
      set.delete(listener);
      if (set.size === 0 && listeners.get(path) === set) {
        listeners.delete(path);
        invoke('unwatch_file', { path }).catch((err: unknown) => console.error(err));
      }
    },
  };
}
