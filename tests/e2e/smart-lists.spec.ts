import { expect, test, type Page } from '@playwright/test';

const lines = (page: Page) => page.locator('.cm-line').allTextContents();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('Enter continues a list and leaves it on an empty item', async ({ page }) => {
  await page.keyboard.type('- lait');
  await page.keyboard.press('Enter');
  await page.keyboard.type('pain');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('fin');
  expect(await lines(page)).toEqual(['- lait', '- pain', 'fin']);
});

test('Tab nests an item and numbering follows', async ({ page }) => {
  await page.keyboard.type('1. un');
  await page.keyboard.press('Enter');
  await page.keyboard.type('sous-point');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.type('deux');
  expect(await lines(page)).toEqual(['1. un', '\t1. sous-point', '2. deux']);
});

test('deleting an item renumbers the rest in one undo step', async ({ page }) => {
  await page.keyboard.type('1. a');
  await page.keyboard.press('Enter');
  await page.keyboard.type('b');
  await page.keyboard.press('Enter');
  await page.keyboard.type('c');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Control+Shift+K');
  expect(await lines(page)).toEqual(['1. a', '2. c']);
  await page.keyboard.press('Control+Z');
  expect(await lines(page)).toEqual(['1. a', '2. b', '3. c']);
});

test('Ctrl+Enter toggles a task box', async ({ page }) => {
  await page.keyboard.type('- [ ] finir le DLC');
  await page.keyboard.press('Control+Enter');
  expect(await lines(page)).toEqual(['- [x] finir le DLC']);
  await page.keyboard.press('Control+Enter');
  expect(await lines(page)).toEqual(['- [ ] finir le DLC']);
});

test('Tab still inserts a tab outside lists', async ({ page }) => {
  await page.keyboard.type('Elden Ring');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Combat');
  expect(await lines(page)).toEqual(['Elden Ring', '\tCombat']);
});
