import { invoke, isTauri } from '@tauri-apps/api/core';

export type LineEnding = 'lf' | 'crlf';

export interface TextFileInfo {
  /** Encoding label, e.g. "utf-8", "utf-16le", "windows-1252". */
  encoding: string;
  bom: boolean;
  lineEnding: LineEnding;
}

export interface ReadResult extends TextFileInfo {
  /** Content with line endings normalized to "\n". Empty when `binary` is true. */
  text: string;
  binary: boolean;
}

export function readTextFile(path: string): Promise<ReadResult> {
  return invoke<ReadResult>('read_text_file', { path });
}

/** `text` uses "\n"; it is converted to `info.lineEnding` and encoded by the backend. */
export function writeTextFile(path: string, text: string, info: TextFileInfo): Promise<void> {
  // Copy the fields: `info` may be a class instance whose fields are accessors.
  const { encoding, bom, lineEnding } = info;
  return invoke('write_text_file', { path, text, info: { encoding, bom, lineEnding } });
}

export function configDir(): Promise<string> {
  return invoke<string>('config_dir');
}

// Outside Tauri (plain browser for development and e2e tests), config files
// live in localStorage so that features like session restore still work.
const STORAGE_PREFIX = 'cascades-config:';
/** Fired on window with the file name as detail when a config file is written in the browser. */
const CONFIG_WRITE_EVENT = 'cascades:config-write';

/** Browser stand-in for watching a config file: calls `listener` when it is written. */
export function onBrowserConfigWrite(name: string, listener: () => void): { dispose(): void } {
  const handler = (event: Event) => {
    if ((event as CustomEvent<string>).detail === name) listener();
  };
  window.addEventListener(CONFIG_WRITE_EVENT, handler);
  return { dispose: () => window.removeEventListener(CONFIG_WRITE_EVENT, handler) };
}

/** Returns null when the file does not exist. */
export async function readConfigFile(name: string): Promise<string | null> {
  if (!isTauri()) return localStorage.getItem(STORAGE_PREFIX + name);
  return await invoke<string | null>('read_config_file', { name });
}

/** File names in a subfolder of the config folder. */
export async function listConfigFolder(folder: string): Promise<string[]> {
  if (!isTauri()) {
    const prefix = `${STORAGE_PREFIX}${folder}/`;
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
      .map((key) => key.slice(prefix.length))
      .sort();
  }
  return await invoke<string[]>('list_config_folder', { folder });
}

/** Absolute path of a config file ("themes/nord.json"), with the OS separator. */
export async function configFilePath(name: string): Promise<string> {
  const dir = await configDir();
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir}${sep}${name.split('/').join(sep)}`;
}

export async function writeConfigFile(name: string, content: string): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(STORAGE_PREFIX + name, content);
    window.dispatchEvent(new CustomEvent(CONFIG_WRITE_EVENT, { detail: name }));
    return;
  }
  await invoke('write_config_file', { name, content });
}
