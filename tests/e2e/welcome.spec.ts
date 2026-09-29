import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const tabs = (page: Page) => page.locator('.tabbar').getByRole('tab');
const welcome = (page: Page) => page.locator('.welcome');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('closing the last tab shows the welcome page; typing starts a note', async ({ page }) => {
  await page.keyboard.press('Control+W');
  await expect(tabs(page)).toHaveText(['Accueil']);
  await expect(welcome(page)).toBeVisible();
  await expect(welcome(page).getByRole('button', { name: /Nouveau fichier/ })).toContainText(
    'Ctrl+N',
  );

  await page.keyboard.type('Bonjour');
  await expect(tabs(page)).toHaveText(['Sans titre 2']);
  expect(
    await page.evaluate(() =>
      (window as unknown as DevWindow).__cascades.workspace.editorView()?.state.doc.toString(),
    ),
  ).toBe('Bonjour');
});

test('the page lists recent files and opens them', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/notes/jeux.txt', 'Elden Ring');
    return w.__cascades.commands.execute('file.openPath', 'C:/notes/jeux.txt');
  });
  await page.getByRole('menuitem', { name: 'Fichier' }).click();
  await page.getByRole('menuitem', { name: 'Accueil' }).click();
  await expect(welcome(page)).toBeVisible();

  await welcome(page)
    .getByRole('button', { name: /jeux\.txt/ })
    .click();
  await expect(page.locator('.tabbar').getByRole('tab', { selected: true })).toContainText(
    'jeux.txt',
  );
  // The page stepped aside.
  await expect(tabs(page).filter({ hasText: 'Accueil' })).toHaveCount(0);
});

test('closing the welcome page itself opens a new note', async ({ page }) => {
  await page.keyboard.press('Control+W');
  await expect(tabs(page)).toHaveText(['Accueil']);
  await page.keyboard.press('Control+W');
  await expect(tabs(page)).toHaveText(['Sans titre 2']);
});
