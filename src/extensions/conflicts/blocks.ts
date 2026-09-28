/**
 * Git-style conflict blocks in a text:
 *   <<<<<<< ma version
 *   (my lines)
 *   ||||||| base          (optional, diff3 style)
 *   (base lines)
 *   =======
 *   (their lines)
 *   >>>>>>> version du disque
 */

export interface ConflictBlock {
  /** 1-based line numbers of the markers. */
  start: number;
  /** Line of "|||||||", or null. */
  base: number | null;
  separator: number;
  end: number;
}

export type Choice = 'mine' | 'theirs' | 'both';

const isMarker = (line: string, char: string) =>
  line.startsWith(char.repeat(7)) && (line.length === 7 || line[7] === ' ');

export function findConflicts(lines: readonly string[]): ConflictBlock[] {
  const blocks: ConflictBlock[] = [];
  let open: { start: number; base: number | null; separator: number | null } | null = null;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (isMarker(line, '<')) {
      open = { start: n, base: null, separator: null };
    } else if (!open) {
      return;
    } else if (isMarker(line, '|') && open.separator === null) {
      open.base = n;
    } else if (line === '=======' && open.separator === null) {
      open.separator = n;
    } else if (isMarker(line, '>') && open.separator !== null) {
      blocks.push({ start: open.start, base: open.base, separator: open.separator, end: n });
      open = null;
    }
  });
  return blocks;
}

/** Lines replacing a conflict block, `lines` being the whole document. */
export function resolve(lines: readonly string[], block: ConflictBlock, choice: Choice): string[] {
  const mine = lines.slice(block.start, (block.base ?? block.separator) - 1);
  const theirs = lines.slice(block.separator, block.end - 1);
  if (choice === 'mine') return mine;
  if (choice === 'theirs') return theirs;
  return [...mine, ...theirs];
}
