import type { ViewerFactory, ViewerInput } from '../../api';
import './viewers.css';

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

/**
 * Image viewer with zoom. `source` turns the input into a URL the page can
 * load (a local file URL for images, a blob URL for SVG source). Everything
 * is shown through <img>, so an SVG never runs scripts.
 */
export function createImageViewer(source: (input: ViewerInput) => Promise<string>): ViewerFactory {
  return {
    create(host: HTMLElement, input: ViewerInput) {
      const root = document.createElement('div');
      root.className = 'cv-image';
      const stage = document.createElement('div');
      stage.className = 'cv-image-stage';
      const img = document.createElement('img');
      img.alt = '';
      stage.append(img);

      const bar = document.createElement('div');
      bar.className = 'cv-image-bar';
      const info = document.createElement('span');
      const button = (label: string, title: string, run: () => void) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.onclick = run;
        return b;
      };
      const level = document.createElement('span');
      level.className = 'cv-image-level';
      root.append(stage, bar);
      host.append(root);

      /** null = fit to the pane; otherwise a scale of the natural size. */
      let scale: number | null = null;
      let run = 0;
      let revoke: string | null = null;

      const apply = () => {
        stage.classList.toggle('fit', scale === null);
        img.style.width = scale === null ? '' : `${img.naturalWidth * scale}px`;
        const shown = scale ?? (img.naturalWidth ? img.clientWidth / img.naturalWidth : 1);
        level.textContent = `${Math.round(shown * 100)} %`;
      };

      const zoom = (direction: 1 | -1) => {
        const current = scale ?? (img.naturalWidth ? img.clientWidth / img.naturalWidth : 1);
        const next =
          direction > 0
            ? ZOOM_STEPS.find((s) => s > current + 1e-6)
            : [...ZOOM_STEPS].reverse().find((s) => s < current - 1e-6);
        if (next !== undefined) scale = next;
        apply();
      };

      bar.append(
        info,
        button('−', 'Réduire', () => zoom(-1)),
        level,
        button('+', 'Agrandir', () => zoom(1)),
        button('100 %', 'Taille réelle', () => {
          scale = 1;
          apply();
        }),
        button('Ajuster', 'Ajuster à la fenêtre', () => {
          scale = null;
          apply();
        }),
      );

      stage.addEventListener(
        'wheel',
        (event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          zoom(event.deltaY < 0 ? 1 : -1);
        },
        { passive: false },
      );
      img.onload = () => {
        info.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
        apply();
      };
      img.onerror = () => {
        info.textContent = 'Image illisible';
      };

      const render = async (next: ViewerInput) => {
        const current = ++run;
        const url = await source(next).catch(() => '');
        if (current !== run) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        if (revoke) URL.revokeObjectURL(revoke);
        revoke = url.startsWith('blob:') ? url : null;
        img.src = url;
      };

      void render(input);
      return {
        update: (next) => void render(next),
        dispose() {
          run++;
          if (revoke) URL.revokeObjectURL(revoke);
          root.remove();
        },
      };
    },
  };
}
