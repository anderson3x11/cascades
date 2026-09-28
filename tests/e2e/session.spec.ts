import { expect, test } from '@playwright/test';

// In the browser, config files live in localStorage, which survives a reload.

test('restores untitled tabs with their text and cursor after a restart', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
  await page.keyboard.type('Elden Ring');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Combat');
  await page.keyboard.press('Control+N');
  await page.keyboard.type('second');
  await page.keyboard.press('Home');
  await page.getByRole('tab', { name: 'Sans titre 1' }).click();

  await page.reload();

  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { selected: true })).toContainText('Sans titre');
  expect(await page.locator('.cm-line').allTextContents()).toEqual(['Elden Ring', '\tCombat']);
  // Restored text is unsaved, so the tab shows the dirty marker.
  await expect(page.locator('.close.dirty')).toHaveCount(2);
  // Cursor back at the end of "Combat".
  await expect(page.locator('footer')).toContainText('Ln 2, Col 8');
});

test('does not restore empty untitled tabs', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+N');
  await page.reload();
  await expect(page.getByRole('tab')).toHaveCount(1);
});
