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

/**
 * Picks a suggestion with the mouse. CodeMirror ignores clicks and Enter during
 * the first moments of the list, so the click is repeated until `done` holds.
 */
async function pick(page: Page, label: string, done: () => Promise<void>) {
  await expect(async () => {
    const option = page.locator('.cm-tooltip-autocomplete li', { hasText: label }).first();
    if (await option.isVisible()) await option.click();
    await done();
  }).toPass();
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
  await pick(page, 'editor.tabSize', () =>
    expect(page.locator('.cm-line').nth(1)).toHaveText(/^\s*"editor\.tabSize": \d+$/, {
      timeout: 500,
    }),
  );
});

test('settings.json: completion right before the closing brace', async ({ page }) => {
  await openConfig(page, 'settings.json', '{}');
  await page.locator('.cm-line').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.type('"edi');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('editor.tabSize');
});

test('JSON comments are grayed', async ({ page }) => {
  await openConfig(page, 'settings.json', '// mes réglages\n{}');
  const comment = page.locator('.cm-json-comment');
  await expect(comment).toHaveText('// mes réglages');
  const color = (selector: string) =>
    page.evaluate(
      (selector) => getComputedStyle(document.querySelector(selector) as Element).color,
      selector,
    );
  expect(await color('.cm-json-comment')).not.toBe(await color('.cm-content'));
});

test('Ctrl+/ and Ctrl+: comment a JSON line with //', async ({ page }) => {
  await openConfig(page, 'settings.json', '{\n  "editor.tabSize": 2\n}');
  const line = page.locator('.cm-line').nth(1);
  await line.click();
  await page.keyboard.press('Control+/');
  await expect(line).toHaveText('  // "editor.tabSize": 2');
  await page.keyboard.press('Control+:');
  await expect(line).toHaveText('  "editor.tabSize": 2');
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
  await pick(page, 'file.save', () =>
    expect(page.locator('.cm-line').nth(2)).toContainText('"command": "file.save"', {
      timeout: 500,
    }),
  );
});
