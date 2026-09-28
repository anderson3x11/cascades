import { describe, expect, it } from 'vitest';
import {
  buildCascades,
  cascadeEnd,
  cascadeGlyphs,
  cascadeWindow,
  indentColumns,
  type SourceLine,
} from './tree';

const src = (text: string): SourceLine[] => text.split('\n').map((t) => ({ text: t }));

const ELDEN = [
  'Elden Ring', //                    1
  '\tCombat exigeant', //             2
  '\t\tSurtout les boss du DLC', //   3
  '\t\tParades très satisfaisantes', // 4
  '\tDirection artistique folle', //  5
  'Hollow Knight', //                 6
  '\tAmbiance incroyable', //         7
].join('\n');

/** Renders glyphs as text, one row per line: "kind@col" joined by spaces. */
function sketch(text: string, tabSize = 4): string[] {
  const lines = src(text);
  const nodes = buildCascades(lines, tabSize);
  const rows = cascadeGlyphs(nodes, 1, lines.length);
  return lines.map((_, i) =>
    (rows.get(i + 1) ?? [])
      .sort((a, b) => a.col - b.col)
      .map((g) => `${g.kind}@${g.col}`)
      .join(' '),
  );
}

describe('indentColumns', () => {
  it('expands tabs to the next tab stop', () => {
    expect(indentColumns('\tx', 4)).toBe(4);
    expect(indentColumns('  \tx', 4)).toBe(4);
    expect(indentColumns('\t  x', 4)).toBe(6);
    expect(indentColumns('x', 4)).toBe(0);
  });

  it('returns null for blank lines', () => {
    expect(indentColumns('', 4)).toBeNull();
    expect(indentColumns(' \t ', 4)).toBeNull();
  });
});

describe('buildCascades', () => {
  it('finds parents in the brief example', () => {
    const nodes = buildCascades(src(ELDEN), 4);
    const parentOf = (line: number) => nodes.get(line)?.parent?.line ?? null;
    expect([1, 2, 3, 4, 5, 6, 7].map(parentOf)).toEqual([null, 1, 2, 2, 1, null, 6]);
    expect(nodes.get(3)?.depth).toBe(2);
  });

  it('takes the closest line with a strictly smaller indent', () => {
    const nodes = buildCascades(src('a\n        b\n    c\n      d'), 4);
    expect(nodes.get(4)?.parent?.line).toBe(3);
    expect(nodes.get(3)?.parent?.line).toBe(1);
  });

  it('lets blank lines through', () => {
    const nodes = buildCascades(src('a\n\n\tb\n   \n\tc'), 4);
    expect(nodes.get(3)?.parent?.line).toBe(1);
    expect(nodes.get(5)?.parent?.line).toBe(1);
    expect(nodes.has(2)).toBe(false);
  });

  it('mixes tabs and spaces by column', () => {
    const nodes = buildCascades(src('a\n    b\n\tc'), 4);
    expect(nodes.get(3)?.parent?.line).toBe(1);
  });

  it('skips ignored lines entirely', () => {
    const lines = src('a\n\t- item\n\tb');
    (lines[1] as SourceLine).ignored = true;
    const nodes = buildCascades(lines, 4);
    expect(nodes.has(2)).toBe(false);
    expect(nodes.get(3)?.parent?.line).toBe(1);
  });

  it('numbers lines from firstLine', () => {
    const nodes = buildCascades(src('a\n\tb'), 4, 10);
    expect(nodes.get(11)?.parent?.line).toBe(10);
  });
});

describe('cascadeGlyphs', () => {
  it('draws the brief example', () => {
    expect(sketch(ELDEN)).toEqual([
      'start@0',
      'tee@0 start@4',
      'pass@0 tee@4',
      'pass@0 elbow@4',
      'elbow@0',
      'start@0',
      'elbow@0',
    ]);
  });

  it('continues vertical lines across blank lines', () => {
    expect(sketch('a\n\tb\n\n\tc')).toEqual(['start@0', 'tee@0', 'pass@0', 'elbow@0']);
  });

  it('records the target column and parent', () => {
    const rows = cascadeGlyphs(buildCascades(src('a\n  b'), 4), 1, 2);
    expect(rows.get(2)).toEqual([{ kind: 'elbow', col: 0, toCol: 2, depth: 0, parentLine: 1 }]);
  });

  it('only returns rows inside the requested range', () => {
    const nodes = buildCascades(src(ELDEN), 4);
    const rows = cascadeGlyphs(nodes, 3, 4);
    expect([...rows.keys()].sort()).toEqual([3, 4]);
  });
});

describe('cascadeWindow', () => {
  const lines = src(ELDEN);
  const at = (n: number) => lines[n - 1] as SourceLine;

  it('extends back to an unindented line and forward to the next one', () => {
    expect(cascadeWindow(at, lines.length, 3, 4, 4)).toEqual({ from: 1, to: 6 });
  });

  it('stays in bounds', () => {
    expect(cascadeWindow(at, lines.length, 7, 7, 4)).toEqual({ from: 6, to: 7 });
  });

  it('gives up after maxScan lines', () => {
    const deep = src(['root', ...Array.from({ length: 50 }, () => '\tx')].join('\n'));
    const w = cascadeWindow((n) => deep[n - 1] as SourceLine, deep.length, 40, 40, 4, 10);
    expect(w.from).toBe(30);
  });
});

describe('cascadeEnd', () => {
  it('returns the deepest last descendant', () => {
    const nodes = buildCascades(src(ELDEN), 4);
    expect(cascadeEnd(nodes.get(1)!)).toBe(5);
    expect(cascadeEnd(nodes.get(2)!)).toBe(4);
    expect(cascadeEnd(nodes.get(3)!)).toBeNull();
  });
});
