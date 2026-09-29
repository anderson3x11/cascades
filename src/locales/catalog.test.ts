import { describe, expect, it } from 'vitest';
import fr from './fr.json';

/**
 * The interface is written in English in the code; each language has a
 * catalog of translations. These tests keep the catalogs and the code in step.
 */
const sources = Object.entries(
  import.meta.glob<string>(['/src/**/*.ts', '/src/**/*.svelte', '!/src/**/*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

/** First argument of every t('…') call, when it is a plain string. */
function translatedTexts(): Map<string, string> {
  const found = new Map<string, string>();
  const call = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const [file, source] of sources) {
    for (const match of source.matchAll(call)) {
      const text = (match[2] ?? '').replace(/\\(['"\\])/g, '$1');
      found.set(text, file);
    }
  }
  return found;
}

describe('French catalog', () => {
  const catalog = fr as Record<string, string>;

  it('translates every text of the interface', () => {
    const missing = [...translatedTexts()]
      .filter(([text]) => !(text in catalog))
      .map(([text, file]) => `${file}: ${text}`);
    expect(missing).toEqual([]);
  });

  it('has no translation the code no longer uses', () => {
    const all = sources.map(([, source]) => source).join('\n');
    const unused = Object.keys(catalog).filter(
      (text) =>
        !all.includes(`'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`) &&
        !all.includes(`"${text.replace(/"/g, '\\"')}"`),
    );
    expect(unused).toEqual([]);
  });

  it('keeps the placeholders of the English text', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const wrong = Object.entries(catalog).filter(
      ([en, text]) => names(en).join() !== names(text).join(),
    );
    expect(wrong).toEqual([]);
  });
});

describe('code', () => {
  it('has no French text left outside the catalogs', () => {
    // Accented letters in a string are the telltale sign of untranslated text.
    const literal = /(['"`])((?:\\.|(?!\1)[^\\\n])*[éèêàâùûçôî](?:\\.|(?!\1)[^\\\n])*)\1/gi;
    const markup = />([^<>{}]*[éèêàâùûçôî][^<>{}]*)</gi;
    // French phrases of CodeMirror, and the words of the fake spell checker.
    const allowed = ['/src/app/editor-phrases.ts', '/src/platform/spell.ts'];
    const left: string[] = [];
    for (const [file, source] of sources) {
      if (allowed.includes(file)) continue;
      // Comments may stay in any language.
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$|<!--[\s\S]*?-->/gm, '');
      for (const m of code.matchAll(literal)) left.push(`${file}: ${m[2]}`);
      if (file.endsWith('.svelte')) {
        for (const m of code.matchAll(markup)) left.push(`${file}: ${m[1]?.trim()}`);
      }
    }
    expect(left).toEqual([]);
  });
});
