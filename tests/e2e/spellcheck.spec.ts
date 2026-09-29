import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

// In the browser, the dictionary is a stand-in: "chocola" and "fote" are wrong.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.open({
      path: null,
      text: '- miel\n- chocola\n- une fote',
    }),
  );
  await page.locator('.cm-content').click();
});

test('F7 underlines mistakes already in the text, and turns off again', async ({ page }) => {
  const status = page.getByRole('contentinfo');
  await expect(page.locator('.cm-misspelled')).toHaveCount(0);

  await page.keyboard.press('F7');
  await expect(status).toContainText('Orthographe');
  await expect(page.locator('.cm-misspelled')).toHaveText(['chocola', 'fote']);

  await page.keyboard.press('F7');
  await expect(page.locator('.cm-misspelled')).toHaveCount(0);
  await expect(status).not.toContainText('Orthographe');
});

test('right-click on a mistake offers corrections and the dictionary', async ({ page }) => {
  await page.keyboard.press('F7');
  await page.locator('.cm-misspelled', { hasText: 'chocola' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'chocolat', exact: true }).click();
  await expect(page.locator('.cm-line').nth(1)).toHaveText('- chocolat');

  await page.locator('.cm-misspelled', { hasText: 'fote' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Ajouter au dictionnaire' }).click();
  await expect(page.locator('.cm-misspelled')).toHaveCount(0);
});

test('the choice is remembered', async ({ page }) => {
  await page.keyboard.press('F7');
  await page.reload();
  await expect(page.getByRole('contentinfo')).toContainText('Orthographe');
});
