/**
 * `when` clauses, VS Code style:
 *   editorFocus && !previewOpen
 *   vim.mode == 'normal' || vim.mode == 'visual'
 *   (a || b) && c != 3
 */
import { t } from '../i18n/i18n';

export type ContextValue = string | number | boolean | undefined;
export type ContextLookup = (key: string) => ContextValue;
export type WhenExpr = (lookup: ContextLookup) => boolean;

type Token =
  | { kind: 'ident'; value: string }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'op'; value: '&&' | '||' | '!' | '==' | '!=' | '(' | ')' };

const OPS = ['&&', '||', '==', '!=', '!', '(', ')'] as const;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const op = OPS.find((o) => source.startsWith(o, i));
    if (op) {
      tokens.push({ kind: 'op', value: op });
      i += op.length;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = source.indexOf(ch, i + 1);
      if (end === -1)
        throw new Error(t('missing closing quote in "{condition}"', { condition: source }));
      tokens.push({ kind: 'literal', value: source.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const match = /^[\w.:-]+/.exec(source.slice(i));
    if (!match)
      throw new Error(
        t('unexpected "{character}" in "{condition}"', { character: ch, condition: source }),
      );
    const word = match[0];
    if (word === 'true' || word === 'false') {
      tokens.push({ kind: 'literal', value: word === 'true' });
    } else if (/^-?\d+(\.\d+)?$/.test(word)) {
      tokens.push({ kind: 'literal', value: Number(word) });
    } else {
      tokens.push({ kind: 'ident', value: word });
    }
    i += word.length;
  }
  return tokens;
}

export function parseWhen(source: string): WhenExpr {
  const tokens = tokenize(source);
  let pos = 0;

  const peekOp = (value: string): boolean => {
    const t = tokens[pos];
    return t?.kind === 'op' && t.value === value;
  };

  const fail = (): never => {
    throw new Error(t('invalid condition: "{condition}"', { condition: source }));
  };

  // or := and ('||' and)*
  const parseOr = (): WhenExpr => {
    let left = parseAnd();
    while (peekOp('||')) {
      pos++;
      const l = left;
      const r = parseAnd();
      left = (ctx) => l(ctx) || r(ctx);
    }
    return left;
  };

  // and := unary ('&&' unary)*
  const parseAnd = (): WhenExpr => {
    let left = parseUnary();
    while (peekOp('&&')) {
      pos++;
      const l = left;
      const r = parseUnary();
      left = (ctx) => l(ctx) && r(ctx);
    }
    return left;
  };

  // unary := '!' unary | '(' or ')' | comparison
  const parseUnary = (): WhenExpr => {
    if (peekOp('!')) {
      pos++;
      const inner = parseUnary();
      return (ctx) => !inner(ctx);
    }
    if (peekOp('(')) {
      pos++;
      const inner = parseOr();
      if (!peekOp(')')) fail();
      pos++;
      return inner;
    }
    return parseComparison();
  };

  // comparison := ident (('==' | '!=') literal)?
  const parseComparison = (): WhenExpr => {
    const t = tokens[pos++];
    if (t?.kind === 'literal') {
      const value = Boolean(t.value);
      return () => value;
    }
    if (t?.kind !== 'ident') return fail();
    const key = t.value;
    if (peekOp('==') || peekOp('!=')) {
      const negate = peekOp('!=');
      pos++;
      const rhs = tokens[pos++];
      if (!rhs || rhs.kind === 'op') return fail();
      const expected = rhs.value;
      return (ctx) => (ctx(key) === expected) !== negate;
    }
    return (ctx) => Boolean(ctx(key));
  };

  const expr = parseOr();
  if (pos !== tokens.length) fail();
  return expr;
}
