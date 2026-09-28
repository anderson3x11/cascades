import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('the menu bar lists menus contributed by extensions', async ({ page }) => {
  const bar = page.getByRole('menubar');
  await expect(bar.getByRole('menuitem')).toHaveText(['Fichier', 'Édition', 'Affichage']);
});

test('a menu shows items with their shortcut and runs the command', async ({ page }) => {
  await page.getByRole('menuitem', { name: 'Fichier' }).click();
  const menu = page.getByRole('menu', { name: 'Fichier' });
  await expect(menu.getByRole('menuitem', { name: /Nouveau fichier/ })).toContainText('Ctrl+N');
  await expect(menu.getByRole('separator')).toHaveCount(3);

  await menu.getByRole('menuitem', { name: /Nouveau fichier/ }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('tab')).toHaveCount(2);
});

test('hovering switches menus while one is open, Escape closes', async ({ page }) => {
  await page.getByRole('menuitem', { name: 'Fichier' }).click();
  await page.getByRole('menuitem', { name: 'Édition' }).hover();
  await expect(page.getByRole('menu', { name: 'Édition' })).toBeVisible();
  await expect(page.getByRole('menu', { name: 'Fichier' })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
});

test('clicking outside closes the menu', async ({ page }) => {
  await page.getByRole('menuitem', { name: 'Édition' }).click();
  await page.locator('.cm-content').click();
  await expect(page.getByRole('menu')).toBeHidden();
});

test('edit menu commands act on the editor', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('ligne');
  await page.getByRole('menuitem', { name: 'Édition' }).click();
  await page.getByRole('menuitem', { name: /Dupliquer la ligne/ }).click();
  expect(await page.locator('.cm-line').allTextContents()).toEqual(['ligne', 'ligne']);
});
