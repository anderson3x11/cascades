import { test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Reference } from '../../src/app/reference';

const AGENTS = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36',
  macos: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
};

test('reference of commands and settings', async ({ browser }) => {
  const read = async (locale: string, userAgent: string) => {
    const page = await browser.newPage({ locale, userAgent });
    await page.goto('/');
    const reference = await page.evaluate(() =>
      (
        window as unknown as { __cascadesReference: () => Promise<Reference> }
      ).__cascadesReference(),
    );
    await page.close();
    return reference;
  };

  const out: Record<string, unknown> = {
    version: (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
  };
  for (const [language, locale] of [
    ['en', 'en-US'],
    ['fr', 'fr-FR'],
  ] as const) {
    const pc = await read(locale, AGENTS.windows);
    const mac = await read(locale, AGENTS.macos);
    const macKeys = new Map(mac.commands.map((c) => [c.id, c.keys]));
    out[language] = {
      commands: pc.commands.map((c) => ({ ...c, keysMac: macKeys.get(c.id) ?? [] })),
      settings: pc.settings,
    };
  }
  writeFileSync('docs/reference.json', `${JSON.stringify(out, null, 2)}\n`);
});
