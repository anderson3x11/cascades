import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

// In the browser, file URLs are the path itself: an image of the dev server stands in for a file.
const IMAGE = 'http://localhost:1430/src-tauri/icons/128x128.png';

test('images open in a viewer tab with zoom, and cannot be saved over', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (path) => (window as unknown as DevWindow).__cascades.commands.execute('file.openPath', path),
    IMAGE,
  );
  await expect(page.getByRole('tab', { selected: true })).toContainText('128x128.png');
  const viewer = page.locator('.cv-image');
  await expect(viewer).toContainText('128 × 128');
  await expect(page.locator('.cm-editor')).toBeHidden();

  await viewer.getByRole('button', { name: 'Taille réelle' }).click();
  await expect(viewer.locator('.cv-image-level')).toHaveText('100 %');
  await viewer.getByRole('button', { name: 'Agrandir' }).click();
  await expect(viewer.locator('.cv-image-level')).toHaveText('150 %');

  // Saving a viewer tab does nothing (no text would replace the image).
  const saved = await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute('file.save'),
  );
  expect(saved).toBe(true);
});

test('SVG source has a live image preview', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (text) =>
      (window as unknown as DevWindow).__cascades.workspace.open({ path: 'C:/d/rond.svg', text }),
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><circle cx="15" cy="15" r="10"/></svg>',
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Shift+V');
  await expect(page.locator('.cv-image')).toContainText('40 × 30');
});
