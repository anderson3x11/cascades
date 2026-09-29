import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import type { Update } from '@tauri-apps/plugin-updater';

/** Version of the running app ("0.5.0"), or "dev" in a plain browser. */
export async function appVersion(): Promise<string> {
  return isTauri() ? await getVersion() : 'dev';
}

/**
 * Asks GitHub for the latest release (latest.json). Null when this version is
 * the latest, and always in a plain browser. The update is checked against the
 * public key built into the app before it is installed.
 */
export async function checkForUpdate(): Promise<Update | null> {
  if (!isTauri()) return null;
  const { check } = await import('@tauri-apps/plugin-updater');
  return await check();
}

export async function relaunch(): Promise<void> {
  const process = await import('@tauri-apps/plugin-process');
  await process.relaunch();
}
