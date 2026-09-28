import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test('Ctrl+; inserts the date in the chosen format', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
  await page.keyboard.type('Le ');
  await page.keyboard.press('Control+;');
  await expect(page.locator('.cm-line').first()).toHaveText(/^Le \d{2}\/\d{2}\/\d{4}$/);

  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.settings.setUserSettings({
      'insertDate.format': '[année] YYYY',
    }),
  );
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+;');
  await expect(page.locator('.cm-line').nth(1)).toHaveText(`année ${new Date().getFullYear()}`);
});
