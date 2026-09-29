import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test('a big file opens in light mode', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    // A threshold of about 1 KB, so that a small file counts as big.
    w.__cascades.settings.setUserSettings({ 'files.largeFileSize': 0.001 });
    const lines = Array.from({ length: 200 }, (_, i) => `# Titre ${i}\n\tDétail ${i}`);
    w.__cascadesFs.addFile('C:/logs/journal.md', lines.join('\n'));
    w.__cascadesFs.addFile('C:/logs/petit.txt', '# Titre\n\tDétail');
    return w.__cascades.commands.execute('file.openPath', 'C:/logs/journal.md');
  });

  await expect(page.getByRole('status')).toContainText('Gros fichier');
  const status = page.getByRole('contentinfo');
  // Plain text, no word count, no cascades nor change marks.
  await expect(status).toContainText('plaintext');
  await expect(status).not.toContainText('mots');
  await expect(page.locator('.cm-change-gutter')).toHaveCount(0);
  await expect(page.locator('.cm-cascade-row')).toHaveCount(0);

  // A small file next to it is as usual.
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute(
      'file.openPath',
      'C:/logs/petit.txt',
    ),
  );
  await expect(status).toContainText('plaintext');
  await expect(status).toContainText('mots');
  await expect(page.locator('.cm-cascade-row').first()).toBeVisible();
});
