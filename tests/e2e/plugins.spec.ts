import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { DevWindow } from './helpers';

const example = (name: string, file: string) =>
  readFileSync(`docs/plugins/examples/${name}/${file}`, 'utf8');

/** Puts plugin files in the browser stand-in for the config folder, before the app starts. */
async function install(page: Page, files: Record<string, string>) {
  await page.addInitScript((files) => {
    for (const [name, text] of Object.entries(files)) {
      localStorage.setItem(`cascades-config:plugins/${name}`, text);
    }
  }, files);
}

async function openExtensions(page: Page) {
  await page.locator('.cm-content').click();
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute('preferences.openExtensions'),
  );
  return page.getByRole('dialog', { name: 'Préférences' });
}

test('a plugin is turned on and off from the Extensions page', async ({ page }) => {
  await install(page, {
    'writing-time/manifest.json': example('writing-time', 'manifest.json'),
    'writing-time/main.js': example('writing-time', 'main.js'),
  });
  await page.goto('/');
  const dialog = await openExtensions(page);
  await expect(dialog).toContainText('Writing time');
  const status = page.getByRole('contentinfo').first();
  await expect(status).not.toContainText('min d’écriture');

  await dialog.getByRole('switch', { name: 'Activer Writing time' }).check();
  await expect(status).toContainText('0 min d’écriture');

  await dialog.getByRole('switch', { name: 'Activer Writing time' }).uncheck();
  await expect(status).not.toContainText('min d’écriture');
});

test('a broken manifest is shown, and a plugin without "files" cannot read files', async ({
  page,
}) => {
  await install(page, {
    'broken/manifest.json': '{ "id": "Broken" }',
    'nosy/manifest.json': JSON.stringify({ id: 'nosy', name: 'Nosy', version: '1.0.0' }),
    'nosy/main.js': `export default function (ctx) {
      ctx.fs.listDir('C:/').then(() => (window.nosy = 'read'), (e) => (window.nosy = e.message));
    }`,
  });
  await page.goto('/');
  const dialog = await openExtensions(page);
  await expect(dialog).toContainText('minuscules reliés par des tirets');

  await dialog.getByRole('switch', { name: 'Activer Nosy' }).check();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { nosy?: string }).nosy))
    .toContain('permission « files »');
});

test('the note template plugin inserts a note', async ({ page }) => {
  await install(page, {
    'note-template/manifest.json': example('note-template', 'manifest.json'),
    'note-template/main.js': example('note-template', 'main.js'),
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'cascades-config:settings.json',
      JSON.stringify({ 'plugins.enabled': ['note-template'] }),
    ),
  );
  await page.goto('/');
  await page.locator('.cm-content').click();
  // Not awaited: the command waits for the choice below.
  await page.evaluate(() => {
    void (window as unknown as DevWindow).__cascades.commands.execute('noteTemplate.insert');
  });
  await page.getByRole('option', { name: 'Réunion' }).click();
  await expect(page.locator('.cm-content')).toContainText('Décisions');
});
