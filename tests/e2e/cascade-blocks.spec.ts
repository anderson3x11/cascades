import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const NOTES = [
  'Elden Ring', //       1
  '\tCombat', //         2
  'Hollow Knight', //    3
  '\tAmbiance', //       4
  'Courses', //          5
  '\t- lait', //         6
  '\t- pain', //         7
].join('\n');

async function open(page: Page, settings: Record<string, unknown> = {}) {
  await page.evaluate(
    ({ text, settings }) => {
      const wb = (window as unknown as DevWindow).__cascades;
      wb.settings.setUserSettings(settings);
      wb.workspace.open({ path: 'C:/n/cascades.txt', text });
    },
    { text: NOTES, settings },
  );
}

/** Lines (1-based) that have connectors drawn, from their vertical position. */
async function linesWithConnectors(page: Page): Promise<number[]> {
  return await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.cm-line')].map((l) => l.getBoundingClientRect());
    return [...document.querySelectorAll<HTMLElement>('.cm-cascade-row')]
      .map((row) => {
        const top = row.getBoundingClientRect().top;
        return lines.findIndex((l) => Math.abs(l.top - top) < 3) + 1;
      })
      .sort((a, b) => a - b);
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the ignoreLists setting leaves list items without connectors', async ({ page }) => {
  await open(page, { 'cascades.ignoreLists': true });
  await expect.poll(() => linesWithConnectors(page)).toEqual([1, 2, 3, 4]);
});

test('a block can be hidden from its root line, remembered for the file', async ({ page }) => {
  await open(page);
  await expect.poll(() => linesWithConnectors(page)).toEqual([1, 2, 3, 4, 5, 6, 7]);

  const courses = page.locator('.cm-line').nth(4);
  await courses.hover();
  await courses.getByRole('button', { name: 'Masquer la cascade de ce bloc' }).click();
  await expect.poll(() => linesWithConnectors(page)).toEqual([1, 2, 3, 4]);
  // The file itself is untouched.
  expect(await page.locator('.cm-line').allTextContents()).toEqual(NOTES.split('\n'));

  await page.waitForTimeout(500);
  await page.reload();
  await open(page);
  await expect.poll(() => linesWithConnectors(page)).toEqual([1, 2, 3, 4]);

  // Leader Shift+C on any line of the block shows it again.
  await page.locator('.cm-line').nth(6).click();
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Shift+C');
  await expect.poll(() => linesWithConnectors(page)).toEqual([1, 2, 3, 4, 5, 6, 7]);
});
