import { expect, test, type Page } from '@playwright/test';

const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('cascades-config:settings.json') ?? '{}'),
  ) as Promise<Record<string, unknown>>;

const bg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());

const panel = (page: Page) => page.getByRole('complementary', { name: 'Options' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
  await page.keyboard.type('un\tdeux trois\nquatre');
});

test('a status bar button opens its menu in the side panel, with what is on', async ({ page }) => {
  await page.locator('footer').getByRole('button', { name: 'Affichage' }).click();
  await expect(page.getByRole('menu')).toHaveCount(1);
  const ends = panel(page).getByRole('menuitemcheckbox', { name: 'Afficher les fins de ligne' });
  await expect(ends).toHaveAttribute('aria-checked', 'false');
  await ends.click();
  await expect(page.locator('.cm-marker-eol')).toHaveCount(1);
  await expect(ends).toHaveAttribute('aria-checked', 'true');
  expect(await saved(page)).toEqual({ 'editor.showLineEnds': true });

  await panel(page).getByRole('menuitemcheckbox', { name: 'Afficher les espaces' }).click();
  await expect(page.locator('.cm-highlightSpace')).toHaveCount(1);
  await expect(page.locator('.cm-editor')).toHaveClass(/cm-hide-tabs/);

  // Unchecking writes nothing back: the default is off.
  await ends.click();
  await expect(page.locator('.cm-marker-eol')).toHaveCount(0);
  expect(await saved(page)).toEqual({ 'editor.showSpaces': true });
});

test('Alt+Z toggles word wrap', async ({ page }) => {
  await page.keyboard.press('Alt+Z');
  await expect(page.locator('.cm-content')).toHaveClass(/cm-lineWrapping/);
  await page.keyboard.press('Alt+Z');
  await expect(page.locator('.cm-content')).not.toHaveClass(/cm-lineWrapping/);
});

test('themes preview on hover, come back when the mouse leaves, a click saves', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.locator('footer').getByRole('button', { name: /Clair/ }).click();
  await panel(page).getByRole('menuitemcheckbox', { name: 'Nord' }).hover();
  await expect.poll(() => bg(page)).toBe('#2e3440');
  await page.locator('.cm-content').hover();
  await expect.poll(() => bg(page)).toBe('#fcfbf8');

  await panel(page).getByRole('menuitemcheckbox', { name: 'Dracula' }).click();
  await expect.poll(() => bg(page)).toBe('#282a36');
  expect(await saved(page)).toEqual({ 'workbench.theme': 'dracula' });
  await expect(page.locator('footer')).toContainText('Dracula');
});

test('the Font button opens the font list with the default font checked', async ({ page }) => {
  await page.locator('footer button[title="Police de l’éditeur"]').click();
  await expect(
    panel(page).getByRole('menuitemcheckbox', { name: 'Police par défaut' }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('the Options tool switches light and dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Options', exact: true }).click();
  await panel(page).getByRole('button', { name: 'Clair', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-type', 'dark');
  await expect(panel(page).getByRole('button', { name: 'Sombre', exact: true })).toBeVisible();
});
