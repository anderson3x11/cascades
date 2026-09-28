import { describe, expect, it } from 'vitest';
import { drawRow, type CascadeConfig, type CascadeStyle } from './render';
import type { Glyph } from './tree';

const geometry = { cw: 8, lh: 20, height: 20 };
const elbow: Glyph = { kind: 'elbow', col: 0, toCol: 4, depth: 0, parentLine: 1 };
const config = (style: CascadeStyle): CascadeConfig => ({
  style,
  lineWidth: 1.2,
  colorByDepth: true,
  highlight: true,
  markdown: false,
  ignoreLists: false,
  hiddenBlocks: new Set(),
});
const draw = (style: CascadeStyle) => drawRow([elbow], 2, geometry, config(style), null, null);

describe('drawRow styles', () => {
  it('draws a right-angle branch with an arrowhead by default', () => {
    const svg = draw('arrow');
    expect(svg).toContain('d="M4 0V10H29.6"');
    expect(svg).toContain('L29.6 10L');
  });

  it('draws only the vertical guide for "guides"', () => {
    expect(draw('guides')).toBe(
      '<svg width="40" height="20" style="--cascade-width:1.2"><path d="M4 0V20" class="c1"/></svg>',
    );
  });

  it('uses a curve, a rounded corner or a bullet', () => {
    expect(draw('curved')).toMatch(/V2C4 10 /);
    expect(draw('rounded')).toContain('Q4 10 ');
    expect(draw('bullet')).toContain('class="dot c1"');
    expect(draw('bullet')).not.toContain('L29.6 10L');
  });

  it('has no arrowhead for "line" and dashes for "dashed"', () => {
    expect(draw('line')).not.toContain('L29.6 10L');
    expect(draw('dashed')).toContain('class="dashed"');
  });

  it('carries the line width', () => {
    const svg = drawRow([elbow], 2, geometry, { ...config('arrow'), lineWidth: 2 }, null, null);
    expect(svg).toContain('--cascade-width:2');
  });
});
