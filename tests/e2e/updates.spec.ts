import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test('checking by hand says when Cascades is up to date', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute('app.checkForUpdates'),
  );
  await expect(page.getByText('Cascades dev est la dernière version.')).toBeVisible();
});
