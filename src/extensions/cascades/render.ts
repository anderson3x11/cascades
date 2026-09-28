import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  layer,
  type DecorationSet,
  type LayerMarker,
  type ViewUpdate,
} from '@codemirror/view';
import { foldService, foldedRanges, syntaxTree } from '@codemirror/language';
import {
  buildCascades,
  cascadeEnd,
  cascadeGlyphs,
  cascadeWindow,
  type CascadeNode,
  type Glyph,
  type SourceLine,
} from './tree';

export type CascadeStyle = 'arrow' | 'line' | 'dotted' | 'rounded';

export interface CascadeConfig {
  style: CascadeStyle;
  colorByDepth: boolean;
  highlight: boolean;
  /** Ignore Markdown lists and code blocks. */
  markdown: boolean;
}

/** How far above and below the viewport lines are read to complete cascades. */
const MAX_SCAN = 2000;
/** Number of per-depth colors defined by the theme (--cascade-1..N). */
const DEPTH_COLORS = 6;
const MARKDOWN_IGNORED = new Set(['BulletList', 'OrderedList', 'CodeBlock', 'FencedCode']);

// Hovered line --------------------------------------------------------------

const setHover = StateEffect.define<number | null>();

const hoverField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setHover)) value = effect.value;
    return tr.docChanged ? null : value;
  },
});

// Analysis --------------------------------------------------------------------

function ignoredLines(state: EditorState, fromLine: number, toLine: number): Set<number> {
  const ignored = new Set<number>();
  const { doc } = state;
  syntaxTree(state).iterate({
    from: doc.line(fromLine).from,
    to: doc.line(toLine).to,
    enter: (node) => {
      if (!MARKDOWN_IGNORED.has(node.name)) return;
      const last = doc.lineAt(node.to).number;
      for (let line = doc.lineAt(node.from).number; line <= last; line++) ignored.add(line);
      return false;
    },
  });
  return ignored;
}

interface Analysis {
  nodes: Map<number, CascadeNode>;
  rows: Map<number, Glyph[]>;
}

function analyze(view: EditorView, config: CascadeConfig): Analysis {
  const { state } = view;
  const { doc, tabSize } = state;
  const first = doc.lineAt(view.viewport.from).number;
  const last = doc.lineAt(view.viewport.to).number;
  const ignored = config.markdown
    ? ignoredLines(state, Math.max(1, first - MAX_SCAN), Math.min(doc.lines, last + MAX_SCAN))
    : null;
  const lineAt = (n: number): SourceLine => ({ text: doc.line(n).text, ignored: ignored?.has(n) });

  const window = cascadeWindow(lineAt, doc.lines, first, last, tabSize, MAX_SCAN);
  const lines: SourceLine[] = [];
  for (let n = window.from; n <= window.to; n++) lines.push(lineAt(n));
  const nodes = buildCascades(lines, tabSize, window.from);
  return { nodes, rows: cascadeGlyphs(nodes, first, last) };
}

class CascadeState {
  analysis: Analysis;
  /** Line whose branch is highlighted (hovered, else the cursor line). */
  active: number | null = null;
  activeParent: number | null = null;
  decorations: DecorationSet = Decoration.none;

  constructor(
    view: EditorView,
    private readonly config: CascadeConfig,
  ) {
    this.analysis = analyze(view, config);
    this.updateActive(view.state);
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.viewportChanged ||
      update.startState.tabSize !== update.state.tabSize ||
      syntaxTree(update.startState) !== syntaxTree(update.state)
    ) {
      this.analysis = analyze(update.view, this.config);
    }
    this.updateActive(update.state);
  }

  private updateActive(state: EditorState): void {
    if (!this.config.highlight) return;
    const hover = state.field(hoverField);
    this.active = hover ?? state.doc.lineAt(state.selection.main.head).number;
    this.activeParent = this.analysis.nodes.get(this.active)?.parent?.line ?? null;
    const builder = new RangeSetBuilder<Decoration>();
    if (this.activeParent !== null) {
      builder.add(
        state.doc.line(this.activeParent).from,
        state.doc.line(this.activeParent).from,
        Decoration.line({ class: 'cm-cascade-parent' }),
      );
    }
    this.decorations = builder.finish();
  }
}

