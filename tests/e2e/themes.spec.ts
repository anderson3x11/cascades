import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const cssVar = (page: Page, name: string) =>
  page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    name,
  );

const setSettings = (page: Page, settings: Record<string, unknown>) =>
  page.evaluate(
    (settings) => (window as unknown as DevWindow).__cascades.settings.setUserSettings(settings),
    settings,
  );

test('auto mode follows the system light or dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme-type', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-type', 'dark');
});

test('a forced theme applies its colors and wins over the system mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await setSettings(page, { 'workbench.theme': 'nord' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-type', 'dark');
  expect(await cssVar(page, '--bg')).toBe('#2e3440');

  // Back to auto: the Nord colors are removed.
  await setSettings(page, {});
  await expect(page.locator('html')).toHaveAttribute('data-theme-type', 'light');
  expect(await cssVar(page, '--bg')).toBe('#ffffff');
});

test('user themes from the config folder can be selected', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'cascades-config:themes/sepia.json',
      JSON.stringify({ name: 'Sépia', type: 'light', colors: { bg: '#f4ecd8' } }),
    );
  });
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute('themes.reload'),
  );
  await setSettings(page, { 'workbench.theme': 'user.sepia' });
  expect(await cssVar(page, '--bg')).toBe('#f4ecd8');
});

test('an invalid user theme shows a banner', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('cascades-config:themes/bad.json', '{ oops'));
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute('themes.reload'),
  );
  await expect(page.getByRole('status')).toContainText('bad.json');
});
