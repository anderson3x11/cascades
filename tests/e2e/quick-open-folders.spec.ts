import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/projet/jeux/Elden Ring.txt', 'Elden Ring\n\tCombat');
    w.__cascadesFs.addFile('C:/projet/courses.txt', 'lait');
    w.__cascadesFs.addFile('C:/projet/node_modules/lib/elden.js', '');
    for (let i = 0; i < 250; i++) w.__cascadesFs.addFile(`D:/notes/note ${i}.txt`, '');
    void w.__cascades.commands.execute('explorer.addFolder', 'C:/projet');
    return w.__cascades.commands.execute('explorer.addFolder', 'D:/notes');
  });
  await page.locator('.cm-content').first().click();
});

test('Ctrl+P finds the files of the open folders', async ({ page }) => {
  await page.keyboard.press('Control+P');
  const picker = page.getByRole('dialog');
  await picker.getByRole('combobox').fill('eld');
  // Excluded folders (node_modules) are left out.
  await expect(picker.getByRole('option')).toHaveCount(1);
  await expect(picker.getByRole('option')).toContainText('Elden Ring.txt');
  await expect(picker.getByRole('option')).toContainText('projet/jeux');

  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { selected: true })).toContainText('Elden Ring.txt');
  await expect(page.locator('.cm-line').first()).toHaveText('Elden Ring');
});

test('long lists show the best matches and say how many are left', async ({ page }) => {
  await page.keyboard.press('Control+P');
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('option')).toHaveCount(200);
  await expect(picker).toContainText('autres résultats : précise la recherche');
  await picker.getByRole('combobox').fill('note 24');
  await expect(picker.getByRole('option').first()).toContainText('note 24.txt');
});
