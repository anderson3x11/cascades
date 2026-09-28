import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

async function openPreview(page: Page, text: string) {
  await page.goto('/');
  await page.evaluate(
    (text) =>
      (window as unknown as DevWindow).__cascades.workspace.open({
        path: 'C:/notes/jeux.md',
        text,
      }),
    text,
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Shift+V');
  return page.locator('.cv-markdown');
}

test('renders headings, tables, task lists and colored code', async ({ page }) => {
  const md = await openPreview(
    page,
    [
      '# Jeux',
      '',
      '| Jeu | Note |',
      '| --- | --- |',
      '| Elden Ring | 18 |',
      '',
      '- [x] finir le DLC',
      '',
      '```js',
      'const note = 18;',
      '```',
    ].join('\n'),
  );
  await expect(md.locator('h1')).toHaveText('Jeux');
  await expect(md.locator('td').first()).toHaveText('Elden Ring');
  await expect(md.locator('input[type=checkbox]')).toBeChecked();
  // Colored once the JavaScript grammar is loaded.
  await expect(md.locator('pre code span').first()).toBeAttached();
});

test('strips scripts and event handlers from the HTML', async ({ page }) => {
  const md = await openPreview(
    page,
    'Texte <script>window.pwned = true</script><img src="x.png" onerror="window.pwned = true">',
  );
  await expect(md).toContainText('Texte');
  await expect(md.locator('script')).toHaveCount(0);
  expect(await md.locator('img').getAttribute('onerror')).toBeNull();
  expect(
    await page.evaluate(() => (window as unknown as { pwned?: boolean }).pwned),
  ).toBeUndefined();
});

test('web links open outside instead of navigating the app', async ({ page }) => {
  const md = await openPreview(page, '[Le site](https://example.com)');
  const popup = page.waitForEvent('popup');
  await md.getByRole('link', { name: 'Le site' }).click();
  expect((await popup).url()).toContain('example.com');
  expect(page.url()).not.toContain('example.com');
});

test('the preview follows the editor scroll', async ({ page }) => {
  const text = Array.from(
    { length: 200 },
    (_, i) => `## Section ${i + 1}\n\nTexte ${i + 1}\n`,
  ).join('\n');
  await openPreview(page, text);
  const host = page.getByRole('region', { name: /Aperçu/ }).locator('.host');
  await expect.poll(() => host.evaluate((el) => el.scrollTop)).toBe(0);
  await page.locator('.cm-scroller').evaluate((el) => (el.scrollTop = 3000));
  await expect.poll(() => host.evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
});
