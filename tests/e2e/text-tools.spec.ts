import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const text = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.editorView()?.state.doc.toString(),
  );

async function open(page: Page, content: string) {
  await page.evaluate(
    (text) => (window as unknown as DevWindow).__cascades.workspace.open({ path: null, text }),
    content,
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Home');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('case shortcuts work on the selection or the word at the cursor', async ({ page }) => {
  await open(page, 'elden ring est génial');
  await page.keyboard.press('Shift+End');
  await page.keyboard.press('Control+Shift+U');
  expect(await text(page)).toBe('ELDEN RING EST GÉNIAL');

  // No selection: the word at the cursor.
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+U');
  expect(await text(page)).toBe('elden RING EST GÉNIAL');

  await page.keyboard.press('Control+A');
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('U');
  expect(await text(page)).toBe('Elden Ring Est Génial');
});

test('the Texte menu sorts, removes duplicates and joins lines', async ({ page }) => {
  await open(page, 'pain\nlait\nœufs\nlait');
  await page.getByRole('menuitem', { name: 'Texte' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer les lignes en double' }).click();
  expect(await text(page)).toBe('pain\nlait\nœufs');

  await page.getByRole('menuitem', { name: 'Texte' }).click();
  await page.getByRole('menuitem', { name: 'Trier les lignes (A à Z)' }).click();
  expect(await text(page)).toBe('lait\nœufs\npain');

  // Join: the line and the next one, without a selection.
  await page.keyboard.press('Control+Home');
  await page.getByRole('menuitem', { name: 'Texte' }).click();
  await page.getByRole('menuitem', { name: 'Joindre les lignes' }).click();
  expect(await text(page)).toBe('lait œufs\npain');
});
