import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

const status = (page: Page) => page.getByRole('contentinfo');
const active = (page: Page) =>
  page.evaluate(() => {
    const tab = (window as unknown as DevWindow).__cascades.workspace.active();
    return (
      tab && { encoding: tab.encoding, bom: tab.bom, lineEnding: tab.lineEnding, dirty: tab.dirty }
    );
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/notes/été.txt', 'Café');
    return w.__cascades.commands.execute('file.openPath', 'C:/notes/été.txt');
  });
});

test('a click on LF converts the line endings and saves', async ({ page }) => {
  await status(page).getByText('LF', { exact: true }).click();
  await page.getByRole('option', { name: /CRLF/ }).click();
  await expect(status(page)).toContainText('CRLF');
  expect(await active(page)).toMatchObject({ lineEnding: 'crlf', dirty: false });
});

test('a click on the encoding saves with another one, or reopens with it', async ({ page }) => {
  await status(page).getByText('UTF-8', { exact: true }).click();
  await page.getByRole('option', { name: /Enregistrer avec un autre encodage/ }).click();
  await page.getByRole('option', { name: /Windows-1252/ }).click();
  await expect(status(page)).toContainText('WINDOWS-1252');

  await status(page).getByText('WINDOWS-1252').click();
  await page.getByRole('option', { name: /Rouvrir avec un autre encodage/ }).click();
  await page.getByRole('option', { name: 'UTF-8 avec BOM' }).click();
  expect(await active(page)).toMatchObject({ encoding: 'utf-8', dirty: false });
});
