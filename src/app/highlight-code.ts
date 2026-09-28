import { LanguageDescription, type Language } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { highlightCode as lezerHighlight } from '@lezer/highlight';
import { highlight } from './editor-theme';

const loaded = new Map<string, Promise<Language | null>>();

function loadLanguage(name: string): Promise<Language | null> {
  const key = name.toLowerCase();
  let language = loaded.get(key);
  if (!language) {
    const description = LanguageDescription.matchLanguageName(languages, key, true);
    language = description
      ? description.load().then((support) => support.language)
      : Promise.resolve(null);
    loaded.set(key, language);
  }
  return language;
}

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

/** Colored HTML for `code`, with the editor's highlight classes (so the theme applies). */
export async function highlightCode(code: string, language: string): Promise<string | null> {
  const lang = await loadLanguage(language).catch(() => null);
  if (!lang) return null;
  let html = '';
  lezerHighlight(
    code,
    lang.parser.parse(code),
    highlight,
    (text, classes) => {
      html += classes ? `<span class="${classes}">${escape(text)}</span>` : escape(text);
    },
    () => {
      html += '\n';
    },
  );
  return html;
}
