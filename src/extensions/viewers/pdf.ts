import {
  getDocument,
  GlobalWorkerOptions,
  PasswordException,
  TextLayer,
  type PDFDocumentLoadingTask,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ViewerFactory, ViewerInput } from '../../api';
import './pdf.css';
import './viewers.css';

GlobalWorkerOptions.workerSrc = workerSrc;

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/** Pages this far outside the view are drawn ahead of scrolling. */
const AHEAD = '600px';
/** Space around the pages, in CSS pixels. */
const GUTTER = 32;

interface Page {
  proxy: PDFPageProxy;
  box: HTMLElement;
  canvas: HTMLCanvasElement;
  text: HTMLElement;
  /** Scale it was drawn at, or null. */
  drawn: number | null;
  task: RenderTask | null;
  textLayer: TextLayer | null;
}

/** PDF viewer: pages drawn as they come into view, selectable text, zoom. */
export function createPdfViewer(read: (path: string) => Promise<Uint8Array>): ViewerFactory {
  return {
    create(host: HTMLElement, input: ViewerInput) {
      const root = document.createElement('div');
      root.className = 'cv-pdf';
      const stage = document.createElement('div');
      stage.className = 'cv-pdf-stage';
      const bar = document.createElement('div');
      bar.className = 'cv-image-bar';
      const info = document.createElement('span');
      const level = document.createElement('span');
      level.className = 'cv-image-level';
      const button = (label: string, title: string, run: () => void) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.onclick = run;
        return b;
      };
      bar.append(
        info,
        button('−', 'Réduire', () => zoom(-1)),
        level,
        button('+', 'Agrandir', () => zoom(1)),
        button('Ajuster', 'Ajuster à la largeur', () => setScale(null)),
      );
      root.append(stage, bar);
      host.append(root);

      /** Loading task of the open document, which also frees it. */
      let loading: PDFDocumentLoadingTask | null = null;
      let pages: Page[] = [];
      /** null = fit the width of the pane. */
      let chosen: number | null = null;
      let scale = 1;
      let path: string | null = null;
      let run = 0;

      const fitScale = () => {
        const first = pages[0]?.proxy.getViewport({ scale: 1 });
        if (!first) return 1;
        return Math.max(0.1, (stage.clientWidth - GUTTER) / first.width);
      };

      const showLevel = () => (level.textContent = `${Math.round(scale * 100)} %`);

      /** Updates the "Page 3 / 12" indicator from the page at the top of the view. */
      const showPage = () => {
        if (pages.length === 0) return;
        const top = stage.scrollTop + stage.clientHeight / 3;
        const index = pages.findIndex((p) => p.box.offsetTop + p.box.offsetHeight > top);
        info.textContent = `Page ${Math.max(index, 0) + 1} / ${pages.length}`;
      };

      const draw = async (page: Page) => {
        if (page.drawn === scale) return;
        page.task?.cancel();
        page.textLayer?.cancel();
        const drawnAt = scale;
        const viewport = page.proxy.getViewport({ scale: drawnAt });
        const ratio = window.devicePixelRatio || 1;
        page.canvas.width = Math.floor(viewport.width * ratio);
        page.canvas.height = Math.floor(viewport.height * ratio);
        page.drawn = drawnAt;
        page.task = page.proxy.render({
          canvas: page.canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        page.text.replaceChildren();
        page.textLayer = new TextLayer({
          textContentSource: page.proxy.streamTextContent(),
          container: page.text,
          viewport,
        });
        try {
          await Promise.all([page.task.promise, page.textLayer.render()]);
        } catch {
          // Cancelled by a zoom or a new file; drawn again when needed.
          if (page.drawn === drawnAt) page.drawn = null;
        }
      };

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const page = pages.find((p) => p.box === entry.target);
            if (entry.isIntersecting && page) void draw(page);
          }
        },
        { root: stage, rootMargin: AHEAD },
      );

      /** Sizes every page box for the scale; drawing follows as they are seen. */
      const layout = () => {
        for (const page of pages) {
          const viewport = page.proxy.getViewport({ scale });
          page.box.style.width = `${viewport.width}px`;
          page.box.style.height = `${viewport.height}px`;
          page.box.style.setProperty('--scale-factor', String(scale));
          page.box.style.setProperty('--total-scale-factor', String(scale));
          page.canvas.style.width = `${viewport.width}px`;
          page.canvas.style.height = `${viewport.height}px`;
        }
        // Redraw what is on screen now; the observer only reports changes.
        const view = stage.getBoundingClientRect();
        for (const page of pages) {
          const box = page.box.getBoundingClientRect();
          if (box.bottom > view.top - 600 && box.top < view.bottom + 600) void draw(page);
        }
      };

      const setScale = (next: number | null) => {
        const ratio = stage.scrollTop / Math.max(stage.scrollHeight, 1);
        chosen = next;
        scale = next ?? fitScale();
        showLevel();
        layout();
        stage.scrollTop = ratio * stage.scrollHeight;
        showPage();
      };

      const zoom = (direction: 1 | -1) => {
        const next =
          direction > 0
            ? ZOOM_STEPS.find((s) => s > scale + 1e-6)
            : [...ZOOM_STEPS].reverse().find((s) => s < scale - 1e-6);
        if (next !== undefined) setScale(next);
      };

      const clear = () => {
        observer.disconnect();
        for (const page of pages) {
          page.task?.cancel();
          page.textLayer?.cancel();
        }
        pages = [];
        stage.replaceChildren();
        void loading?.destroy();
        loading = null;
      };

      const load = async (next: string) => {
        const current = ++run;
        clear();
        info.textContent = 'Chargement…';
        try {
          const data = await read(next);
          if (current !== run) return;
          const task = getDocument({ data });
          loading = task;
          const loaded = await task.promise;
          if (current !== run) return;
          for (let n = 1; n <= loaded.numPages; n++) {
            const proxy = await loaded.getPage(n);
            if (current !== run) return;
            const box = document.createElement('div');
            box.className = 'cv-pdf-page';
            box.dataset.page = String(n);
            const canvas = document.createElement('canvas');
            const text = document.createElement('div');
            text.className = 'textLayer';
            box.append(canvas, text);
            stage.append(box);
            pages.push({ proxy, box, canvas, text, drawn: null, task: null, textLayer: null });
          }
          scale = chosen ?? fitScale();
          showLevel();
          layout();
          for (const page of pages) observer.observe(page.box);
          showPage();
        } catch (err) {
          if (current !== run) return;
          info.textContent = '';
          const message = document.createElement('p');
          message.className = 'cv-pdf-error';
          message.textContent =
            err instanceof PasswordException
              ? 'Ce PDF est protégé par un mot de passe.'
              : `PDF illisible : ${err instanceof Error ? err.message : String(err)}`;
          stage.replaceChildren(message);
        }
      };

      stage.addEventListener('scroll', showPage, { passive: true });
      stage.addEventListener(
        'wheel',
        (event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          zoom(event.deltaY < 0 ? 1 : -1);
        },
        { passive: false },
      );
      // "Fit width" follows the pane when it is resized (split view, side panels).
      const resize = new ResizeObserver(() => {
        if (chosen === null && pages.length > 0) setScale(null);
      });
      resize.observe(stage);

      const open = (next: ViewerInput) => {
        if (!next.path || next.path === path) return;
        path = next.path;
        void load(next.path);
      };
      open(input);

      return {
        update: open,
        dispose() {
          run++;
          resize.disconnect();
          clear();
          root.remove();
        },
      };
    },
  };
}
