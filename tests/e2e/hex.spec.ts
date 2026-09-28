import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('a binary file opens in a read-only hex view', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/data/image.bin', `Bonjour\0${'x'.repeat(100_000)}`);
    return w.__cascades.commands.execute('file.openPath', 'C:/data/image.bin');
  });
  await expect(page.locator('.tabbar').getByRole('tab', { selected: true })).toContainText(
    'image.bin',
  );
  await expect(page.locator('.cv-image-bar')).toHaveText('100 008 octets · lecture seule');
  const first = page.locator('.cv-hex-row').first();
  await expect(first.locator('.cv-hex-offset')).toHaveText('00000000');
  await expect(first.locator('.cv-hex-bytes')).toHaveText(
    '42 6F 6E 6A 6F 75 72 00  78 78 78 78 78 78 78 78',
  );
  await expect(first.locator('.cv-hex-text')).toHaveText('Bonjour·xxxxxxxx');

  // The status bar gives the kind of view and the size, not text details.
  const statusBar = page.getByRole('contentinfo');
  await expect(statusBar).toContainText('Hexadécimal');
  await expect(statusBar).toContainText('98 Ko');
  await expect(statusBar).not.toContainText('Ln ');

  // Only what is on screen is read and drawn, down to the last row.
  await page.locator('.cv-hex-stage').evaluate((stage) => (stage.scrollTop = stage.scrollHeight));
  await expect(page.locator('.cv-hex-row').last().locator('.cv-hex-offset')).toHaveText('000186A0');
});
