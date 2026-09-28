import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const NOTES = ['Elden Ring', '\tCombat', '\t\tBoss', '\tArt', 'Hollow Knight', '\tAmbiance'].join(
  '\n',
);

async function open(page: Page, path: string, text: string) {
  await page.goto('/');
  await page.evaluate(
    ({ path, text }) => (window as unknown as DevWindow).__cascades.workspace.open({ path, text }),
    { path, text },
  );
  await page.waitForTimeout(200);
}

const rows = (page: Page) => page.locator('.cm-cascade-row');

test('draws connectors without changing the text', async ({ page }) => {
  await open(page, 'C:/n/notes.txt', NOTES);
  // Every line but the two roots gets a connector, the roots get a "start".
  await expect(rows(page)).toHaveCount(6);
  const text = await page.evaluate(() => {
    const { workspace } = (window as unknown as DevWindow).__cascades;
    return workspace.activeId ? workspace.getText(workspace.activeId) : null;
  });
  expect(text).toBe(NOTES);
  expect(await page.locator('.cm-line').allTextContents()).toEqual(NOTES.split('\n'));
});

test('highlights the parent of the cursor line', async ({ page }) => {
  await open(page, 'C:/n/notes.txt', NOTES);
  await page.locator('.cm-line').nth(2).click();
  await expect(page.locator('.cm-line.cm-cascade-parent')).toHaveText('\tCombat');
  // Vertical line under "Combat", the branch to "Boss" and its arrowhead.
  await expect(page.locator('.cm-cascade-row path.on')).toHaveCount(3);
});

test('folds a parent line with its cascade', async ({ page }) => {
  await open(page, 'C:/n/notes.txt', NOTES);
  await page.locator('.cm-foldGutter [title="Replier"]').first().click();
  expect(await page.locator('.cm-line').allTextContents()).toEqual([
    'Elden Ring⋯ 3 lignes',
    'Hollow Knight',
    '\tAmbiance',
  ]);
  // Only "Hollow Knight" and its child keep connectors; nothing is drawn for hidden lines.
  await expect(rows(page)).toHaveCount(2);
});

test('ignores Markdown list items', async ({ page }) => {
  await open(page, 'C:/n/notes.md', 'Titre\n\tsous-idée\n\n- liste\n\t- imbriquée');
  // Only "Titre" -> "sous-idée": one start row and one elbow row.
  await expect(rows(page)).toHaveCount(2);
});

test('is off for code files', async ({ page }) => {
  await open(page, 'C:/n/script.js', 'function a() {\n\treturn 1;\n}');
  await expect(rows(page)).toHaveCount(0);
});

test('Leader C hides and shows the cascades, and the choice is saved', async ({ page }) => {
  await open(page, 'C:/n/notes.txt', NOTES);
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('C');
  await expect(rows(page)).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem('cascades-config:settings.json'));
  expect(JSON.parse(saved ?? '{}')).toEqual({ 'cascades.enabled': false });

  await page.keyboard.press('Control+Space');
  await page.keyboard.press('C');
  await expect(rows(page)).toHaveCount(6);
});

test('the style picker previews and saves a style', async ({ page }) => {
  await open(page, 'C:/n/notes.txt', NOTES);
  await page.getByRole('menuitem', { name: 'Affichage' }).click();
  await page.getByRole('menuitem', { name: /Style des cascades/ }).click();
  await page.keyboard.type('points');
  // Previewed right away: bullets instead of arrowheads.
  await expect(page.locator('.cm-cascade-row path.dot').first()).toBeAttached();
  await page.keyboard.press('Enter');
  const saved = await page.evaluate(() => localStorage.getItem('cascades-config:settings.json'));
  expect(JSON.parse(saved ?? '{}')).toEqual({ 'cascades.style': 'bullet' });
});

test('can be disabled by a setting', async ({ page }) => {
  await open(page, 'C:/n/notes.txt', NOTES);
  await expect(rows(page)).toHaveCount(6);
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.settings.setUserSettings({
      'cascades.enabled': false,
    }),
  );
  await expect(rows(page)).toHaveCount(0);
});
