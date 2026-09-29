import { expect, test } from '@playwright/test';

// The other tests run in French; this one checks the English interface.
test.use({ locale: 'en-US' });

test('an English system gets the English interface', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Untitled 1');
  await expect(page.getByRole('menubar')).toContainText('File');
  await expect(page.getByRole('menubar')).toContainText('Edit');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
