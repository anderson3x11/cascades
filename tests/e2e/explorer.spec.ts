import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const ROOT = 'C:/projet';

/** Fills the in-memory disk and opens the folder. */
async function openProject(page: Page) {
  await page.evaluate((root) => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile(`${root}/notes 10.txt`, 'dix');
    w.__cascadesFs.addFile(`${root}/notes 2.txt`, 'deux');
    w.__cascadesFs.addFile(`${root}/archives/2025.md`, '# Archives');
    w.__cascadesFs.addDir(`${root}/.git`);
    return w.__cascades.commands.execute('explorer.openFolder', root);
  }, ROOT);
}

const tree = (page: Page) => page.getByRole('tree');
const item = (page: Page, name: string) => tree(page).getByRole('treeitem', { name, exact: true });
const exists = (page: Page, path: string) =>
  page.evaluate((path) => (window as unknown as DevWindow).__cascadesFs.has(path), path);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openProject(page);
});

test('the folder shows on the left, folders first, hidden names left out', async ({ page }) => {
  await expect(page.getByRole('complementary', { name: 'Fichiers' })).toBeVisible();
  await expect(tree(page).locator('.name')).toHaveText(['archives', 'notes 2.txt', 'notes 10.txt']);

  await item(page, 'archives').click();
  await expect(item(page, '2025.md')).toBeVisible();
  await item(page, '2025.md').click();
  await expect(page.getByRole('tab', { selected: true })).toContainText('2025.md');
  await expect(page.locator('.cm-content')).toHaveText('# Archives');

  // Ctrl+B hides and shows the panel.
  await page.keyboard.press('Control+B');
  await expect(tree(page)).toBeHidden();
  await page.keyboard.press('Control+B');
  await expect(tree(page)).toBeVisible();
});

test('a new file is named in place and opened', async ({ page }) => {
  await page
    .getByRole('complementary', { name: 'Fichiers' })
    .getByRole('button', { name: 'Nouveau fichier' })
    .click();
  const field = page.getByRole('textbox', { name: 'Nom du nouveau fichier' });
  await field.fill('a:b');
  await field.press('Enter');
  await expect(page.getByText('Ces caractères sont interdits')).toBeVisible();

  await field.fill('idées.md');
  await field.press('Enter');
  await expect(item(page, 'idées.md')).toBeVisible();
  expect(await exists(page, `${ROOT}/idées.md`)).toBe(true);
  await expect(page.getByRole('tab', { selected: true })).toContainText('idées.md');
});

test('F2 renames, and the open tab follows', async ({ page }) => {
  await item(page, 'notes 2.txt').click();
  await tree(page).press('F2');
  const field = page.getByRole('textbox', { name: 'Nouveau nom de notes 2.txt' });
  // Only the name is selected, not the extension.
  await page.keyboard.type('courses');
  await field.press('Enter');
  await expect(item(page, 'courses.txt')).toBeVisible();
  expect(await exists(page, `${ROOT}/courses.txt`)).toBe(true);
  await expect(page.getByRole('tab', { selected: true })).toContainText('courses.txt');
});

test('Delete sends to the recycle bin after asking', async ({ page }) => {
  await item(page, 'notes 10.txt').click();
  page.once('dialog', (dialog) => void dialog.dismiss());
  await tree(page).press('Delete');
  await expect(item(page, 'notes 10.txt')).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await tree(page).press('Delete');
  await expect(item(page, 'notes 10.txt')).toBeHidden();
  expect(await exists(page, `${ROOT}/notes 10.txt`)).toBe(false);
});

test('files added by another program appear, and the menu offers actions', async ({ page }) => {
  await page.evaluate((root) => {
    (window as unknown as DevWindow).__cascadesFs.addFile(`${root}/nouveau.txt`, '');
  }, ROOT);
  await expect(item(page, 'nouveau.txt')).toBeVisible();

  await item(page, 'archives').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Nouveau dossier' }).click();
  const field = page.getByRole('textbox', { name: 'Nom du nouveau dossier' });
  await field.fill('2026');
  await field.press('Enter');
  await expect(item(page, '2026')).toBeVisible();
  expect(await exists(page, `${ROOT}/archives/2026`)).toBe(true);
});

test('the folder is remembered for the next session', async ({ page }) => {
  await item(page, 'archives').click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('cascades-config:explorer.json')))
    .toBe(JSON.stringify({ root: ROOT, expanded: [`${ROOT}/archives`] }));
});
