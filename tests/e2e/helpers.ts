import type { Page } from '@playwright/test';
import type { Workbench } from '../../src/app/workbench';
import type { fakeFs } from '../../src/platform/fake-fs';

/**
 * The dev build exposes the workbench on `window.__cascades`, and the
 * in-memory disk used outside the desktop app on `window.__cascadesFs`
 * (see src/main.ts).
 */
export type DevWindow = Window & { __cascades: Workbench; __cascadesFs: typeof fakeFs };

/** Family of the side panel holding each menu's commands. */
const FAMILIES: Record<string, string> = { Texte: 'Édition', Aller: 'Rechercher' };

/** Shows a menu's commands: the menu button opens the side panel, then its family. */
export async function openMenu(page: Page, name: string): Promise<void> {
  const families = page.getByRole('tablist', { name: 'Panneaux' });
  if (!(await families.isVisible())) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  }
  await families.getByRole('tab', { name: FAMILIES[name] ?? name, exact: true }).click();
}
