import { expect, test, type Page } from '@playwright/test';

const lines = (page: Page) => page.locator('.cm-line').allTextContents();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('starts with one untitled tab and a status bar', async ({ page }) => {
  await expect(page.getByRole('tab')).toHaveText('Sans titre 1');
  await expect(page.locator('footer')).toContainText('Ln 1, Col 1');
  await expect(page.locator('footer')).toContainText('plaintext');
});

test('Enter keeps tab indentation', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('Elden Ring');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Combat');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Boss');
  expect(await lines(page)).toEqual(['Elden Ring', '\tCombat', '\tBoss']);
});

test('marks the tab dirty and counts words', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('deux mots');
  await expect(page.locator('.close.dirty')).toHaveCount(1);
  await expect(page.locator('footer')).toContainText('2 mots, 9 caractères');
  await expect(page.locator('footer')).toContainText('Ln 1, Col 10');
});

test('keybindings drive tab commands', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('premier');
  await page.keyboard.press('Control+N');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Sans titre 2');
  expect(await lines(page)).toEqual(['']);

  await page.keyboard.press('Control+Tab');
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Sans titre 1');
  expect(await lines(page)).toEqual(['premier']);

  // Closing a clean tab does not prompt.
  await page.keyboard.press('Control+Tab');
  await page.keyboard.press('Control+W');
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('the + button opens a new tab', async ({ page }) => {
  await page.getByRole('button', { name: 'Nouveau fichier' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Sans titre 2');
});

test('editor commands run through the command registry', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.type('ligne');
  await page.keyboard.press('Shift+Alt+ArrowDown');
  expect(await lines(page)).toEqual(['ligne', 'ligne']);
});
