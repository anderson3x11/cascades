import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { onFakeDirChange } from './fake-fs';

type Listener = () => void;
type Watch = (path: string, listener: Listener) => { dispose(): void };

/** Listeners by path for one backend event, with the commands that start and stop watching. */
function watcher(event: string, watchCommand: string, unwatchCommand: string): Watch {
  const listeners = new Map<string, Set<Listener>>();
  let subscribed: Promise<unknown> | null = null;

  return (path, listener) => {
    subscribed ??= listen<{ path: string }>(event, (e) => {
      for (const l of listeners.get(e.payload.path) ?? []) l();
    });
    let set = listeners.get(path);
    if (!set) {
      listeners.set(path, (set = new Set()));
      invoke(watchCommand, { path }).catch((err: unknown) => console.error(err));
    }
    set.add(listener);
    return {
      dispose() {
        set.delete(listener);
        if (set.size === 0 && listeners.get(path) === set) {
          listeners.delete(path);
          invoke(unwatchCommand, { path }).catch((err: unknown) => console.error(err));
        }
      },
    };
  };
}

const watchFileInApp = watcher('file-changed', 'watch_file', 'unwatch_file');
const watchDirInApp = watcher('dir-changed', 'watch_dir', 'unwatch_dir');

/**
 * Calls `listener` when the file at `path` is created, modified or removed
 * by any program (including this one). Does nothing outside Tauri.
 */
export function watchFile(path: string, listener: Listener): { dispose(): void } {
  if (!isTauri()) return { dispose() {} };
  return watchFileInApp(path, listener);
}

/** Calls `listener` when an entry of the folder is created, removed or renamed. */
export function watchDir(path: string, listener: Listener): { dispose(): void } {
  if (!isTauri()) return onFakeDirChange(path, listener);
  return watchDirInApp(path, listener);
}
