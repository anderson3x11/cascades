import type { ViewerFactory, ViewerInput } from '../../api';
import { dirname, isAbsolute, resolvePath } from './paths';
import './viewers.css';
import { t } from '../../api';

export interface HtmlHelpers {
  /** URL of a local file the page may load. */
  fileUrl(path: string): Promise<string>;
  /** Whether the previewed page may run its scripts. */
  scriptsAllowed(): boolean;
  openExternal(url: string): Promise<void>;
  openFile(path: string): Promise<void>;
  /** Calls `listener` when a file changes on disk. */
  watch(path: string, listener: () => void): { dispose(): void };
}

/** Attributes that load a resource and may be relative to the file. */
const RESOURCES: [selector: string, attribute: string][] = [
  ['img[src]', 'src'],
  ['source[src]', 'src'],
  ['script[src]', 'src'],
  ['link[href]', 'href'],
];

/**
 * Rewrites relative resources (images, stylesheets, scripts) to URLs the
 * app can serve, so the page looks as it does when opened from disk.
 * Returns the HTML and the local files it uses.
 */
async function withLocalResources(
  html: string,
  path: string,
  fileUrl: (path: string) => Promise<string>,
): Promise<{ html: string; files: string[] }> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const dir = dirname(path);
  const files: string[] = [];
  for (const [selector, attribute] of RESOURCES) {
    for (const el of doc.querySelectorAll(selector)) {
      const ref = el.getAttribute(attribute) ?? '';
      if (!ref || ref.startsWith('#') || isAbsolute(ref)) continue;
      const file = resolvePath(dir, ref);
      const url = await fileUrl(file).catch(() => null);
      if (!url) continue;
      el.setAttribute(attribute, url);
      files.push(file);
    }
  }
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : '';
  return { html: doctype + doc.documentElement.outerHTML, files };
}

/**
 * HTML preview in a sandboxed iframe that can reach neither the editor nor the
 * Tauri APIs.
 * - Scripts blocked (default): no code can run in the page, so it may share
 *   the app's origin; that lets local stylesheets and images load, and lets
 *   the app handle clicks on links.
 * - Scripts allowed: the page runs in an opaque origin, fully isolated.
 */
export function createHtmlViewer(helpers: HtmlHelpers): ViewerFactory {
  return {
    create(host: HTMLElement, input: ViewerInput) {
      const frame = document.createElement('iframe');
      frame.className = 'cv-html';
      frame.title = t('HTML preview');
      host.append(frame);
      let run = 0;
      let current = input;
      let scroll = { x: 0, y: 0 };
      let watched = new Map<string, { dispose(): void }>();
      let refresh: ReturnType<typeof setTimeout> | undefined;

      /** Links never navigate the preview away: the app decides what they do. */
      const onClick = (event: MouseEvent) => {
        const doc = frame.contentDocument;
        const link = (event.target as Element | null)?.closest?.('a[href]');
        if (!doc || !link) return;
        event.preventDefault();
        const href = link.getAttribute('href') ?? '';
        if (href.startsWith('#')) {
          const id = decodeURIComponent(href.slice(1));
          (doc.getElementById(id) ?? doc.getElementsByName(id)[0])?.scrollIntoView({
            behavior: 'smooth',
          });
        } else if (/^(https?|mailto):/i.test(href)) {
          void helpers.openExternal(href);
        } else if (current.path && !isAbsolute(href)) {
          void helpers.openFile(resolvePath(dirname(current.path), href));
        }
      };

      frame.addEventListener('load', () => {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        if (!win || !doc) return; // Opaque origin (scripts allowed): nothing to do.
        doc.addEventListener('click', onClick);
        win.scrollTo(scroll.x, scroll.y);
      });

      /** Re-renders when a stylesheet or image of the page changes on disk. */
      const watchFiles = (files: string[]) => {
        const next = new Map<string, { dispose(): void }>();
        for (const file of files) {
          next.set(
            file,
            watched.get(file) ??
              helpers.watch(file, () => {
                clearTimeout(refresh);
                refresh = setTimeout(() => void render(current), 150);
              }),
          );
        }
        for (const [file, watch] of watched) if (!next.has(file)) watch.dispose();
        watched = next;
      };

      const render = async (next: ViewerInput) => {
        current = next;
        const id = ++run;
        const { html, files } = next.path
          ? await withLocalResources(next.text, next.path, helpers.fileUrl)
          : { html: next.text, files: [] };
        if (id !== run) return;
        watchFiles(files);
        // Keep the reader's place across updates (readable only when same-origin).
        const win = frame.contentWindow;
        try {
          if (win) scroll = { x: win.scrollX, y: win.scrollY };
        } catch {
          scroll = { x: 0, y: 0 };
        }
        frame.setAttribute(
          'sandbox',
          helpers.scriptsAllowed() ? 'allow-scripts' : 'allow-same-origin',
        );
        frame.srcdoc = html;
      };

      void render(input);
      return {
        update: (next) => void render(next),
        dispose() {
          run++;
          clearTimeout(refresh);
          for (const watch of watched.values()) watch.dispose();
          frame.remove();
        },
      };
    },
  };
}
