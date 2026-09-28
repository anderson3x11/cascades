import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const read = (page: Page, path: string) =>
  page.evaluate((path) => (window as unknown as DevWindow).__cascadesFs.read(path), path);

const panel = (page: Page) => page.getByRole('complementary', { name: 'Rechercher' });
const query = (page: Page) => page.getByRole('textbox', { name: 'Rechercher dans les fichiers' });
const status = (page: Page) => panel(page).getByRole('status');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/projet/courses.txt', 'lait\nNotes du marché\npain');
    w.__cascadesFs.addFile('C:/projet/jeux/avis.md', 'Mes notes : 18/20\ncarnotes');
    w.__cascadesFs.addFile('C:/projet/node_modules/x.js', 'notes');
    return w.__cascades.commands.execute('explorer.addFolder', 'C:/projet');
  });
  await page.locator('.cm-content').first().click();
});

test('Ctrl+Shift+F searches the files of the open folders', async ({ page }) => {
  await page.keyboard.press('Control+Shift+F');
  await expect(panel(page).getByRole('tab', { name: 'Rechercher', selected: true })).toBeVisible();
  await expect(query(page)).toBeFocused();

  await page.keyboard.type('notes');
  // Excluded folders are left out; case is ignored by default.
  await expect(status(page)).toHaveText('3 résultats dans 2 fichiers.');
  await panel(page).getByRole('button', { name: 'Mot entier' }).click();
  await expect(status(page)).toHaveText('2 résultats dans 2 fichiers.');
  await panel(page).getByRole('button', { name: 'Respecter la casse' }).click();
  await expect(status(page)).toHaveText('1 résultat dans 1 fichier.');

  // A click opens the file with the match selected.
  await panel(page)
    .getByRole('button', { name: /Mes notes/ })
    .click();
  await expect(page.locator('.tabbar').getByRole('tab', { selected: true })).toContainText(
    'avis.md',
  );
  const selected = await page.evaluate(() => {
    const state = (window as unknown as DevWindow).__cascades.workspace.editorView()?.state;
    return state ? state.sliceDoc(state.selection.main.from, state.selection.main.to) : null;
  });
  expect(selected).toBe('notes');
});

test('an invalid expression is explained', async ({ page }) => {
  await page.keyboard.press('Control+Shift+F');
  await panel(page).getByRole('button', { name: 'Expression régulière' }).click();
  await query(page).fill('(');
  await expect(status(page)).toContainText('expression invalide');
});

test('replace shows a preview, asks, and writes the files', async ({ page }) => {
  await page.keyboard.press('Control+Shift+F');
  await panel(page).getByRole('button', { name: 'Expression régulière' }).click();
  await query(page).fill('(\\d+)/20');
  await page.getByRole('textbox', { name: 'Remplacer par' }).fill('$1 sur 20');
  await expect(panel(page).locator('del')).toHaveText('18/20');
  await expect(panel(page).locator('ins')).toHaveText('18 sur 20');

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Remplacer 1 occurrence dans 1 fichier par « $1 sur 20 » ?');
    void dialog.accept();
  });
  await panel(page).getByRole('button', { name: 'Tout remplacer' }).click();
  await expect(panel(page).getByText('1 occurrence remplacée.')).toBeVisible();
  expect(await read(page, 'C:/projet/jeux/avis.md')).toBe('Mes notes : 18 sur 20\ncarnotes');
  await expect(status(page)).toHaveText('Aucun résultat.');
});

test('files with unsaved changes are left alone', async ({ page }) => {
  await page.keyboard.press('Control+Shift+F');
  await query(page).fill('lait');
  await panel(page).getByRole('button', { name: /lait/ }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' entier');

  await page.keyboard.press('Control+Shift+F');
  await query(page).fill('pain');
  await page.getByRole('textbox', { name: 'Remplacer par' }).fill('brioche');
  await expect(status(page)).toHaveText('1 résultat dans 1 fichier.');
  await panel(page).getByRole('button', { name: 'Tout remplacer' }).click();
  await expect(panel(page).getByText('enregistre-les d’abord')).toBeVisible();
  expect(await read(page, 'C:/projet/courses.txt')).toBe('lait\nNotes du marché\npain');
});

test('the selected text is searched right away', async ({ page }) => {
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.open({ path: null, text: 'marché' }),
  );
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Control+Shift+F');
  await expect(query(page)).toHaveValue('marché');
  await expect(status(page)).toHaveText('1 résultat dans 1 fichier.');
});
