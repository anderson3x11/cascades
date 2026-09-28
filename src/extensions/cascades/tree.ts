/**
 * Cascade structure of indented notes. Pure functions over line texts, so
 * the rendering and folding code only deal with positions.
 *
 * Parent of a line: the closest non-blank line above it with a strictly
 * smaller indentation. Blank lines and ignored lines (Markdown lists, code
 * blocks) are transparent: they neither break a cascade nor take part in it.
 */

export interface SourceLine {
  text: string;
  ignored?: boolean;
}

export interface CascadeNode {
  line: number;
  /** Indentation width in columns (tabs expanded). */
  indent: number;
  parent: CascadeNode | null;
  depth: number;
  children: CascadeNode[];
}

/** Indentation width in columns, or null for a blank line. */
export function indentColumns(text: string, tabSize: number): number | null {
  let col = 0;
  for (const ch of text) {
    if (ch === ' ') col++;
    else if (ch === '\t') col += tabSize - (col % tabSize);
    else return col;
  }
  return null;
}

/**
 * Builds the cascade nodes of `lines`, numbered from `firstLine`. Lines
 * before `firstLine` are not seen, so callers start at an unindented line
 * (see `cascadeWindow`).
 */
export function buildCascades(
  lines: readonly SourceLine[],
  tabSize: number,
  firstLine = 1,
): Map<number, CascadeNode> {
  const nodes = new Map<number, CascadeNode>();
  const stack: CascadeNode[] = [];
  lines.forEach((source, i) => {
    if (source.ignored) return;
    const indent = indentColumns(source.text, tabSize);
    if (indent === null) return;
    while (stack.length > 0 && (stack[stack.length - 1] as CascadeNode).indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1] ?? null;
    const node: CascadeNode = {
      line: firstLine + i,
      indent,
      parent,
      depth: parent ? parent.depth + 1 : 0,
      children: [],
    };
    parent?.children.push(node);
    stack.push(node);
    nodes.set(node.line, node);
  });
  return nodes;
}

export type GlyphKind =
  /** Vertical line starting under the parent's first character. */
  | 'start'
  /** Vertical line crossing the whole row. */
  | 'pass'
  /** Branch to a child that has siblings below: ├──> */
  | 'tee'
  /** Branch to the last child: └──> */
  | 'elbow';

export interface Glyph {
  kind: GlyphKind;
  /** Column of the parent's first character, where the vertical line runs. */
  col: number;
  /** For tee and elbow: column where the child's text starts. */
  toCol: number;
  /** Depth of the parent, used for per-level colors. */
  depth: number;
  /** Line of the parent. */
  parentLine: number;
}

/** Connector pieces to draw on each line between `from` and `to` (inclusive). */
export function cascadeGlyphs(
  nodes: Map<number, CascadeNode>,
  from: number,
  to: number,
): Map<number, Glyph[]> {
  const rows = new Map<number, Glyph[]>();
  const add = (line: number, glyph: Glyph) => {
    if (line < from || line > to) return;
    let row = rows.get(line);
    if (!row) rows.set(line, (row = []));
    row.push(glyph);
  };

  for (const parent of nodes.values()) {
    const last = parent.children[parent.children.length - 1];
    if (!last || last.line < from || parent.line > to) continue;
    const base = {
      col: parent.indent,
      toCol: parent.indent,
      depth: parent.depth,
      parentLine: parent.line,
    };
    add(parent.line, { ...base, kind: 'start' });
    const children = new Map(parent.children.map((c) => [c.line, c]));
    for (let line = Math.max(parent.line + 1, from); line <= Math.min(last.line, to); line++) {
      const child = children.get(line);
      if (!child) add(line, { ...base, kind: 'pass' });
      else add(line, { ...base, kind: child === last ? 'elbow' : 'tee', toCol: child.indent });
    }
  }
  return rows;
}

/**
 * Lines to analyze so that the cascades of lines `from`..`to` are complete:
 * back to an unindented line (no parent can be above it) and forward to the
 * next one (every vertical line ends before it). Scans at most `maxScan`
 * lines in each direction.
 */
export function cascadeWindow(
  lineAt: (line: number) => SourceLine,
  lineCount: number,
  from: number,
  to: number,
  tabSize: number,
  maxScan = 2000,
): { from: number; to: number } {
  const isRoot = (line: number) => {
    const source = lineAt(line);
    return !source.ignored && indentColumns(source.text, tabSize) === 0;
  };
  let start = from;
  while (start > 1 && from - start < maxScan && !isRoot(start)) start--;
  let end = to;
  while (end < lineCount && end - to < maxScan && !isRoot(end + 1)) end++;
  return { from: start, to: Math.min(end + 1, lineCount) };
}

/**
 * Last line of the cascade under `line` (its deepest last descendant), or
 * null if it has no children. Only looks forward, so it suits folding.
 */
export function cascadeEnd(
  lineAt: (line: number) => SourceLine,
  lineCount: number,
  line: number,
  tabSize: number,
): number | null {
  const own = lineAt(line);
  const indent = own.ignored ? null : indentColumns(own.text, tabSize);
  if (indent === null) return null;
  let end: number | null = null;
  for (let next = line + 1; next <= lineCount; next++) {
    const source = lineAt(next);
    if (source.ignored) continue;
    const col = indentColumns(source.text, tabSize);
    if (col === null) continue;
    if (col <= indent) break;
    end = next;
  }
  return end;
}
