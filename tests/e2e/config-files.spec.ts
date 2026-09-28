import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

/** Edits a file of the config folder as the user would, by hand. */
const writeConfig = (page: Page, name: string, content: string) =>
  page.evaluate(
    ({ name, content }) => {
      localStorage.setItem(`cascades-config:${name}`, content);
      window.dispatchEvent(new CustomEvent('cascades:config-write', { detail: name }));
    },
    { name, content },
  );

const tabCount = (page: Page) =>
  page.evaluate(() => (window as unknown as DevWindow).__cascades.workspace.tabs.length);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('keybindings.json adds and removes shortcuts, live', async ({ page }) => {
  await writeConfig(
    page,
    'keybindings.json',
    `[
      // Nouveau fichier en plus de Ctrl+N
      { "key": "Ctrl+Alt+J", "command": "file.new" },
      { "key": "Ctrl+N", "command": "-file.new" },
    ]`,
  );
  const before = await tabCount(page);
  await page.keyboard.press('Control+Alt+J');
  await expect.poll(() => tabCount(page)).toBe(before + 1);
  await page.keyboard.press('Control+N');
  expect(await tabCount(page)).toBe(before + 1);

  // Emptying the file gives the default shortcuts back.
  await writeConfig(page, 'keybindings.json', '[]');
  await page.keyboard.press('Control+N');
  await expect.poll(() => tabCount(page)).toBe(before + 2);
});

test('mistakes in the files are reported, the rest still applies', async ({ page }) => {
  await writeConfig(
    page,
    'keybindings.json',
    '[{ "key": "Ctrl+Truc+N", "command": "file.new" }, { "key": "Ctrl+Alt+J", "command": "file.new" }]',
  );
  await expect(page.getByRole('status')).toContainText('keybindings.json entrée 1');
  const before = await tabCount(page);
  await page.keyboard.press('Control+Alt+J');
  await expect.poll(() => tabCount(page)).toBe(before + 1);

  await writeConfig(page, 'settings.json', '{ "editor.tabSize": 3,, }');
  const settingsBanner = page.getByRole('status').filter({ hasText: 'settings.json' });
  await expect(settingsBanner).toContainText('nom entre guillemets attendu (ligne 1)');
  await writeConfig(page, 'settings.json', '{ /* ok */ "editor.tabSize": 3 }');
  await expect(settingsBanner).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as unknown as DevWindow).__cascades.settings.get('editor.tabSize'),
    ),
  ).toBe(3);
});
