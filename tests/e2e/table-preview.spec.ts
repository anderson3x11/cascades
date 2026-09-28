import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

const CSV = ['jeu;note;heures', 'Hollow Knight;17;60', 'Elden Ring;18;150', 'Celeste;16;9'].join(
  '\n',
);

test('CSV files show a sortable table', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (text) =>
      (window as unknown as DevWindow).__cascades.workspace.open({ path: 'C:/d/jeux.csv', text }),
    CSV,
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Shift+V');
  const table = page.locator('.cv-table');
  await expect(table).toContainText('3 lignes, 3 colonnes.');
  const firstColumn = () => table.locator('tbody tr td:first-child').allTextContents();
  expect(await firstColumn()).toEqual(['Hollow Knight', 'Elden Ring', 'Celeste']);

  // Numbers sort by value (9 before 60 before 150), then descending, then back.
  await table.getByRole('button', { name: 'heures' }).click();
  expect(await firstColumn()).toEqual(['Celeste', 'Hollow Knight', 'Elden Ring']);
  await table.getByRole('button', { name: /heures/ }).click();
  expect(await firstColumn()).toEqual(['Elden Ring', 'Hollow Knight', 'Celeste']);
  await table.getByRole('button', { name: /heures/ }).click();
  expect(await firstColumn()).toEqual(['Hollow Knight', 'Elden Ring', 'Celeste']);
});
