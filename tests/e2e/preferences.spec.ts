import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const settingsFile = (page: Page) =>
  page.evaluate(() => localStorage.getItem('cascades-config:settings.json'));
const setting = (page: Page, key: string, language?: string) =>
  page.evaluate(
    ({ key, language }) => (window as unknown as DevWindow).__cascades.settings.get(key, language),
    { key, language },
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('Ctrl+, opens the preferences, Escape closes them', async ({ page }) => {
  await page.keyboard.press('Control+,');
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('searchbox')).toBeFocused();

  // Shortcuts of the app are paused meanwhile.
  const tabs = await page.getByRole('tab').count();
  await page.keyboard.press('Control+N');
  await expect(page.getByRole('tab')).toHaveCount(tabs);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('settings change from their control and go back to default', async ({ page }) => {
  await page.keyboard.press('Control+,');
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  const wrap = dialog.getByRole('switch', { name: 'Retour à la ligne automatique.' });
  await wrap.check();
  await expect.poll(() => setting(page, 'editor.wordWrap')).toBe(true);
  expect(await settingsFile(page)).toContain('"editor.wordWrap": true');

  await dialog
    .getByRole('button', { name: 'Revenir à la valeur par défaut : editor.wordWrap' })
    .click();
  await expect.poll(() => setting(page, 'editor.wordWrap')).toBe(false);
  await expect(wrap).not.toBeChecked();

  const size = dialog.getByRole('spinbutton', { name: 'Taille de police de l’éditeur (px).' });
  await size.fill('18');
  await size.press('Enter');
  await expect.poll(() => setting(page, 'editor.fontSize')).toBe(18);
});

test('search and per-language settings', async ({ page }) => {
  await page.keyboard.press('Control+,');
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  await dialog.getByRole('searchbox').fill('retour ligne');
  await expect(dialog.getByRole('switch')).toHaveCount(1);

  await dialog.getByLabel('Pour').selectOption('plaintext');
  await dialog.getByRole('switch').check();
  await expect.poll(() => setting(page, 'editor.wordWrap', 'plaintext')).toBe(true);
  expect(await setting(page, 'editor.wordWrap')).toBe(false);
  expect(await settingsFile(page)).toContain('"[plaintext]"');
});
