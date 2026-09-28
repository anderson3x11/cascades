import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const groups = (page: Page) => page.locator('section.group');
const group = (page: Page, n: number) => groups(page).nth(n);
const linesOf = (page: Page, n: number) => group(page, n).locator('.cm-line').allTextContents();

async function open(page: Page, path: string, text: string) {
  await page.evaluate(
    ({ path, text }) => (window as unknown as DevWindow).__cascades.workspace.open({ path, text }),
    { path, text },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await open(page, 'C:/notes/review.txt', 'Elden Ring\nCombat');
  // Start from a single tab: close the untitled one the app opens.
  await page.evaluate(() => {
    const ws = (window as unknown as DevWindow).__cascades.workspace;
    const untitled = ws.tabs.find((t) => !t.path);
    if (untitled) ws.close(untitled.id);
  });
  await group(page, 0).locator('.cm-content').click();
});

test('Ctrl+\\ shows the same document in a second view, kept in sync', async ({ page }) => {
  await page.keyboard.press('Control+\\');
  await expect(groups(page)).toHaveCount(2);
  await expect(group(page, 1).getByRole('tab', { selected: true })).toContainText('review.txt');

  // Typing in the clone shows up in the first view, and both are unsaved.
  await group(page, 1).locator('.cm-line').last().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' exigeant');
  expect(await linesOf(page, 0)).toEqual(['Elden Ring', 'Combat exigeant']);
  await expect(page.locator('.close.dirty')).toHaveCount(2);

  // And the other way round.
  await group(page, 0).locator('.cm-line').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' (DLC)');
  expect(await linesOf(page, 1)).toEqual(['Elden Ring (DLC)', 'Combat exigeant']);

  // Closing one view of a modified document asks nothing and keeps the other.
  await page.keyboard.press('Control+W');
  await expect(groups(page)).toHaveCount(1);
  expect(await linesOf(page, 0)).toEqual(['Elden Ring (DLC)', 'Combat exigeant']);
});

test('each view has its own undo history', async ({ page }) => {
  await page.keyboard.press('Control+\\');
  await group(page, 1).locator('.cm-line').last().click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await group(page, 0).locator('.cm-line').first().click();
  await page.keyboard.press('Control+Z');
  // The first view has nothing to undo: the edit made in the second one stays.
  expect(await linesOf(page, 0)).toEqual(['Elden Ring', 'Combat!']);
});

test('tabs move between views, and an emptied view goes away', async ({ page }) => {
  await open(page, 'C:/notes/courses.txt', 'lait');
  await page.keyboard.press('Control+Alt+ArrowRight');
  await expect(groups(page)).toHaveCount(2);
  await expect(group(page, 0).getByRole('tab')).toHaveText(['review.txt']);
  await expect(group(page, 1).getByRole('tab')).toHaveText(['courses.txt']);

  // Ctrl+1 / Ctrl+2 switch views.
  await page.keyboard.press('Control+1');
  await expect(group(page, 0).locator('.tabbar')).toHaveClass(/focused/);
  await page.keyboard.press('Control+2');
  await expect(group(page, 1).locator('.tabbar')).toHaveClass(/focused/);

  await page.keyboard.press('Control+Alt+ArrowLeft');
  await expect(groups(page)).toHaveCount(1);
  await expect(group(page, 0).getByRole('tab')).toHaveCount(2);
});

test('a tab dropped on another view’s tab bar moves there', async ({ page }) => {
  await open(page, 'C:/notes/courses.txt', 'lait');
  await open(page, 'C:/notes/jeux.txt', 'Celeste');
  await page.keyboard.press('Control+Alt+ArrowRight');
  const tab = group(page, 0).getByRole('tab', { name: /courses\.txt/ });
  const from = await tab.boundingBox();
  const to = await group(page, 1).locator('.tabbar').boundingBox();
  if (!from || !to) throw new Error('not laid out');
  await page.mouse.move(from.x + 20, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width - 40, to.y + 10, { steps: 15 });
  await page.mouse.up();
  await expect(group(page, 1).getByRole('tab')).toHaveText(['jeux.txt', 'courses.txt']);
});

test('the tab menu clones and moves; views can be stacked', async ({ page }) => {
  await group(page, 0)
    .getByRole('tab', { name: /review\.txt/ })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Cloner dans la vue suivante' }).click();
  await expect(groups(page)).toHaveCount(2);

  await page.keyboard.press('Control+Space');
  await page.keyboard.press('\\');
  await expect(page.locator('.groups')).toHaveClass(/column/);
});

test('Leader J joins every view into one', async ({ page }) => {
  await open(page, 'C:/notes/courses.txt', 'lait');
  await page.keyboard.press('Control+Alt+ArrowRight'); // courses.txt to view 2
  await page.keyboard.press('Control+\\'); // courses.txt cloned into view 3
  await expect(groups(page)).toHaveCount(3);
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('J');
  await expect(groups(page)).toHaveCount(1);
  // One tab per file: the clone was not duplicated.
  await expect(group(page, 0).getByRole('tab')).toHaveText(['review.txt', 'courses.txt']);
  await expect(group(page, 0).getByRole('tab', { selected: true })).toContainText('courses.txt');
});

test('at most four views', async ({ page }) => {
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+\\');
  await expect(groups(page)).toHaveCount(4);
});

test('views and clones come back after a restart', async ({ page }) => {
  // In the browser the files are not on disk: only unsaved text can come back.
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('Titre : ');
  await page.keyboard.press('Control+\\');
  await open(page, 'C:/notes/brouillon.txt', 'idée');
  await group(page, 1).locator('.cm-content').click();
  await page.keyboard.type('x');
  await page.waitForTimeout(1300); // The session is saved after a short delay.

  await page.reload();
  await expect(groups(page)).toHaveCount(2);
  expect(await linesOf(page, 0)).toEqual(['Titre : Elden Ring', 'Combat']);
  const ws = await page.evaluate(() => {
    const w = (window as unknown as DevWindow).__cascades.workspace;
    return w.groups.map((g) => g.tabs.map((t) => t.title));
  });
  expect(ws).toEqual([['review.txt'], ['review.txt', 'brouillon.txt']]);
});
