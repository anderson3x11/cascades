import type { ViewerFactory, ViewerInput } from '../../api';
import { dirname, isAbsolute, resolvePath } from './paths';
import './viewers.css';

export interface HtmlHelpers {
  /** URL of a local file the page may load. */
  fileUrl(path: string): Promise<string>;
  /** Whether the previewed page may run its scripts. */
  scriptsAllowed(): boolean;
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
 */
async function withLocalResources(
  html: string,
  path: string,
  fileUrl: (path: string) => Promise<string>,
): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const dir = dirname(path);
  for (const [selector, attribute] of RESOURCES) {
    for (const el of doc.querySelectorAll(selector)) {
      const ref = el.getAttribute(attribute) ?? '';
      if (!ref || ref.startsWith('#') || isAbsolute(ref)) continue;
      const url = await fileUrl(resolvePath(dir, ref)).catch(() => null);
      if (url) el.setAttribute(attribute, url);
    }
  }
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : '';
  return doctype + doc.documentElement.outerHTML;
}

/**
 * HTML preview in a sandboxed iframe: never same-origin with the app, so the
 * page can reach neither the editor nor the Tauri APIs. Scripts only run when
 * the setting allows them.
 */
export function createHtmlViewer(helpers: HtmlHelpers): ViewerFactory {
  return {
    create(host: HTMLElement, input: ViewerInput) {
      const frame = document.createElement('iframe');
      frame.className = 'cv-html';
      frame.title = 'Aperçu HTML';
      host.append(frame);
      let run = 0;

      const render = async (next: ViewerInput) => {
        const current = ++run;
        const html = next.path
          ? await withLocalResources(next.text, next.path, helpers.fileUrl)
          : next.text;
        if (current !== run) return;
        frame.setAttribute('sandbox', helpers.scriptsAllowed() ? 'allow-scripts' : '');
        frame.srcdoc = html;
      };

      void render(input);
      return {
        update: (next) => void render(next),
        dispose() {
          run++;
          frame.remove();
        },
      };
    },
  };
}
