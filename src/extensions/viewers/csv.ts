/** CSV parsing (RFC 4180): quoted fields, doubled quotes, line breaks inside quotes. */

const CANDIDATES = [',', ';', '\t', '|'];

/** Number of `delimiter` characters outside quotes on each of the first lines. */
function counts(text: string, delimiter: string, maxLines = 10): number[] {
  const result: number[] = [];
  let count = 0;
  let quoted = false;
  for (let i = 0; i < text.length && result.length < maxLines; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === delimiter) count++;
    else if (!quoted && ch === '\n') {
      result.push(count);
      count = 0;
    }
  }
  if (count > 0 || result.length === 0) result.push(count);
  return result;
}

/**
 * Guesses the delimiter: the candidate found the same number of times on
 * every sampled line, most often. Defaults to a comma.
 */
export function detectDelimiter(text: string): string {
  let best = ',';
  let bestScore = 0;
  for (const delimiter of CANDIDATES) {
    const lines = counts(text, delimiter);
    const first = lines[0] ?? 0;
    if (first === 0 || !lines.every((c) => c === first)) continue;
    if (first > bestScore) {
      best = delimiter;
      bestScore = first;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
