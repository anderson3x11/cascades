import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const PAGE = `<!doctype html>
<html><body>
  <h1>Bonjour</h1>
  <a href="#fin" id="aller">Aller en bas</a>
  <a href="https://example.com" id="web">Site</a>
  <p id="out">sans script</p>
  <div style="height: 3000px"></div>
  <h2 id="fin">Fin de page</h2>
  <script>document.getElementById('out').textContent = 'script exécuté'</script>
</body></html>`;

async function openPreview(page: Page, settings: Record<string, unknown> = {}) {
  await page.goto('/');
  await page.evaluate(
    ({ text, settings }) => {
      const wb = (window as unknown as DevWindow).__cascades;
      wb.settings.setUserSettings(settings);
      wb.workspace.open({ path: 'C:/site/index.html', text });
    },
    { text: PAGE, settings },
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Shift+V');
  return page.frameLocator('iframe.cv-html');
}

const frameScroll = (page: Page) =>
  page
    .locator('iframe.cv-html')
    .evaluate((f) => (f as HTMLIFrameElement).contentWindow?.scrollY ?? -1);

test('renders the page without running its scripts', async ({ page }) => {
  const frame = await openPreview(page);
  await expect(frame.locator('h1')).toHaveText('Bonjour');
  await expect(frame.locator('#out')).toHaveText('sans script');
  // No script can run, so the page may share the app origin (to load local CSS).
  await expect(page.locator('iframe.cv-html')).toHaveAttribute('sandbox', 'allow-same-origin');
});

test('an anchor link scrolls the page instead of blanking it', async ({ page }) => {
  const frame = await openPreview(page);
  await frame.locator('#aller').click();
  await expect.poll(() => frameScroll(page)).toBeGreaterThan(1000);
  await expect(frame.locator('h1')).toHaveText('Bonjour');
});

test('web links open outside the preview', async ({ page }) => {
  const frame = await openPreview(page);
  const popup = page.waitForEvent('popup');
  await frame.locator('#web').click();
  expect((await popup).url()).toContain('example.com');
  await expect(frame.locator('h1')).toHaveText('Bonjour');
});

test('the scroll position survives live updates', async ({ page }) => {
  const frame = await openPreview(page);
  await frame.locator('#aller').click();
  await expect.poll(() => frameScroll(page)).toBeGreaterThan(1000);
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('<!-- modif -->');
  await expect.poll(() => frameScroll(page)).toBeGreaterThan(1000);
});

test('scripts run only when the setting allows them, in an isolated origin', async ({ page }) => {
  const frame = await openPreview(page, { 'preview.htmlScripts': true });
  await expect(frame.locator('#out')).toHaveText('script exécuté');
  await expect(page.locator('iframe.cv-html')).toHaveAttribute('sandbox', 'allow-scripts');
});
