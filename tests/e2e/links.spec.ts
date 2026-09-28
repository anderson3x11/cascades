import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

async function open(page: Page, path: string, text: string) {
  await page.evaluate(
    ({ path, text }) => (window as unknown as DevWindow).__cascades.workspace.open({ path, text }),
    { path, text },
  );
}

const text = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as DevWindow).__cascades.workspace.editorView()?.state.doc.toString(),
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Ctrl+click opens a web address in the browser', async ({ page, context }) => {
  // The site answers from here: the test needs no network.
  await context.route('https://exemple.fr/**', (route) => route.fulfill({ body: 'ok' }));
  await open(page, 'C:/notes/liens.txt', 'Site : https://exemple.fr/page.');
  const url = page.locator('.cm-url');
  await expect(url).toHaveText('https://exemple.fr/page');

  // Ctrl held over the link underlines it.
  await url.hover();
  await page.keyboard.down('Control');
  await page.mouse.move(0, 0);
  await url.hover();
  await expect(page.locator('.cm-ctrl-link')).toBeVisible();

  const popup = context.waitForEvent('page');
  await url.click({ modifiers: ['Control'] });
  await page.keyboard.up('Control');
  expect((await popup).url()).toBe('https://exemple.fr/page');
});

test('Ctrl+click on a Markdown link opens the file next to it', async ({ page }) => {
  await page.evaluate(() =>
    (window as unknown as DevWindow).__cascadesFs.addFile('C:/notes/jeux/elden.md', '# Elden'),
  );
  await open(page, 'C:/notes/index.md', 'Voir [le jeu](jeux/elden.md).');
  // Click on the link itself, wherever the text is drawn.
  const at = await page.evaluate(() => {
    const view = (window as unknown as DevWindow).__cascades.workspace.editorView();
    const pos = view?.state.doc.toString().indexOf('elden') ?? 0;
    const coords = view?.coordsAtPos(pos);
    return coords && { x: coords.left + 2, y: (coords.top + coords.bottom) / 2 };
  });
  if (!at) throw new Error('not laid out');
  await page.keyboard.down('Control');
  await page.mouse.click(at.x, at.y);
  await page.keyboard.up('Control');
  await expect(page.locator('.tabbar').getByRole('tab', { selected: true })).toContainText(
    'elden.md',
  );
  // And a plain click still just places the cursor.
});

test('pasting an address over selected Markdown text makes a link', async ({ page }) => {
  await open(page, 'C:/notes/a.md', 'lire la doc');
  await page.locator('.cm-content').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.locator('.cm-content').evaluate((content) => {
    const data = new DataTransfer();
    data.setData('text/plain', 'https://exemple.fr/doc');
    content.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  expect(await text(page)).toBe('lire la [doc](https://exemple.fr/doc)');
});