// Drawing ---------------------------------------------------------------------

interface RowGeometry {
  /** Width of one character and height of the first visual line, in px. */
  cw: number;
  lh: number;
  /** Height of the whole row (more than lh when wrapped). */
  height: number;
}

function colorClass(glyph: Glyph, config: CascadeConfig): string {
  return config.colorByDepth ? `c${(glyph.depth % DEPTH_COLORS) + 1}` : 'c0';
}

/** SVG paths for one line's connectors. Pure, so markers can compare their output. */
export function drawRow(
  glyphs: readonly Glyph[],
  line: number,
  geometry: RowGeometry,
  config: CascadeConfig,
  activeLine: number | null,
  activeParent: number | null,
): string {
  const { cw, lh, height } = geometry;
  const cy = lh / 2;
  const f = (n: number) => Math.round(n * 10) / 10;
  const paths: string[] = [];
  const path = (d: string, glyph: Glyph, on: boolean) =>
    paths.push(`<path d="${d}" class="${colorClass(glyph, config)}${on ? ' on' : ''}"/>`);

  for (const g of glyphs) {
    const x = f(g.col * cw + cw / 2);
    const inActiveBranch = activeParent === g.parentLine && activeLine !== null;
    const beforeActive = inActiveBranch && line < (activeLine as number);
    const isActive = inActiveBranch && line === activeLine;

    if (g.kind === 'start') {
      path(`M${x} ${f(cy + lh * 0.32)}V${f(height)}`, g, beforeActive);
      continue;
    }
    if (g.kind === 'pass') {
      path(`M${x} 0V${f(height)}`, g, beforeActive);
      continue;
    }

    // tee or elbow: vertical part, then the branch to the child.
    const end = f(g.toCol * cw - cw * 0.3);
    const length = end - x;
    const r = config.style === 'rounded' ? f(Math.min(cw, cy * 0.8, length / 2)) : 0;
    if (g.kind === 'tee') {
      path(`M${x} 0V${f(cy)}`, g, isActive || beforeActive);
      path(`M${x} ${f(cy)}V${f(height)}`, g, beforeActive);
    }
    const corner = r > 0 ? `V${f(cy - r)}Q${x} ${f(cy)} ${f(x + r)} ${f(cy)}` : `V${f(cy)}`;
    const branch =
      g.kind === 'elbow'
        ? `M${x} 0${corner}H${end}`
        : `M${x} ${f(cy - r)}${r > 0 ? `Q${x} ${f(cy)} ${f(x + r)} ${f(cy)}` : ''}H${end}`;
    path(branch, g, isActive);

    if (config.style !== 'line' && length >= cw * 1.2) {
      const a = f(Math.min(cw * 0.3, 4));
      path(`M${f(end - a)} ${f(cy - a)}L${end} ${f(cy)}L${f(end - a)} ${f(cy + a)}`, g, isActive);
    }
  }
  const width = f((Math.max(...glyphs.map((g) => g.toCol)) + 1) * cw);
  const cls = config.style === 'dotted' ? ' class="dotted"' : '';
  return `<svg width="${width}" height="${f(height)}"${cls}>${paths.join('')}</svg>`;
}

class RowMarker implements LayerMarker {
  constructor(
    readonly left: number,
    readonly top: number,
    readonly svg: string,
  ) {}

  eq(other: LayerMarker): boolean {
    return (
      other instanceof RowMarker &&
      other.left === this.left &&
      other.top === this.top &&
      other.svg === this.svg
    );
  }

  draw(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'cm-cascade-row';
    this.place(dom);
    return dom;
  }

  update(dom: HTMLElement): boolean {
    this.place(dom);
    return true;
  }

  private place(dom: HTMLElement): void {
    dom.style.left = `${this.left}px`;
    dom.style.top = `${this.top}px`;
    dom.innerHTML = this.svg;
  }
}

