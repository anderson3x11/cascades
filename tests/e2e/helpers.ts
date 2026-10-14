import type { Page } from '@playwright/test';
import type { Workbench } from '../../src/app/workbench';
import type { fakeFs } from '../../src/platform/fake-fs';

/**
 * The dev build exposes the workbench on `window.__cascades`, and the
 * in-memory disk used outside the desktop app on `window.__cascadesFs`
 * (see src/main.ts).
 */
export type DevWindow = Window & { __cascades: Workbench; __cascadesFs: typeof fakeFs };

/**
 * Shows a menu's commands: the menu button opens the side panel, the menu's
 * icon shows it, and every sub-menu is unfolded.
 */
export async function openMenu(page: Page, name: string): Promise<void> {
  const menus = page.getByRole('tablist', { name: 'Menus' });
  if (!(await menus.isVisible())) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  }
  await menus.getByRole('tab', { name, exact: true }).click();
  const folded = page.locator('aside.left .row[aria-expanded="false"]');
  while ((await folded.count()) > 0) await folded.first().click();
}
