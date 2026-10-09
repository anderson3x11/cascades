import { expect, test } from '@playwright/test';

const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('cascades-config:settings.json') ?? '{}'),
  ) as Promise<Record<string, unknown>>;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
  await page.keyboard.type('un\tdeux trois\nquatre');
});

test('the Display menu toggles markers and shows what is on', async ({ page }) => {
  await page.locator('footer').getByRole('button', { name: 'Affichage' }).click();
  const ends = page.getByRole('menuitemcheckbox', { name: 'Afficher les fins de ligne' });
  await expect(ends).toHaveAttribute('aria-checked', 'false');
  await ends.click();
  await expect(page.locator('.cm-marker-eol')).toHaveCount(1);
  expect(await saved(page)).toEqual({ 'editor.showLineEnds': true });

  await page.locator('footer').getByRole('button', { name: 'Affichage' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Afficher les espaces' }).click();
  await expect(page.locator('.cm-highlightSpace')).toHaveCount(1);
  await expect(page.locator('.cm-editor')).toHaveClass(/cm-hide-tabs/);

  // Unchecking writes nothing back: the default is off.
  await page.locator('footer').getByRole('button', { name: 'Affichage' }).click();
  await expect(ends).toHaveAttribute('aria-checked', 'true');
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

test('the Theme menu previews on hover, Escape restores, a click saves', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const bg = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  const button = page.locator('footer').getByRole('button', { name: /Clair/ });
  await button.click();
  await page.getByRole('menuitemcheckbox', { name: 'Nord' }).hover();
  await expect.poll(bg).toBe('#2e3440');
  await page.keyboard.press('Escape');
  await expect.poll(bg).toBe('#fcfbf8');

  await button.click();
  await page.getByRole('menuitemcheckbox', { name: 'Dracula' }).click();
  await expect.poll(bg).toBe('#282a36');
  expect(await saved(page)).toEqual({ 'workbench.theme': 'dracula' });
  await expect(page.locator('footer')).toContainText('Dracula');
});

test('the Font menu lists the default font and closes on a second click', async ({ page }) => {
  const button = page.locator('footer button[title="Police de l’éditeur"]');
  await button.click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Police par défaut' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await button.click();
  await expect(page.getByRole('menu')).toBeHidden();
});

test('the Display panel unfolds the menus in place and switches light and dark', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Affichage', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Affichage' });

  await panel.getByRole('button', { name: /Options/ }).click();
  await panel.getByRole('menuitemcheckbox', { name: 'Afficher les fins de ligne' }).click();
  await expect(page.locator('.cm-marker-eol')).toHaveCount(1);
  await expect(
    panel.getByRole('menuitemcheckbox', { name: 'Afficher les fins de ligne' }),
  ).toHaveAttribute('aria-checked', 'true');

  await panel.getByRole('button', { name: 'Clair', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-type', 'dark');
  await expect(panel.getByRole('button', { name: 'Sombre', exact: true })).toBeVisible();
});
