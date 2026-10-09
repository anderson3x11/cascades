import type { Page } from '@playwright/test';
import type { Workbench } from '../../src/app/workbench';
import type { fakeFs } from '../../src/platform/fake-fs';

/**
 * The dev build exposes the workbench on `window.__cascades`, and the
 * in-memory disk used outside the desktop app on `window.__cascadesFs`
 * (see src/main.ts).
 */
export type DevWindow = Window & { __cascades: Workbench; __cascadesFs: typeof fakeFs };

/** Opens a menu from the menu button: by default the menus have no bar. */
export async function openMenu(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
