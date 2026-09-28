import { invoke } from '@tauri-apps/api/core';
import { message, open, save } from '@tauri-apps/plugin-dialog';

/**
 * Runs a native dialog with the mouse cursor visible. Windows "hide pointer
 * while typing" would otherwise leave it hidden in dialogs opened after typing.
 */
async function withCursor<T>(show: () => Promise<T>): Promise<T> {
  const raised = await invoke<number>('cursor_unhide');
  try {
    return await show();
  } finally {
    await invoke('cursor_restore', { raised });
  }
}

export async function pickFilesToOpen(): Promise<string[]> {
  const result = await withCursor(() => open({ multiple: true, directory: false }));
  return result ?? [];
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** The first filter's extension is appended when the user types a name without one. */
export async function pickSavePath(
  defaultPath?: string,
  filters?: FileFilter[],
): Promise<string | null> {
  return await withCursor(() => save({ defaultPath, filters }));
}

export async function alert(text: string, title = 'cascades'): Promise<void> {
  await withCursor(() => message(text, { title, kind: 'info' }));
}

export interface ChoiceOptions<T extends string> {
  title?: string;
  /** Up to three buttons: [primary, secondary, cancel]. */
  buttons: [T, T] | [T, T, T];
}

/** Message box with custom buttons. Returns the label of the clicked button. */
export async function choose<T extends string>(
  text: string,
  options: ChoiceOptions<T>,
): Promise<T> {
  const [yes, no, cancel] = options.buttons;
  const buttons = cancel ? { yes, no, cancel } : { ok: yes, cancel: no };
  const result = await withCursor(() =>
    message(text, { title: options.title ?? 'cascades', kind: 'warning', buttons }),
  );
  return (result === 'Cancel' ? (cancel ?? no) : result) as T;
}
