import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

async function open(page: Page, path: string, text: string) {
  await page.goto('/');
  await page.evaluate(
    ({ path, text }) => (window as unknown as DevWindow).__cascades.workspace.open({ path, text }),
    { path, text },
  );
  await page.locator('.cm-content').click();
}

const preview = (page: Page) => page.getByRole('region', { name: /Aperçu/ });

test('Ctrl+Shift+V shows a JSON tree beside the editor and hides it again', async ({ page }) => {
  await open(page, 'C:/d/data.json', '{"jeux": ["Elden Ring", "Hollow Knight"], "note": 18}');
  await page.keyboard.press('Control+Shift+V');
  await expect(preview(page)).toBeVisible();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(preview(page).locator('.cv-key')).toHaveText(['"jeux"', '0', '1', '"note"']);

  await page.keyboard.press('Control+Shift+V');
  await expect(preview(page)).toBeHidden();
});

test('the preview follows the text as it is typed', async ({ page }) => {
  await open(page, 'C:/d/data.json', '{"a": 1}');
  await page.keyboard.press('Control+Shift+V');
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type(', "b": 2');
  await expect(preview(page).locator('.cv-key')).toHaveText(['"a"', '"b"']);
  // An invalid JSON keeps the last tree and says why.
  await page.keyboard.type(',');
  await expect(preview(page).locator('.cv-error')).toBeVisible();
  await expect(preview(page).locator('.cv-key')).toHaveText(['"a"', '"b"']);
});

test('the preview can take the whole width', async ({ page }) => {
  await open(page, 'C:/d/data.json', '{"a": 1}');
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Shift+V');
  await expect(preview(page)).toBeVisible();
  await expect(page.locator('.cm-editor')).toBeHidden();
});

test('files without a viewer say so', async ({ page }) => {
  await open(page, 'C:/d/notes.txt', 'hello');
  await page.keyboard.press('Control+Shift+V');
  await expect(page.getByRole('status')).toContainText('Pas d’aperçu');
  await expect(preview(page)).toBeHidden();
});
