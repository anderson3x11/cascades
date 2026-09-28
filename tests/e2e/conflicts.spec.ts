import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const CONFLICT = [
  'Courses',
  '\t- chips',
  '<<<<<<< ma version',
  '\t- canettes redbull',
  '=======',
  '\t- pepsi mangue',
  '>>>>>>> version du disque',
  '\t- pain',
].join('\n');

async function open(page: Page) {
  await page.goto('/');
  await page.evaluate(
    (text) =>
      (window as unknown as DevWindow).__cascades.workspace.open({
        path: 'C:/n/courses.txt',
        text,
      }),
    CONFLICT,
  );
}

const lines = (page: Page) => page.locator('.cm-line').allTextContents();

test('highlights a conflict and offers the three choices', async ({ page }) => {
  await open(page);
  await expect(page.locator('.cm-conflict-mine')).toHaveText('\t- canettes redbull');
  await expect(page.locator('.cm-conflict-theirs')).toHaveText('\t- pepsi mangue');
  await expect(page.locator('.cm-conflict-actions button')).toHaveText([
    'Garder la mienne',
    'Garder celle du disque',
    'Garder les deux',
  ]);
});

for (const [label, kept] of [
  ['Garder la mienne', ['\t- canettes redbull']],
  ['Garder celle du disque', ['\t- pepsi mangue']],
  ['Garder les deux', ['\t- canettes redbull', '\t- pepsi mangue']],
] as const) {
  test(`"${label}" resolves the conflict`, async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: label }).click();
    expect(await lines(page)).toEqual(['Courses', '\t- chips', ...kept, '\t- pain']);
    await expect(page.locator('.cm-conflict-actions')).toHaveCount(0);
    // One undo brings the conflict back.
    await page.keyboard.press('Control+Z');
    await expect(page.locator('.cm-conflict-actions')).toHaveCount(1);
  });
}
