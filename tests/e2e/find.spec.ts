import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test('Ctrl+F opens a French search panel above the text, with a match count', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.open({
      path: null,
      text: 'pain, lait\npain complet\nPAIN',
    }),
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+F');

  const panel = page.locator('.cm-panels-top .cm-search');
  await expect(panel).toBeVisible();
  await expect(panel.getByPlaceholder('Rechercher')).toBeFocused();
  await expect(panel.getByRole('button', { name: 'suivant' })).toBeVisible();
  await expect(panel.getByText('respecter la casse')).toBeVisible();

  await page.keyboard.type('pain');
  await expect(panel.locator('.cm-search-count')).toHaveText('3 résultats');
  await page.keyboard.press('Enter');
  await expect(panel.locator('.cm-search-count')).toHaveText('1 sur 3');
  await page.keyboard.press('Enter');
  await expect(panel.locator('.cm-search-count')).toHaveText('2 sur 3');

  await panel.getByText('respecter la casse').click();
  await expect(panel.locator('.cm-search-count')).toHaveText('2 sur 2');
});

test('Ctrl+G asks for the line in French', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+G');
  await expect(page.getByRole('textbox', { name: 'Aller à la ligne:' })).toBeFocused();
});
