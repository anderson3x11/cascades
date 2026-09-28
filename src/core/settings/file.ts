import {
  applyEdits,
  modify,
  parse,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
} from 'jsonc-parser';
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

/** A mistake in a config file, for the editor to underline. */
export interface ConfigProblem {
  from: number;
  to: number;
  severity: 'error' | 'warning';
  message: string;
}

const PARSE_OPTIONS = { allowTrailingComma: true };

function syntaxMessage(error: ParseError): string {
  const name = printParseErrorCode(error.error);
  return ERROR_MESSAGES[name] ?? name;
}

/** Parses a JSON-with-comments file (settings.json, keybindings.json). Throws on errors. */
export function parseJsonc(text: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, PARSE_OPTIONS);
  const first = errors[0];
  if (first) {
    const line = text.slice(0, first.offset).split('\n').length;
    throw new Error(`${syntaxMessage(first)} (ligne ${line})`);
  }
  return value;
}

/** Syntax errors of a JSON-with-comments text, and its tree (undefined when empty). */
export function parseJsoncTree(text: string): {
  tree: Node | undefined;
  problems: ConfigProblem[];
} {
  // A blank file means "nothing configured", as when loading.
  if (text.trim() === '') return { tree: undefined, problems: [] };
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, PARSE_OPTIONS);
  const problems = errors.map((error): ConfigProblem => ({
    from: error.offset,
    to: error.offset + Math.max(error.length, 1),
    severity: 'error',
    message: syntaxMessage(error),
  }));
  return { tree, problems };
}

/** A problem spanning a node of the tree. */
export function problemAt(
  node: Pick<Node, 'offset' | 'length'>,
  severity: ConfigProblem['severity'],
  message: string,
): ConfigProblem {
  return { from: node.offset, to: node.offset + node.length, severity, message };
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
