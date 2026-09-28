import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('zen mode hides every bar and Escape brings them back', async ({ page }) => {
  await page.keyboard.press('Control+K');
  await page.keyboard.press('Z');
  await expect(page.getByRole('menubar')).toBeHidden();
  await expect(page.getByRole('tablist')).toBeHidden();
  await expect(page.locator('footer')).toBeHidden();
  await expect(page.locator('main.zen')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menubar')).toBeVisible();
  await expect(page.getByRole('tablist')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('a hidden menu bar comes back with its shortcut, and the choice is saved', async ({
  page,
}) => {
  await page.getByRole('menuitem', { name: 'Affichage' }).click();
  await page.getByRole('menuitem', { name: /masquer la barre de menus/ }).click();
  await expect(page.getByRole('menubar')).toBeHidden();
  const saved = await page.evaluate(() => localStorage.getItem('cascades-config:settings.json'));
  expect(JSON.parse(saved ?? '{}')).toEqual({ 'workbench.showMenuBar': false });

  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+K');
  await page.keyboard.press('M');
  await expect(page.getByRole('menubar')).toBeVisible();
});

test('the interface font size setting applies', async ({ page }) => {
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.settings.setUserSettings({
      'workbench.fontSize': 16,
    }),
  );
  await expect
    .poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).fontSize))
    .toBe('16px');
});
