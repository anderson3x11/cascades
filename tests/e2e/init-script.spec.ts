import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const example = readFileSync('docs/examples/init.js', 'utf8');

test('the example init.js adds a command, a keybinding and a status item', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(1);

  await page.evaluate(async (source) => {
    // Served by Vite in the page, not resolved by TypeScript.
    const url = '/src/app/user-script.ts';
    const { loadUserScript } = (await import(
      /* @vite-ignore */ url
    )) as typeof import('../../src/app/user-script');
    const workbench = (
      window as unknown as { __cascades: import('../../src/app/workbench').Workbench }
    ).__cascades;
    await workbench.extensions.activate(await loadUserScript(source));
  }, example);

  await expect(page.locator('footer')).toContainText(/\d\d:\d\d/);

  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Alt+D');
  const today = new Date().toISOString().slice(0, 10);
  await expect(page.locator('.cm-line').first()).toHaveText(today);

  // Deactivating removes everything the script registered.
  await page.evaluate(() => {
    const workbench = (
      window as unknown as { __cascades: import('../../src/app/workbench').Workbench }
    ).__cascades;
    workbench.extensions.deactivate('user.init');
  });
  await expect(page.locator('footer')).not.toContainText(/\d\d:\d\d/);
  await page.keyboard.press('Control+Alt+D');
  await expect(page.locator('.cm-line').first()).toHaveText(today);
});
