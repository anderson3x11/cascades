import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

async function open(page: Page, path: string, text = '') {
  await page.evaluate(
    ({ path, text }) => (window as unknown as DevWindow).__cascades.workspace.open({ path, text }),
    { path, text },
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
}

const text = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.editorView()?.state.doc.toString(),
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('brackets and quotes close themselves, an apostrophe in a word does not', async ({ page }) => {
  await open(page, 'C:/notes/a.txt');
  await page.keyboard.type('(voir');
  expect(await text(page)).toBe('(voir)');
  await page.keyboard.type(") l'été");
  expect(await text(page)).toBe("(voir) l'été");
});

test('Markdown: ** and ` pairs, a fence, and wrapping a selection', async ({ page }) => {
  await open(page, 'C:/notes/a.md');
  await page.keyboard.type('**gras');
  expect(await text(page)).toBe('**gras**');
  await page.keyboard.press('End');
  await page.keyboard.type(' `code');
  expect(await text(page)).toBe('**gras** `code`');

  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type('```');
  expect(await text(page)).toBe('```');

  await page.keyboard.press('Control+A');
  await page.keyboard.type('mot');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('**');
  expect(await text(page)).toBe('**mot**');
});

test('the setting turns pairs off', async ({ page }) => {
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.settings.setUserSettings({
      'autoPairs.enabled': false,
    }),
  );
  await open(page, 'C:/notes/b.txt');
  await page.keyboard.type('(');
  expect(await text(page)).toBe('(');
});
