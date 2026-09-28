import DOMPurify from 'dompurify';
import type { ViewerFactory, ViewerInput } from '../../api';
import { renderMarkdown } from './markdown-render';
import { dirname, isAbsolute, resolvePath } from './paths';
import './viewers.css';

export interface MarkdownHelpers {
  highlightCode(code: string, language: string): Promise<string | null>;
  fileUrl(path: string): Promise<string>;
  openExternal(url: string): Promise<void>;
  openFile(path: string): Promise<void>;
}

/** Highlighted code already computed, so re-renders while typing do not flicker. */
const highlighted = new Map<string, string>();
const MAX_CACHED = 200;

/** Line-to-element index for scroll sync: [line, element] sorted by line. */
function lineIndex(root: HTMLElement): [number, HTMLElement][] {
  return [...root.querySelectorAll<HTMLElement>('[data-line]')]
    .map((el): [number, HTMLElement] => [Number(el.dataset.line), el])
    .sort((a, b) => a[0] - b[0]);
}

export function createMarkdownViewer(helpers: MarkdownHelpers): ViewerFactory {
  return {
    create(host: HTMLElement, input: ViewerInput) {
      const root = document.createElement('article');
      root.className = 'cv-markdown';
      host.append(root);
      let current = input;
      let index: [number, HTMLElement][] = [];
      let generation = 0;

      const colorCode = async (run: number) => {
        for (const code of root.querySelectorAll<HTMLElement>('pre > code[class*="language-"]')) {
          const language = /language-([\w+#-]+)/.exec(code.className)?.[1];
          const text = code.textContent ?? '';
          if (!language) continue;
          const key = `${language}\n${text}`;
          let html = highlighted.get(key);
          if (html === undefined) {
            html = (await helpers.highlightCode(text, language)) ?? '';
            if (highlighted.size >= MAX_CACHED) highlighted.clear();
            highlighted.set(key, html);
          }
          if (run !== generation) return; // A newer render replaced these blocks.
          if (html) code.innerHTML = html;
        }
      };

      const loadImages = async (run: number) => {
        const dir = current.path ? dirname(current.path) : null;
        for (const img of root.querySelectorAll<HTMLImageElement>('img[data-src]')) {
          const src = img.dataset.src ?? '';
          if (!dir) continue;
          const url = await helpers.fileUrl(resolvePath(dir, src)).catch(() => null);
          if (run !== generation) return;
          if (url) img.src = url;
        }
      };

      const render = (next: ViewerInput) => {
        current = next;
        const run = ++generation;
        const html = DOMPurify.sanitize(renderMarkdown(next.text), {
          FORBID_TAGS: ['style', 'form'],
          ADD_ATTR: ['data-line'],
        });
        const scroll = host.scrollTop;
        root.innerHTML = html;
        host.scrollTop = scroll;
        // Local images are loaded through the app, once their folder is allowed.
        for (const img of root.querySelectorAll('img')) {
          const src = img.getAttribute('src') ?? '';
          if (src && !isAbsolute(src)) {
            img.dataset.src = src;
            img.removeAttribute('src');
          }
        }
        index = lineIndex(root);
        // Code from a cache is colored right away, the rest when its language is loaded.
        for (const code of root.querySelectorAll<HTMLElement>('pre > code[class*="language-"]')) {
          const language = /language-([\w+#-]+)/.exec(code.className)?.[1];
          const cached = language && highlighted.get(`${language}\n${code.textContent ?? ''}`);
          if (cached) code.innerHTML = cached;
        }
        void colorCode(run);
        void loadImages(run);
      };

      // Links never navigate the app: web links open in the browser, other files in a tab.
      const onClick = (event: MouseEvent) => {
        const link = (event.target as HTMLElement).closest('a');
        if (!link) return;
        event.preventDefault();
        const href = link.getAttribute('href') ?? '';
        if (href.startsWith('#')) {
          root
            .querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`)
            ?.scrollIntoView();
        } else if (/^(https?|mailto):/i.test(href)) {
          void helpers.openExternal(href);
        } else if (href && current.path) {
          void helpers.openFile(isAbsolute(href) ? href : resolvePath(dirname(current.path), href));
        }
      };
      root.addEventListener('click', onClick);

      render(input);
      return {
        update: render,
        scrollToLine(line: number) {
          // Between the blocks around `line`, proportionally, for smooth following.
          let before: [number, HTMLElement] | undefined;
          let after: [number, HTMLElement] | undefined;
          for (const entry of index) {
            if (entry[0] <= line) before = entry;
            else {
              after = entry;
              break;
            }
          }
          if (!before) {
            host.scrollTop = 0;
            return;
          }
          const top = (el: HTMLElement) =>
            el.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop;
          const from = top(before[1]);
          const to = after ? top(after[1]) : from + before[1].offsetHeight;
          const span = after ? after[0] - before[0] : 1;
          host.scrollTop = from + ((to - from) * Math.min(line - before[0], span)) / span - 8;
        },
        dispose() {
          generation++;
          root.removeEventListener('click', onClick);
          root.remove();
        },
      };
    },
  };
}
