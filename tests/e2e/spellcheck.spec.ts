import { expect, test } from '@playwright/test';

test('F7 turns spell checking on and off, and remembers it', async ({ page }) => {
  await page.goto('/');
  const content = page.locator('.cm-content');
  const status = page.getByRole('contentinfo');
  await content.click();
  await expect(content).toHaveAttribute('spellcheck', 'false');
  await expect(status).not.toContainText('Orthographe');

  await page.keyboard.press('F7');
  await expect(content).toHaveAttribute('spellcheck', 'true');
  await expect(content).toHaveAttribute('lang', 'fr');
  await expect(status).toContainText('Orthographe');

  await page.reload();
  await expect(page.locator('.cm-content')).toHaveAttribute('spellcheck', 'true');

  // A click on the indicator turns it off.
  await page.getByRole('contentinfo').getByText('Orthographe').click();
  await expect(page.locator('.cm-content')).toHaveAttribute('spellcheck', 'false');
});
