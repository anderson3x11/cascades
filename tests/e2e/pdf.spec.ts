import { expect, test } from '@playwright/test';
import type { DevWindow } from './helpers';

/** A small valid PDF with one line of text per page. */
function makePdf(pages: string[]): string {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  const font = 3 + pages.length * 2;
  pages.forEach((text, i) => {
    const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  return `${out}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('a PDF opens in a tab, with its pages, text and zoom', async ({ page }) => {
  const pdf = makePdf(['Bonjour cascades', 'Page deux']);
  await page.evaluate((pdf) => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/docs/guide.pdf', pdf);
    return w.__cascades.commands.execute('file.openPath', 'C:/docs/guide.pdf');
  }, pdf);

  await expect(page.locator('.tabbar').getByRole('tab', { selected: true })).toContainText(
    'guide.pdf',
  );
  await expect(page.locator('.cv-pdf-page')).toHaveCount(2);
  await expect(page.locator('.cv-image-bar')).toContainText('Page 1 / 2');
  // The text can be selected and copied.
  await expect(page.locator('.cv-pdf-page').first().locator('.textLayer')).toContainText(
    'Bonjour cascades',
  );

  const level = page.locator('.cv-image-level');
  const fit = await level.textContent();
  await page.getByRole('button', { name: 'Agrandir' }).click();
  await expect(level).not.toHaveText(fit ?? '');
  await page.getByRole('button', { name: 'Ajuster à la largeur' }).click();
  await expect(level).toHaveText(fit ?? '');
});

test('a broken PDF says so', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as DevWindow;
    w.__cascadesFs.addFile('C:/docs/cassé.pdf', 'pas un pdf');
    return w.__cascades.commands.execute('file.openPath', 'C:/docs/cassé.pdf');
  });
  await expect(page.locator('.cv-pdf-error')).toContainText('PDF illisible');
});
