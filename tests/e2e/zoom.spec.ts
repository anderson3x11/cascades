import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const fontSize = (page: Page) =>
  page.locator('.cm-scroller').evaluate((el) => getComputedStyle(el).fontSize);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('keyboard shortcuts zoom the editor text and it is remembered', async ({ page }) => {
  await expect.poll(() => fontSize(page)).toBe('14px');
  await page.keyboard.press('Control+=');
  await page.keyboard.press('Control+=');
  await expect.poll(() => fontSize(page)).toBe('16px');
  await page.keyboard.press('Control+-');
  await expect.poll(() => fontSize(page)).toBe('15px');

  await page.reload();
  await expect.poll(() => fontSize(page)).toBe('15px');

  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+0');
  await expect.poll(() => fontSize(page)).toBe('14px');
});

test('Ctrl + mouse wheel zooms like Notepad++', async ({ page }) => {
  const box = await page.locator('.cm-scroller').boundingBox();
  if (!box) throw new Error('no editor');
  await page.mouse.move(box.x + 100, box.y + 50);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(() => fontSize(page)).toBe('16px');
});

test('font settings apply to the editor', async ({ page }) => {
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.settings.setUserSettings({
      'editor.fontSize': 18,
      'editor.fontFamily': 'Georgia, serif',
      'editor.lineHeight': 2,
    }),
  );
  const style = await page.locator('.cm-scroller').evaluate((el) => {
    const s = getComputedStyle(el);
    return { size: s.fontSize, family: s.fontFamily, lineHeight: s.lineHeight };
  });
  expect(style).toEqual({ size: '18px', family: 'Georgia, serif', lineHeight: '36px' });
});
