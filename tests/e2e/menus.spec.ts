import { expect, test } from '@playwright/test';
import { openMenu } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('the menu button opens the side panel with one icon per family', async ({ page }) => {
  await expect(page.getByRole('menubar')).toBeHidden();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const names = await page
    .getByRole('tablist', { name: 'Panneaux' })
    .getByRole('tab')
    .evaluateAll((tabs) => tabs.map((t) => t.getAttribute('aria-label')));
  expect(names).toEqual(['Fichiers', 'Fichier', 'Édition', 'Rechercher', 'Affichage', 'Réglages']);

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Panneaux' })).toBeHidden();
});

test('a family lists its commands with their shortcut and runs them', async ({ page }) => {
  await openMenu(page, 'Fichier');
  const menu = page.getByRole('menu', { name: 'Fichier' });
  await expect(menu.getByRole('menuitem', { name: /Nouveau fichier/ })).toContainText('Ctrl+N');
  await menu.getByRole('menuitem', { name: /Nouveau fichier/ }).click();
  await expect(page.getByRole('tab', { name: /Sans titre 2/ })).toBeVisible();
  // The panel stays open beside the text.
  await expect(menu).toBeVisible();
});

test('the Edit family lists the Edit and Text menus, and acts on the editor', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('ligne');
  await openMenu(page, 'Édition');
  await expect(page.getByRole('menu', { name: 'Texte' })).toBeVisible();
  await page.getByRole('menuitem', { name: /Dupliquer la ligne/ }).click();
  expect(await page.locator('.cm-line').allTextContents()).toEqual(['ligne', 'ligne']);
});

test('Alt alone opens and closes the side panel', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Alt');
  await expect(page.getByRole('tablist', { name: 'Panneaux' })).toBeVisible();
  await page.keyboard.press('Alt');
  await expect(page.getByRole('tablist', { name: 'Panneaux' })).toBeHidden();
});

test('the classic menu bar still works when turned on', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('M');
  await page.getByRole('menuitem', { name: 'Fichier', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Fichier' });
  await expect(menu.getByRole('menuitem', { name: /Nouveau fichier/ })).toContainText('Ctrl+N');
  await page.getByRole('menuitem', { name: 'Édition', exact: true }).hover();
  await expect(page.getByRole('menu', { name: 'Édition' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();

  // With the bar shown, Alt opens its first menu.
  await page.keyboard.press('Alt');
  await expect(page.getByRole('menu', { name: 'Fichier' })).toBeVisible();
});
