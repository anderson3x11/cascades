import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('cascades-config:settings.json') ?? '{}'),
  ) as Promise<Record<string, unknown>>;

const column = (page: Page) => page.getByRole('navigation', { name: 'Onglets' });
const titles = (page: Page) =>
  column(page)
    .getByRole('tab')
    .evaluateAll((tabs) => tabs.map((t) => t.textContent?.trim()));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const ws = (window as unknown as DevWindow).__cascades.workspace;
    for (const name of ['un', 'deux', 'trois'])
      ws.open({ path: `C:/notes/${name}.txt`, text: name });
  });
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute('view.toggleVerticalTabs'),
  );
});

test('the tabs go in a column on the left, the title bar shows the file name', async ({ page }) => {
  expect(await saved(page)).toEqual({ 'workbench.tabsPosition': 'left' });
  expect(await titles(page)).toEqual(['Sans titre 1', 'un.txt', 'deux.txt', 'trois.txt']);
  await expect(page.locator('.titlebar').getByRole('tab')).toHaveCount(0);
  await expect(page.locator('.titlebar')).toContainText('trois.txt');

  await column(page)
    .getByRole('tab', { name: /un\.txt/ })
    .click();
  await expect(page.locator('.titlebar')).toContainText('un.txt');
});

test('the column folds to the start of each name, and the choice is saved', async ({ page }) => {
  await column(page).getByRole('button', { name: 'Replier les onglets' }).click();
  expect(await titles(page)).toEqual(['Sa', 'un', 'de', 'tr']);
  expect(await saved(page)).toEqual({
    'workbench.tabsPosition': 'left',
    'workbench.tabsCollapsed': true,
  });
  await column(page).getByRole('button', { name: 'Déplier les onglets' }).click();
  expect(await titles(page)).toContain('deux.txt');
});

test('the side panel takes the place of the tabs while it is open', async ({ page }) => {
  await column(page).getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(column(page)).toBeHidden();
  await expect(page.getByRole('tablist', { name: 'Menus' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(column(page)).toBeVisible();
});

test('dragging a tab down reorders the column', async ({ page }) => {
  const un = column(page).getByRole('tab', { name: /un\.txt/ });
  const trois = column(page).getByRole('tab', { name: /trois\.txt/ });
  const from = await un.boundingBox();
  const to = await trois.boundingBox();
  if (!from || !to) throw new Error('not laid out');
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 40, to.y + to.height - 2, { steps: 10 });
  await page.mouse.up();
  expect(await titles(page)).toEqual(['Sans titre 1', 'deux.txt', 'trois.txt', 'un.txt']);
});

test('a split view gets its own section', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+\\');
  await expect(column(page).getByText('Vue 2')).toBeVisible();
  await expect(column(page).getByRole('tablist')).toHaveCount(2);
});
