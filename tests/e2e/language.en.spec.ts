import { expect, test } from '@playwright/test';

// The other tests run in French; this one checks the English interface.
test.use({ locale: 'en-US' });

test('an English system gets the English interface', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Untitled 1');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const families = page.getByRole('tablist', { name: 'Panels' });
  await expect(families.getByRole('tab', { name: 'File', exact: true })).toBeVisible();
  await expect(families.getByRole('tab', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
