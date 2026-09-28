import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const text = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.editorView()?.state.doc.toString(),
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.open({
      path: 'C:/notes/jeux.md',
      text: '|Jeu|Note|\n|---|--:|\n|Celeste|19|',
    }),
  );
  // Wait for Markdown to be recognized before using its keys.
  await expect(page.getByRole('contentinfo')).toContainText('markdown');
  await page.locator('.cm-line').first().click();
  await page.keyboard.press('Home');
});

test('Tab moves between cells and aligns the table', async ({ page }) => {
  await page.keyboard.press('Tab');
  expect(await text(page)).toBe(
    ['| Jeu     | Note |', '| ------- | ---: |', '| Celeste |   19 |'].join('\n'),
  );
  // The next cell is selected: typing replaces it.
  await page.keyboard.type('Avis');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Hollow Knight');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  // Past the last cell, a row is added.
  await page.keyboard.type('Hades');
  await page.keyboard.press('Shift+Tab');
  expect(await text(page)).toBe(
    [
      '| Jeu           | Avis |',
      '| ------------- | ---: |',
      '| Hollow Knight |   19 |',
      '| Hades         |      |',
    ].join('\n'),
  );
});

test('Tab outside a table still indents', async ({ page }) => {
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  expect((await text(page))?.endsWith('\n\n\t')).toBe(true);
});
