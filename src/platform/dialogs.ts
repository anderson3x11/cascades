import { message, open, save } from '@tauri-apps/plugin-dialog';

export async function pickFilesToOpen(): Promise<string[]> {
  const result = await open({ multiple: true, directory: false });
  return result ?? [];
}

export async function pickSavePath(defaultPath?: string): Promise<string | null> {
  return await save(defaultPath ? { defaultPath } : {});
}

export async function alert(text: string, title = 'cascades'): Promise<void> {
  await message(text, { title, kind: 'info' });
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
  const result = await message(text, {
    title: options.title ?? 'cascades',
    kind: 'warning',
    buttons,
  });
  return (result === 'Cancel' ? (cancel ?? no) : result) as T;
}
