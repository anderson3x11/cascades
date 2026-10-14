import { expect, test } from '@playwright/test';
import { openMenu } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(1);
});

const names = (page: import('@playwright/test').Page, list: string) =>
  page
    .getByRole('tablist', { name: list })
    .getByRole('tab')
    .evaluateAll((tabs) => tabs.map((t) => t.getAttribute('aria-label')));

test('the menu button opens the side panel: menus on top, tools on the left', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  expect(await names(page, 'Menus')).toEqual(['Fichier', 'Édition', 'Texte', 'Aller', 'Affichage']);
  expect(await names(page, 'Outils')).toEqual(['Fichiers', 'Rechercher', 'Options', 'Réglages']);

  // The button moved into the panel, and closes it.
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Menus' })).toBeHidden();
});

test('a menu shows sub-menus that unfold, and runs their commands', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Fichier', exact: true }).click();
  const newAndOpen = page.getByRole('button', { name: /Nouveau et ouvrir/ });
  await expect(newAndOpen).toHaveAttribute('aria-expanded', 'false');
  await newAndOpen.click();
  const item = page.getByRole('group', { name: 'Nouveau et ouvrir' }).getByRole('menuitem', {
    name: /Nouveau fichier/,
  });
  await expect(item).toContainText('Ctrl+N');
  await item.click();
  await expect(page.getByRole('tab', { name: /Sans titre 2/ })).toBeVisible();
  // The panel stays open beside the text.
  await expect(item).toBeVisible();
});

test('the search field finds a command in any menu', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('ligne');
  await openMenu(page, 'Fichier');
  await page.getByRole('searchbox', { name: 'Rechercher dans les commandes' }).fill('dupliquer');
  const results = page.getByRole('menu', { name: 'Commandes' }).getByRole('menuitem');
  await expect(results).toHaveCount(1);
  await results.click();
  expect(await page.locator('.cm-line').allTextContents()).toEqual(['ligne', 'ligne']);
});

test('Alt alone opens and closes the side panel', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Alt');
  await expect(page.getByRole('tablist', { name: 'Menus' })).toBeVisible();
  await page.keyboard.press('Alt');
  await expect(page.getByRole('tablist', { name: 'Menus' })).toBeHidden();
});
