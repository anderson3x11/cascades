import { expect, test, type Page } from '@playwright/test';

const cssVar = (page: Page, name: string) =>
  page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    name,
  );

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('the theme picker filters, previews and saves the choice', async ({ page }) => {
  await page.keyboard.press('Control+K');
  await page.keyboard.press('Control+T');
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('option').first()).toHaveText(/Automatique/);

  await page.keyboard.type('nord');
  await expect(picker.getByRole('option')).toHaveCount(1);
  // Highlighting previews the theme.
  expect(await cssVar(page, '--bg')).toBe('#2e3440');

  await page.keyboard.press('Enter');
  await expect(picker).toBeHidden();
  const saved = await page.evaluate(() => localStorage.getItem('cascades-config:settings.json'));
  expect(JSON.parse(saved ?? '{}')).toEqual({ 'workbench.theme': 'nord' });
});

test('Escape cancels and restores the previous theme', async ({ page }) => {
  await page.getByRole('menuitem', { name: 'Affichage' }).click();
  await page.getByRole('menuitem', { name: /Thème/ }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await cssVar(page, '--bg')).not.toBe('#ffffff');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await cssVar(page, '--bg')).toBe('#ffffff');
});

test('clicking an option picks it', async ({ page }) => {
  await page.keyboard.press('Control+K');
  await page.keyboard.press('Control+T');
  await page.getByRole('option', { name: /Gruvbox/ }).click();
  expect(await cssVar(page, '--bg')).toBe('#282828');
});