/** Origin of layer coordinates, as in CodeMirror's own layers (left-to-right text). */
function layerBase(view: EditorView): { left: number; top: number } {
  const rect = view.scrollDOM.getBoundingClientRect();
  return {
    left: rect.left - view.scrollDOM.scrollLeft * view.scaleX,
    top: rect.top - view.scrollDOM.scrollTop * view.scaleY,
  };
}

// Extension -------------------------------------------------------------------

const theme = EditorView.theme({
  '.cm-cascade-layer': { pointerEvents: 'none' },
  '.cm-cascade-row': { position: 'absolute' },
  '.cm-cascade-row svg': { display: 'block', overflow: 'visible' },
  '.cm-cascade-row path': {
    fill: 'none',
    strokeWidth: '1.2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  '.cm-cascade-row svg.dotted path': { strokeDasharray: '0.5 3.5' },
  '.cm-cascade-row path.c0': { stroke: 'var(--cascade)' },
  ...Object.fromEntries(
    Array.from({ length: DEPTH_COLORS }, (_, i) => [
      `.cm-cascade-row path.c${i + 1}`,
      { stroke: `var(--cascade-${i + 1})` },
    ]),
  ),
  '.cm-cascade-row path.on': { stroke: 'var(--cascade-active)', strokeWidth: '1.8' },
  '.cm-cascade-parent': { backgroundColor: 'var(--cascade-parent-bg)' },
});

export function cascades(config: CascadeConfig): Extension {
  const plugin = ViewPlugin.define((view) => new CascadeState(view, config), {
    decorations: (v) => v.decorations,
    eventHandlers: config.highlight
      ? {
          mousemove(event, view) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            const line = pos === null ? null : view.state.doc.lineAt(pos).number;
            if (line !== view.state.field(hoverField)) {
              view.dispatch({ effects: setHover.of(line) });
            }
          },
          mouseleave(_event, view) {
            if (view.state.field(hoverField) !== null) {
              view.dispatch({ effects: setHover.of(null) });
            }
          },
        }
      : {},
  });

  const connectors = layer({
    above: false,
    class: 'cm-cascade-layer',
    update: (update) =>
      update.docChanged ||
      update.viewportChanged ||
      update.geometryChanged ||
      update.selectionSet ||
      update.startState.field(hoverField) !== update.state.field(hoverField) ||
      syntaxTree(update.startState) !== syntaxTree(update.state),
    markers(view) {
      const state = view.plugin(plugin);
      if (!state) return [];
      const { doc } = view.state;
      const folded = foldedRanges(view.state);
      const base = layerBase(view);
      const cw = view.defaultCharacterWidth;
      const lh = view.defaultLineHeight;
      const markers: RowMarker[] = [];

      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
          const line = doc.lineAt(pos);
          pos = line.to + 1;
          let glyphs = state.analysis.rows.get(line.number);
          if (!glyphs) continue;
          // Lines hidden inside a fold get nothing, and a folded parent has no
          // visible children to point at.
          let hidden = false;
          let isFolded = false;
          folded.between(line.from, line.to, (a, b) => {
            if (a < line.from && b >= line.from) hidden = true;
            if (a === line.to) isFolded = true;
          });
          if (hidden) continue;
          if (isFolded) glyphs = glyphs.filter((g) => g.kind !== 'start');
          if (glyphs.length === 0) continue;

          const start = view.coordsAtPos(line.from, 1);
          if (!start) continue;
          const block = view.lineBlockAt(line.from);
          const svg = drawRow(
            glyphs,
            line.number,
            { cw, lh, height: block.height },
            config,
            state.active,
            state.activeParent,
          );
          markers.push(
            new RowMarker(start.left - base.left, view.documentTop + block.top - base.top, svg),
          );
        }
      }
      return markers;
    },
  });

  const fold = foldService.of((state, lineStart) => {
    const { doc } = state;
    const line = doc.lineAt(lineStart);
    const end = cascadeEnd(
      (n) => ({ text: doc.line(n).text }),
      doc.lines,
      line.number,
      state.tabSize,
    );
    return end === null ? null : { from: line.to, to: doc.line(end).to };
  });

  return [hoverField, plugin, connectors, fold, theme];
}
