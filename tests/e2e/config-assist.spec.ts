import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

/** Opens a config file in a tab, as "Ouvrir settings.json" does (stand-in path in the browser). */
async function openConfig(page: Page, name: string, text: string) {
  await page.evaluate(
    ({ name, text }) =>
      (window as unknown as DevWindow).__cascades.workspace.open({ path: `config/${name}`, text }),
    { name, text },
  );
}

/** Enter picks the suggestion; CodeMirror ignores it during the first 75 ms of the list. */
async function acceptCompletion(page: Page) {
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('settings.json: completion of setting names and values', async ({ page }) => {
  await openConfig(page, 'settings.json', '{\n  \n}');
  await page.locator('.cm-line').nth(1).click();
  await page.keyboard.type('"editor.tabS');
  const list = page.locator('.cm-tooltip-autocomplete');
  await expect(list).toContainText('editor.tabSize');
  await acceptCompletion(page);
  await expect(page.locator('.cm-line').nth(1)).toHaveText(/^\s*"editor\.tabSize": \d+$/);
});

test('settings.json: mistakes are underlined', async ({ page }) => {
  await openConfig(page, 'settings.json', '{ "editor.tabsize": 2, "editor.tabSize": "2" }');
  await expect(page.locator('.cm-lintRange-warning')).toHaveText('"editor.tabsize"');
  await expect(page.locator('.cm-lintRange-error')).toHaveText('"2"');
});

test('keybindings.json: commands are suggested, unknown ones flagged', async ({ page }) => {
  await openConfig(
    page,
    'keybindings.json',
    '[\n  { "key": "Ctrl+Alt+J", "command": "file.nouveau" }\n]',
  );
  await expect(page.locator('.cm-lintRange-warning')).toHaveText('"file.nouveau"');

  await page.locator('.cm-line').nth(1).click();
  await page.keyboard.press('End');
  await page.keyboard.type(',\n{ "key": "Ctrl+Alt+K", "command": "file.sa');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('file.save');
  await acceptCompletion(page);
  await expect(page.locator('.cm-line').nth(2)).toContainText('"command": "file.save"');
});
