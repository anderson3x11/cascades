import { invoke } from '@tauri-apps/api/core';

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

/** Returns null when the file does not exist. */
export function readConfigFile(name: string): Promise<string | null> {
  return invoke<string | null>('read_config_file', { name });
}
