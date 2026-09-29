import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const DOC = ['Elden Ring', '\tCombat', '\t\tBoss', 'Hollow Knight', '\tAmbiance', '', 'Fin.'].join(
  '\n',
);

const selected = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as DevWindow).__cascades.workspace.editorView()?.state;
    return state?.sliceDoc(state.selection.main.from, state.selection.main.to);
  });
const cursorLine = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as DevWindow).__cascades.workspace.editorView()?.state;
    return state?.doc.lineAt(state.selection.main.head).number;
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (text) => (window as unknown as DevWindow).__cascades.workspace.open({ path: null, text }),
    DOC,
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Home');
});

test('Ctrl+L adds lines, Ctrl+Shift+L removes the last one, Leader L takes the cascade', async ({
  page,
}) => {
  await page.keyboard.press('Control+L');
  await page.keyboard.press('Control+L');
  expect(await selected(page)).toBe('Elden Ring\n\tCombat\n');
  await page.keyboard.press('Control+Shift+L');
  expect(await selected(page)).toBe('Elden Ring\n');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('L');
  expect(await selected(page)).toBe('Elden Ring\n\tCombat\n\t\tBoss');
});

test('Ctrl+G goes to a line, Ctrl+End to the end', async ({ page }) => {
  await page.keyboard.press('Control+G');
  await page.keyboard.type('4');
  await page.keyboard.press('Enter');
  expect(await cursorLine(page)).toBe(4);
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  expect(await cursorLine(page)).toBe(7);
});

test('bookmarks: set, go to the next, list them', async ({ page }) => {
  await page.keyboard.press('Control+F2');
  await page.keyboard.press('Control+End');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Control+F2');
  await expect(page.locator('.cm-bookmark-dot')).toHaveCount(2);

  // F2 goes round the file.
  await page.keyboard.press('F2');
  expect(await cursorLine(page)).toBe(1);
  await page.keyboard.press('F2');
  expect(await cursorLine(page)).toBe(5);
  await page.keyboard.press('Shift+F2');
  expect(await cursorLine(page)).toBe(1);

  // Bookmarks follow the text.
  await page.keyboard.press('Enter');
  await page.keyboard.press('F2');
  expect(await cursorLine(page)).toBe(6);

  await page.getByRole('menuitem', { name: 'Aller' }).click();
  await page.getByRole('menuitem', { name: 'Signets…' }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.getByRole('option', { name: /ligne 6/ }).click();
  expect(await cursorLine(page)).toBe(6);
});
