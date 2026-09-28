import type { ViewerFactory, ViewerInput } from '../../api';
import './viewers.css';

/** Levels open when a document is shown for the first time. */
const OPEN_DEPTH = 2;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function scalar(value: unknown): HTMLElement {
  if (value === null) return el('span', 'cv-null', 'null');
  if (typeof value === 'string') return el('span', 'cv-string', JSON.stringify(value));
  if (typeof value === 'number') return el('span', 'cv-number', String(value));
  return el('span', 'cv-bool', String(value));
}

/**
 * One node of the tree. Objects and arrays are <details> elements; `open`
 * holds the paths of the expanded ones, so re-rendering keeps them.
 */
function node(
  value: unknown,
  key: string | null,
  path: string,
  depth: number,
  open: Set<string> | null,
): HTMLElement {
  const label = (target: HTMLElement) => {
    if (key !== null) target.append(el('span', 'cv-key', key), ': ');
  };
  if (typeof value !== 'object' || value === null) {
    const line = el('div', 'cv-leaf');
    label(line);
    line.append(scalar(value));
    return line;
  }
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const details = el('details', 'cv-branch');
  details.dataset.path = path;
  details.open = open ? open.has(path) : depth < OPEN_DEPTH;
  const summary = el('summary');
  label(summary);
  const count = entries.length;
  summary.append(
    el(
      'span',
      'cv-meta',
      Array.isArray(value)
        ? `[ ${count} élément${count > 1 ? 's' : ''} ]`
        : `{ ${count} clé${count > 1 ? 's' : ''} }`,
    ),
  );
  details.append(summary);
  const children = el('div', 'cv-children');
  for (const [k, v] of entries) {
    children.append(
      node(v, Array.isArray(value) ? k : JSON.stringify(k), `${path}/${k}`, depth + 1, open),
    );
  }
  details.append(children);
  return details;
}

export const jsonViewer: ViewerFactory = {
  create(host: HTMLElement, input: ViewerInput) {
    const root = el('div', 'cv-json');
    host.append(root);
    let rendered = false;

    const render = ({ text }: ViewerInput) => {
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (err) {
        // Keep the last valid tree while the user is typing, with the error on top.
        root.querySelector('.cv-error')?.remove();
        const error = el(
          'p',
          'cv-error',
          `JSON invalide : ${err instanceof Error ? err.message : String(err)}`,
        );
        root.prepend(error);
        return;
      }
      const open = rendered
        ? new Set(
            [...root.querySelectorAll<HTMLDetailsElement>('details[open]')].map(
              (d) => d.dataset.path ?? '',
            ),
          )
        : null;
      root.replaceChildren(node(value, null, '', 0, open));
      rendered = true;
    };

    render(input);
    return {
      update: render,
      dispose: () => root.remove(),
    };
  },
};
