import { test, type Page } from '@playwright/test';
import type { DevWindow } from '../e2e/helpers';

/** Pictures of the README, written to docs/images. */
const OUT = 'docs/images';

const NOTES = [
  'Elden Ring',
  '\tCombat exigeant',
  '\t\tSurtout les boss du DLC',
  '\t\tParades très satisfaisantes',
  '\tDirection artistique folle',
  '',
  'Hollow Knight',
  '\tAmbiance incroyable',
  '\t\tLa musique de Christopher Larkin',
  '\tDifficulté bien dosée',
  '',
  'À faire',
  '\t- [x] Finir le DLC',
  '\t- [ ] Tester Silksong',
  '\t- [ ] Écrire la critique',
].join('\n');

const REVIEW = [
  '# Hollow Knight',
  '',
  'Un metroidvania **exigeant** et *magnifique*.',
  '',
  '| Critère     | Note |',
  '| ----------- | ---: |',
  '| Ambiance    |   10 |',
  '| Combat      |    9 |',
  '| Exploration |    9 |',
  '',
  '- [x] Terminé',
  '- [ ] Toutes les fins',
].join('\n');

async function setUp(page: Page, scheme: 'dark' | 'light') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto('/');
  await page.evaluate(
    async ({ notes, review }) => {
      const w = window as unknown as DevWindow;
      const fs = w.__cascadesFs;
      fs.addFile('C:/Notes/jeux.txt', notes);
      fs.addFile('C:/Notes/critiques/hollow-knight.md', review);
      fs.addFile('C:/Notes/critiques/elden-ring.md', '# Elden Ring');
      fs.addFile('C:/Notes/courses.md', '- lait');
      fs.addFile('C:/Notes/idées.txt', '');
      await w.__cascades.commands.execute('explorer.addFolder', 'C:/Notes');
      const untitled = w.__cascades.workspace.tabs.find((t) => !t.path);
      if (untitled) w.__cascades.workspace.close(untitled.id);
    },
    { notes: NOTES, review: REVIEW },
  );
}

test('main window, dark', async ({ page }) => {
  await setUp(page, 'dark');
  await page.getByRole('treeitem', { name: 'critiques' }).click();
  await page.getByRole('treeitem', { name: 'jeux.txt' }).click();
  await page.locator('.cm-line').nth(8).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/cascades.png` });
});

test('Markdown preview, light', async ({ page }) => {
  await setUp(page, 'light');
  await page.keyboard.press('Control+B');
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.commands.execute(
      'file.openPath',
      'C:/Notes/critiques/hollow-knight.md',
    ),
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Shift+V');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/preview.png` });
});

test('Preferences, dark', async ({ page }) => {
  await setUp(page, 'dark');
  await page.getByRole('treeitem', { name: 'jeux.txt' }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+,');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/preferences.png` });
});
