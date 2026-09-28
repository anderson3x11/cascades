import { applyEdits, modify, parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import type { RawSettings } from './registry';

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' } };

/** French messages for the usual mistakes, by jsonc-parser error name. */
const ERROR_MESSAGES: Record<string, string> = {
  InvalidSymbol: 'caractère inattendu',
  ValueExpected: 'valeur attendue',
  PropertyNameExpected: 'nom entre guillemets attendu',
  ColonExpected: '« : » attendu',
  CommaExpected: 'virgule manquante',
  CloseBraceExpected: '« } » manquant',
  CloseBracketExpected: '« ] » manquant',
  EndOfFileExpected: 'texte en trop après la fin',
  UnexpectedEndOfString: 'guillemet fermant manquant',
  UnexpectedEndOfComment: 'commentaire /* non fermé',
};

/** Parses a JSON-with-comments file (settings.json, keybindings.json). Throws on errors. */
export function parseJsonc(text: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, { allowTrailingComma: true });
  const first = errors[0];
  if (first) {
    const line = text.slice(0, first.offset).split('\n').length;
    const name = printParseErrorCode(first.error);
    const message = ERROR_MESSAGES[name] ?? name;
    throw new Error(`${message} (ligne ${line})`);
  }
  return value;
}

/** settings.json content as an object. Empty or absent means no user settings. */
export function parseSettings(text: string | null): RawSettings {
  if (text === null || text.trim() === '') return {};
  const value = parseJsonc(text);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('le fichier doit contenir un objet { … }');
  }
  return value as RawSettings;
}

/**
 * Sets (or removes, with `undefined`) one setting in the text of settings.json,
 * globally or in its "[language]" block. Everything else, comments included,
 * is kept as written; an emptied language block is removed.
 */
export function editSettings(
  text: string | null,
  key: string,
  value: unknown,
  language?: string,
): string {
  let source = text && text.trim() !== '' ? text : '{}';
  const path = language ? [`[${language}]`, key] : [key];
  source = applyEdits(source, modify(source, path, value, FORMAT));
  if (language && value === undefined) {
    const block = (parseSettings(source)[`[${language}]`] ?? {}) as Record<string, unknown>;
    if (Object.keys(block).length === 0) {
      source = applyEdits(source, modify(source, [`[${language}]`], undefined, FORMAT));
    }
  }
  return source.endsWith('\n') ? source : `${source}\n`;
}
