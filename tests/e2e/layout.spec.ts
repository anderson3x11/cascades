import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('zen mode hides every bar and Escape brings them back', async ({ page }) => {
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Z');
  await expect(page.locator('.titlebar')).toBeHidden();
  await expect(page.getByRole('tablist')).toBeHidden();
  await expect(page.locator('footer')).toBeHidden();
  await expect(page.locator('main.zen')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.titlebar')).toBeVisible();
  await expect(page.getByRole('tablist')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('opening a seventh tab closes the saved one left unused the longest', async ({ page }) => {
  await page.evaluate(() => {
    const ws = (window as unknown as DevWindow).__cascades.workspace;
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f'])
      ws.open({ path: `C:/notes/${name}.txt`, text: name });
  });
  // "Sans titre 1" was the first tab, then a to f: seven opened, the untitled one is unsaved but empty.
  const titles = () => page.getByRole('tablist').first().getByRole('tab').allTextContents();
  await expect.poll(async () => (await titles()).length).toBe(6);
  expect((await titles()).map((t) => t.trim())).toEqual([
    'a.txt',
    'b.txt',
    'c.txt',
    'd.txt',
    'e.txt',
    'f.txt',
  ]);

  // An unsaved tab stays: b.txt goes instead. The new tab opens next to the active one.
  await page.getByRole('tab', { name: /a\.txt/ }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.type('!');
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.open({
      path: 'C:/notes/g.txt',
      text: 'g',
    }),
  );
  await expect.poll(async () => (await titles()).length).toBe(6);
  expect((await titles()).map((t) => t.trim())).toEqual([
    'a.txt',
    'g.txt',
    'c.txt',
    'd.txt',
    'e.txt',
    'f.txt',
  ]);
});

test('the interface font size setting applies', async ({ page }) => {
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.settings.setUserSettings({
      'workbench.fontSize': 16,
    }),
  );
  await expect
    .poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).fontSize))
    .toBe('16px');
});
