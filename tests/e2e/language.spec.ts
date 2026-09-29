import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test('the language comes from the content, or is chosen by hand', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/scripts/deploy', '#!/bin/bash\necho "ok"');
    return w.__cascades.commands.execute('file.openPath', 'C:/scripts/deploy');
  });
  const status = page.getByRole('contentinfo');
  await expect(status).toContainText('shell');

  await status.getByText('shell').click();
  await page.getByRole('combobox').fill('python');
  await page.getByRole('option', { name: 'Python', exact: true }).click();
  await expect(status).toContainText('python');

  await status.getByText('python').click();
  await page.getByRole('option', { name: /Détection automatique/ }).click();
  await expect(status).toContainText('shell');
});

test('a click on Orthographe chooses the language of the spell checker', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').click();
  await page.keyboard.press('F7');
  await page.getByRole('contentinfo').getByText('Orthographe').click();
  await page.getByRole('option', { name: /Anglais/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as DevWindow).__cascades.settings.get('spellcheck.language'),
      ),
    )
    .toBe('en');

  await page.getByRole('contentinfo').getByText('Orthographe').click();
  await page.getByRole('option', { name: /Désactiver le correcteur/ }).click();
  await expect(page.getByRole('contentinfo')).not.toContainText('Orthographe');
});
