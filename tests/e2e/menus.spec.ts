import { expect, test } from '@playwright/test';
import { openMenu } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('the menu button lists menus contributed by extensions', async ({ page }) => {
  await expect(page.getByRole('menubar')).toBeHidden();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('menubar').getByRole('menuitem')).toHaveText([
    'Fichier',
    'Édition',
    'Texte',
    'Aller',
    'Affichage',
  ]);
});

test('a menu shows items with their shortcut and runs the command', async ({ page }) => {
  await openMenu(page, 'Fichier');
  const menu = page.getByRole('menu', { name: 'Fichier' });
  await expect(menu.getByRole('menuitem', { name: /Nouveau fichier/ })).toContainText('Ctrl+N');
  await expect(menu.getByRole('separator')).toHaveCount(3);

  await menu.getByRole('menuitem', { name: /Nouveau fichier/ }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('menubar')).toBeHidden();
  await expect(page.getByRole('tab')).toHaveCount(2);
});

test('hovering switches menus while one is open, Escape closes', async ({ page }) => {
  await openMenu(page, 'Fichier');
  await page.getByRole('menuitem', { name: 'Édition', exact: true }).hover();
  await expect(page.getByRole('menu', { name: 'Édition' })).toBeVisible();
  await expect(page.getByRole('menu', { name: 'Fichier' })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(page.getByRole('menubar')).toBeHidden();
});

test('clicking outside closes the menu', async ({ page }) => {
  await openMenu(page, 'Édition');
  await page.locator('.cm-content').click();
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(page.getByRole('menubar')).toBeHidden();
});

test('edit menu commands act on the editor', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('ligne');
  await openMenu(page, 'Édition');
  await page.getByRole('menuitem', { name: /Dupliquer la ligne/ }).click();
  expect(await page.locator('.cm-line').allTextContents()).toEqual(['ligne', 'ligne']);
});

test('Alt alone opens the menus, and the keyboard goes through them', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Alt');
  await expect(page.getByRole('menubar')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Fichier', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu', { name: 'Édition' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menubar')).toBeHidden();
  await expect(page.locator('.cm-content')).toBeFocused();
});
