import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const PAGE = `<!doctype html>
<html><body>
  <h1>Bonjour</h1>
  <p id="out">sans script</p>
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

test('renders the page in a sandbox without running its scripts', async ({ page }) => {
  const frame = await openPreview(page);
  await expect(frame.locator('h1')).toHaveText('Bonjour');
  await expect(frame.locator('#out')).toHaveText('sans script');
  await expect(page.locator('iframe.cv-html')).toHaveAttribute('sandbox', '');
});

test('scripts run only when the setting allows them, still isolated', async ({ page }) => {
  const frame = await openPreview(page, { 'preview.htmlScripts': true });
  await expect(frame.locator('#out')).toHaveText('script exécuté');
  // Never same-origin with the app.
  await expect(page.locator('iframe.cv-html')).toHaveAttribute('sandbox', 'allow-scripts');
});
