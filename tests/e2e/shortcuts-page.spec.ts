import { expect, test, type Page } from '@playwright/test';

const keybindingsFile = (page: Page) =>
  page.evaluate(() => localStorage.getItem('cascades-config:keybindings.json'));

async function openShortcuts(page: Page) {
  await page.keyboard.press('Control+,');
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  await dialog.getByRole('button', { name: 'Raccourcis' }).click();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
});

test('a shortcut is changed by typing the new keys', async ({ page }) => {
  const dialog = await openShortcuts(page);
  await dialog.getByRole('searchbox').fill('nouveau fichier');
  await dialog.getByRole('button', { name: 'Changer Ctrl+N : Fichier : Nouveau fichier' }).click();
  await expect(dialog.getByText('Appuie sur les touches')).toBeVisible();
  await page.keyboard.press('Control+Shift+J');

  const newKey = dialog.getByRole('button', {
    name: 'Changer Ctrl+Shift+J : Fichier : Nouveau fichier',
  });
  await expect(newKey).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Changer Ctrl\+N :/ })).toHaveCount(0);
  expect(await keybindingsFile(page)).toContain('"command": "-file.new"');

  // The window closes and the new shortcut works, the old one no more.
  await page.keyboard.press('Escape');
  const tabs = await page.getByRole('tab').count();
  await page.keyboard.press('Control+N');
  await expect(page.getByRole('tab')).toHaveCount(tabs);
  await page.keyboard.press('Control+Shift+J');
  await expect(page.getByRole('tab')).toHaveCount(tabs + 1);

  // ↺ gives the default back.
  await openShortcuts(page);
  await dialog.getByRole('searchbox').fill('nouveau fichier');
  await dialog
    .getByRole('button', { name: 'Revenir aux raccourcis par défaut : Fichier : Nouveau fichier' })
    .click();
  await expect(dialog.getByRole('button', { name: /^Changer Ctrl\+N :/ })).toBeVisible();
});

test('recording: Escape cancels, a lone letter is refused, conflicts are told', async ({
  page,
}) => {
  const dialog = await openShortcuts(page);
  await dialog.getByRole('searchbox').fill('dupliquer');
  const add = dialog.getByRole('button', { name: /^Ajouter un raccourci :/ });

  await add.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Appuie sur les touches')).toBeHidden();

  await add.click();
  await page.keyboard.press('x');
  await expect(dialog.getByRole('status')).toContainText('taperait du texte');

  await add.click();
  await page.keyboard.press('Control+S');
  await expect(dialog.getByRole('status')).toContainText(
    'Ctrl+S servait aussi à « Fichier : Enregistrer »',
  );
});

test('the leader key is recorded as "Leader X"', async ({ page }) => {
  const dialog = await openShortcuts(page);
  await dialog.getByRole('searchbox').fill('dupliquer');
  await dialog.getByRole('button', { name: /^Ajouter un raccourci :/ }).click();
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('U');
  await expect.poll(() => keybindingsFile(page)).toContain('"key": "Leader U"');
  await expect(dialog.getByRole('button', { name: /^Changer Ctrl\+Espace U :/ })).toBeVisible();
});
