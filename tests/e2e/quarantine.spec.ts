import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const REVIEW = ['Elden Ring', 'Le combat est exigeant.', 'La musique est sublime.', 'Fin'].join(
  '\n',
);

async function open(page: Page, path: string, text: string) {
  await page.evaluate(
    ({ path, text }) => (window as unknown as DevWindow).__cascades.workspace.open({ path, text }),
    { path, text },
  );
}

const lines = (page: Page) => page.locator('.cm-line').allTextContents();
const panel = (page: Page) => page.getByRole('complementary', { name: 'Quarantaine' });
const cards = (page: Page) => panel(page).locator('.qx-card');

async function quarantineLine(page: Page, index: number) {
  await page.locator('.cm-line').nth(index).click();
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Q');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await open(page, 'C:/notes/review.txt', REVIEW);
});

test('sets a line aside and puts it back at the cursor', async ({ page }) => {
  await quarantineLine(page, 2);
  expect(await lines(page)).toEqual(['Elden Ring', 'Le combat est exigeant.', 'Fin']);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('pre')).toHaveText('La musique est sublime.');
  await expect(cards(page).locator('.qx-meta')).toContainText('ligne 3');

  // Back somewhere else: at the start of line 2, as a whole line.
  await page.locator('.cm-line').nth(1).click();
  await page.keyboard.press('Home');
  await cards(page).getByRole('button', { name: 'Réinsérer au curseur' }).click();
  expect(await lines(page)).toEqual([
    'Elden Ring',
    'La musique est sublime.',
    'Le combat est exigeant.',
    'Fin',
  ]);
  await expect(cards(page)).toHaveCount(0);

  // Ctrl+Z takes the text out again and brings the card back.
  await page.keyboard.press('Control+Z');
  await expect(cards(page)).toHaveCount(1);
  expect(await lines(page)).toEqual(['Elden Ring', 'Le combat est exigeant.', 'Fin']);
});

test('Ctrl+Z and Ctrl+Y keep the file and the quarantine in step', async ({ page }) => {
  // Two passages set aside at once (two cursors), as one edit.
  await page.locator('.cm-line').nth(1).click();
  await page
    .locator('.cm-line')
    .nth(2)
    .click({ modifiers: ['Control'] });
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Q');
  await expect(cards(page)).toHaveCount(2);
  expect(await lines(page)).toEqual(['Elden Ring', 'Fin']);

  await page.keyboard.press('Control+Z');
  await expect(cards(page)).toHaveCount(0);
  expect(await lines(page)).toEqual(REVIEW.split('\n'));

  await page.keyboard.press('Control+Y');
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).locator('pre')).toHaveText([
    'Le combat est exigeant.',
    'La musique est sublime.',
  ]);
});

test('a card dragged into the text lands where it is dropped', async ({ page }) => {
  await quarantineLine(page, 1);
  const card = cards(page).first();
  const target = page.locator('.cm-line').nth(2); // "Fin", now line 3
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('not laid out');
  await page.mouse.move(from.x + 20, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(to.x + 2, to.y + to.height / 2, { steps: 12 });
  await expect(page.locator('.qx-caret')).toBeVisible();
  await page.mouse.up();
  expect(await lines(page)).toEqual([
    'Elden Ring',
    'La musique est sublime.',
    'Le combat est exigeant.',
    'Fin',
  ]);
  await expect(cards(page)).toHaveCount(0);
});

test('deleting asks for confirmation and can be undone', async ({ page }) => {
  await quarantineLine(page, 2);
  const del = cards(page).getByRole('button', { name: 'Supprimer' });
  await del.click();
  await expect(cards(page)).toHaveCount(1);
  await cards(page).getByRole('button', { name: 'Confirmer ?' }).click();
  await expect(cards(page)).toHaveCount(0);
  await panel(page).getByRole('button', { name: 'Annuler' }).click();
  await expect(cards(page)).toHaveCount(1);
});

test('the quarantine belongs to its file and survives a restart', async ({ page }) => {
  await quarantineLine(page, 2);
  await open(page, 'C:/notes/autre.txt', 'Autre fichier');
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole('tab', { name: /review\.txt/ }).click();
  await expect(cards(page)).toHaveCount(1);

  await page.waitForTimeout(700); // Saved after a short delay.
  await page.reload();
  await open(page, 'C:/notes/review.txt', REVIEW);
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Shift+Q');
  await expect(cards(page).locator('pre')).toHaveText('La musique est sublime.');
});
