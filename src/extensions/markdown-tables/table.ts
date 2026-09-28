/** Markdown (GFM) tables: finding them, aligning their columns, moving between cells. */

export type Align = 'none' | 'left' | 'center' | 'right';

export interface Table {
  /** Line numbers (0-based) of the first and last rows. */
  first: number;
  last: number;
  /** Cells of each row; row 1 is the delimiter row ("---"). */
  rows: string[][];
  aligns: Align[];
}

const DELIMITER_CELL = /^:?-+:?$/;

/** Cells of a row, split on "|" but not on "\|", without the outer pipes. */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (ch === '\\' && line[i + 1] === '|') {
      cell += '\\|';
      i++;
    } else if (ch === '|') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  const trimmed = line.trim();
  if (trimmed.startsWith('|')) cells.shift();
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) cells.pop();
  return cells.map((c) => c.trim());
}

const isRow = (line: string) => line.includes('|') && line.trim() !== '';
const isDelimiter = (line: string) => {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => DELIMITER_CELL.test(c));
};

/** The table the line is in, or null. */
export function findTable(lines: readonly string[], line: number): Table | null {
  if (!isRow(lines[line] ?? '')) return null;
  let first = line;
  let last = line;
  while (first > 0 && isRow(lines[first - 1] as string)) first--;
  while (last < lines.length - 1 && isRow(lines[last + 1] as string)) last++;
  // A table is a header row followed by a delimiter row.
  if (last - first < 1 || !isDelimiter(lines[first + 1] as string)) return null;
  const rows = lines.slice(first, last + 1).map(splitRow);
  const aligns = (rows[1] as string[]).map((cell): Align => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    return left && right ? 'center' : right ? 'right' : left ? 'left' : 'none';
  });
  return { first, last, rows, aligns };
}

/** Width of a cell as displayed: one per character. */
const width = (text: string) => [...text].length;

function pad(text: string, size: number, align: Align): string {
  const space = size - width(text);
  if (align === 'right') return ' '.repeat(space) + text;
  if (align === 'center') {
    const before = Math.floor(space / 2);
    return ' '.repeat(before) + text + ' '.repeat(space - before);
  }
  return text + ' '.repeat(space);
}

/** The rows written with every column as wide as its widest cell. */
export function formatTable(table: Table): string[] {
  const columns = Math.max(...table.rows.map((r) => r.length));
  const aligns = Array.from({ length: columns }, (_, c) => table.aligns[c] ?? 'none');
  const widths = aligns.map((_, c) =>
    Math.max(3, ...table.rows.map((row, r) => (r === 1 ? 0 : width(row[c] ?? '')))),
  );
  return table.rows.map((row, r) => {
    const cells = widths.map((w, c) => {
      if (r !== 1) return pad(row[c] ?? '', w, aligns[c] as Align);
      const align = aligns[c] as Align;
      const dashes = '-'.repeat(w - (align === 'center' ? 2 : align === 'none' ? 0 : 1));
      return align === 'center'
        ? `:${dashes}:`
        : align === 'left'
          ? `:${dashes}`
          : align === 'right'
            ? `${dashes}:`
            : dashes;
    });
    return `| ${cells.join(' | ')} |`;
  });
}

/** Index of the cell at `column` of a row written by formatTable (or by hand). */
export function cellAt(line: string, column: number): number {
  let cell = -1;
  const trimmedStart = line.length - line.trimStart().length;
  const leadingPipe = line.trimStart().startsWith('|');
  if (!leadingPipe) cell = 0;
  for (let i = trimmedStart; i < Math.min(column, line.length); i++) {
    if (line[i] === '\\' && line[i + 1] === '|') i++;
    else if (line[i] === '|') cell++;
  }
  return Math.max(cell, 0);
}

/** Range (in the line) of the text of cell `index` in a row written by formatTable. */
export function cellRange(line: string, index: number): { from: number; to: number } {
  let pipe = -1;
  let seen = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') {
      i++;
    } else if (line[i] === '|') {
      seen++;
      if (seen === index) pipe = i;
      if (seen === index + 1) {
        const inner = line.slice(pipe + 1, i);
        const start = pipe + 1 + (inner.length - inner.trimStart().length);
        const end = i - (inner.length - inner.trimEnd().length);
        return end > start
          ? { from: start, to: end }
          : { from: Math.min(pipe + 2, i), to: Math.min(pipe + 2, i) };
      }
    }
  }
  return { from: line.length, to: line.length };
}

export interface TableMove {
  /** New text of the table's lines. */
  lines: string[];
  /** Row (index in `lines`) and cell to select. */
  row: number;
  cell: number;
}

/**
 * The table aligned, and the cell to go to from (row, cell): the next one
 * (Tab) or the previous one (Shift+Tab). The delimiter row is skipped; going
 * past the last cell adds a row.
 */
export function moveInTable(table: Table, row: number, cell: number, direction: 1 | -1): TableMove {
  const columns = Math.max(...table.rows.map((r) => r.length));
  const rows = table.rows.map((r) => [...r]);
  let r = row;
  let c = cell + direction;
  if (c >= columns) {
    r++;
    c = 0;
  } else if (c < 0) {
    r--;
    c = columns - 1;
  }
  if (r === 1) r += direction;
  if (r < 0) {
    r = 0;
    c = 0;
  }
  if (r >= rows.length) rows.push(Array.from({ length: columns }, () => ''));
  return { lines: formatTable({ ...table, rows }), row: r, cell: c };
}
