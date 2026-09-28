import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('the leader key shows the keys that can follow', async ({ page }) => {
  await page.keyboard.press('Control+Space');
  const hint = page.getByRole('status', { name: 'Touches disponibles' });
  await expect(hint).toContainText('Ctrl+Espace');
  await expect(hint.locator('li', { hasText: 'Mode zen' }).locator('kbd')).toHaveText('Z');
  await expect(hint.locator('li', { hasText: 'Thème' }).locator('kbd')).toHaveText('T');

  await page.keyboard.press('Escape');
  await expect(hint).toBeHidden();
  // Escape only cancelled the sequence: no character typed, zen not toggled.
  expect(await page.locator('.cm-line').allTextContents()).toEqual(['']);
});

test('the hint goes away once the sequence is complete', async ({ page }) => {
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Z');
  await expect(page.getByRole('status', { name: 'Touches disponibles' })).toBeHidden();
  await expect(page.locator('main.zen')).toBeVisible();
});

test('the leader key can be changed in the settings', async ({ page }) => {
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.settings.setUserSettings({
      'keyboard.leader': 'Alt+Q',
    }),
  );
  await page.keyboard.press('Alt+Q');
  await page.keyboard.press('Z');
  await expect(page.locator('main.zen')).toBeVisible();
});

test('the command palette lists commands with their shortcut and runs them', async ({ page }) => {
  await page.keyboard.press('Control+Shift+P');
  const picker = page.getByRole('dialog');
  await page.keyboard.type('zen');
  await expect(picker.getByRole('option').first()).toContainText('Affichage : Mode zen');
  await expect(picker.getByRole('option').first()).toContainText('Ctrl+Espace Z');
  await page.keyboard.press('Enter');
  await expect(page.locator('main.zen')).toBeVisible();
});

test('quick open jumps to an open tab', async ({ page }) => {
  await page.evaluate(() => {
    const { workspace } = (window as unknown as DevWindow).__cascades;
    workspace.open({ path: 'C:/notes/jeux.txt', text: 'Elden Ring' });
    workspace.open({ path: 'C:/notes/courses.txt', text: 'lait' });
  });
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+P');
  await page.keyboard.type('jeux');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { selected: true })).toContainText('jeux.txt');
});
