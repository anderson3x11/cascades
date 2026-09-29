import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test('lines changed since the last save are marked in the margin', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/notes/courses.txt', 'lait\npain\nfin');
    return w.__cascades.commands.execute('file.openPath', 'C:/notes/courses.txt');
  });
  const gutter = page.locator('.cm-change-gutter');
  await expect(gutter.locator('.cm-change-modified, .cm-change-added')).toHaveCount(0);

  await page.locator('.cm-line').nth(1).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' complet');
  await expect(gutter.locator('.cm-change-modified')).toHaveCount(1);

  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('œufs');
  await expect(gutter.locator('.cm-change-added')).toHaveCount(1);

  // Saving clears the marks.
  await page.keyboard.press('Control+S');
  await expect(gutter.locator('.cm-change-modified, .cm-change-added')).toHaveCount(0);
});
