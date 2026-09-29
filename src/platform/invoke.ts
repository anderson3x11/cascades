import { invoke as tauriInvoke, type InvokeArgs } from '@tauri-apps/api/core';
import { t } from '../core/i18n/i18n';

/**
 * The messages of the Rust backend, which writes them in English, in the
 * language of the interface. A message may come after a path ("C:/a.txt: …").
 */
const messages = (): [RegExp, (...parts: string[]) => string][] => [
  [/unknown encoding: (.+)/, (encoding = '') => t('unknown encoding: {encoding}', { encoding })],
  [
    /some characters do not exist in (.+): save the file as UTF-8 instead/,
    (encoding = '') =>
      t('some characters do not exist in {encoding}: save the file as UTF-8 instead', {
        encoding,
      }),
  ],
  [/invalid expression: (.+)/, (problem = '') => t('invalid expression: {problem}', { problem })],
  [/unreadable file, binary or too big/, () => t('unreadable file, binary or too big')],
  [/a file or folder already has this name/, () => t('a file or folder already has this name')],
  [
    /no "(.+)" dictionary is installed in Windows/,
    (language = '') => t('no "{language}" dictionary is installed in Windows', { language }),
  ],
  [
    /spell checking is not available on this system yet/,
    () => t('spell checking is not available on this system yet'),
  ],
];

export function translateBackendMessage(message: string): string {
  for (const [pattern, text] of messages()) {
    const match = pattern.exec(message);
    if (match) {
      const end = match.index + match[0].length;
      return message.slice(0, match.index) + text(...match.slice(1)) + message.slice(end);
    }
  }
  return message;
}

/** Tauri's invoke, with the backend's error messages translated. */
export async function invoke<T>(command: string, args?: InvokeArgs): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (err) {
    // The backend rejects with a plain string; it stays one.
    throw typeof err === 'string' ? translateBackendMessage(err) : err;
  }
}
