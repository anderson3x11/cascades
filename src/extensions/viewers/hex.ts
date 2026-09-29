import type { ViewerFactory, ViewerInput } from '../../api';
import './viewers.css';
import { t } from '../../api';

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 20;
/** Bytes read at once; the rows on screen come from one or two of these. */
const CHUNK = 64 * 1024;
/** Chunks kept in memory. */
const CACHE = 32;
/**
 * Browsers cap the height of an element: past this, the scrollbar is scaled
 * instead of giving each row its own 20 pixels.
 */
const MAX_HEIGHT = 8_000_000;

export interface HexSource {
  size(path: string): Promise<number>;
  read(path: string, range: { offset: number; length: number }): Promise<Uint8Array>;
}

const hex = (value: number, digits: number) =>
  value.toString(16).toUpperCase().padStart(digits, '0');

/** One row: offset, bytes in hex (two groups of 8), and the printable characters. */
export function formatRow(offset: number, bytes: Uint8Array): [string, string, string] {
  const cells: string[] = [];
  let text = '';
  for (let i = 0; i < BYTES_PER_ROW; i++) {
    const byte = bytes[i];
    cells.push(byte === undefined ? '  ' : hex(byte, 2));
    if (i === 7) cells.push('');
    if (byte !== undefined) text += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '·';
  }
  return [hex(offset, 8), cells.join(' '), text];
}

const formatSize = (size: number) =>
  size === 1 ? t('1 byte') : t('{count} bytes', { count: size.toLocaleString() });

/** Read-only hex view of any file, reading only the part on screen. */
export function createHexViewer(source: HexSource): ViewerFactory {
  return {
    create(host: HTMLElement, input: ViewerInput) {
      const root = document.createElement('div');
      root.className = 'cv-hex';
      const stage = document.createElement('div');
      stage.className = 'cv-hex-stage';
      const spacer = document.createElement('div');
      const rowsBox = document.createElement('div');
      rowsBox.className = 'cv-hex-rows';
      stage.append(spacer, rowsBox);
      const bar = document.createElement('div');
      bar.className = 'cv-image-bar';
      const info = document.createElement('span');
      bar.append(info);
      root.append(stage, bar);
      host.append(root);

      let path: string | null = null;
      let size = 0;
      let rows = 0;
      let run = 0;
      const chunks = new Map<number, Promise<Uint8Array>>();

      const chunk = (index: number, file: string) => {
        let bytes = chunks.get(index);
        if (!bytes) {
          bytes = source.read(file, { offset: index * CHUNK, length: CHUNK });
          chunks.set(index, bytes);
          if (chunks.size > CACHE) chunks.delete(chunks.keys().next().value as number);
        }
        return bytes;
      };

      /** Bytes from `start` to `end`, from the chunks they fall in. */
      const bytesBetween = async (file: string, start: number, end: number) => {
        const out = new Uint8Array(end - start);
        for (let index = Math.floor(start / CHUNK); index * CHUNK < end; index++) {
          const bytes = await chunk(index, file);
          const from = Math.max(start, index * CHUNK);
          const to = Math.min(end, index * CHUNK + bytes.length);
          if (to > from)
            out.set(bytes.subarray(from - index * CHUNK, to - index * CHUNK), from - start);
        }
        return out;
      };

      const draw = async () => {
        if (!path || rows === 0) return;
        const current = run;
        const file = path;
        const visible = Math.ceil(stage.clientHeight / ROW_HEIGHT) + 1;
        const height = rows * ROW_HEIGHT;
        const scaled = height > MAX_HEIGHT;
        const room = Math.max(stage.scrollHeight - stage.clientHeight, 1);
        const first = scaled
          ? Math.round((stage.scrollTop / room) * Math.max(rows - visible + 1, 0))
          : Math.floor(stage.scrollTop / ROW_HEIGHT);
        const last = Math.min(first + visible, rows);
        const bytes = await bytesBetween(
          file,
          first * BYTES_PER_ROW,
          Math.min(last * BYTES_PER_ROW, size),
        );
        if (current !== run) return;
        const lines: HTMLElement[] = [];
        for (let row = first; row < last; row++) {
          const start = (row - first) * BYTES_PER_ROW;
          const [offset, cells, text] = formatRow(
            row * BYTES_PER_ROW,
            bytes.subarray(start, Math.min(start + BYTES_PER_ROW, bytes.length)),
          );
          const line = document.createElement('div');
          line.className = 'cv-hex-row';
          for (const [cls, content] of [
            ['cv-hex-offset', offset],
            ['cv-hex-bytes', cells],
            ['cv-hex-text', text],
          ] as const) {
            const span = document.createElement('span');
            span.className = cls;
            span.textContent = content;
            line.append(span);
          }
          lines.push(line);
        }
        rowsBox.replaceChildren(...lines);
        rowsBox.style.transform = `translateY(${scaled ? stage.scrollTop : first * ROW_HEIGHT}px)`;
      };

      const load = async (next: string) => {
        const current = ++run;
        chunks.clear();
        rowsBox.replaceChildren();
        try {
          size = await source.size(next);
        } catch (err) {
          if (current !== run) return;
          info.textContent = t('Unreadable file: {problem}', {
            problem: err instanceof Error ? err.message : String(err),
          });
          return;
        }
        if (current !== run) return;
        rows = Math.ceil(size / BYTES_PER_ROW);
        spacer.style.height = `${Math.min(rows * ROW_HEIGHT, MAX_HEIGHT)}px`;
        stage.scrollTop = 0;
        info.textContent = size === 0 ? t('Empty file') : `${formatSize(size)} · ${t('read-only')}`;
        await draw();
      };

      let frame = 0;
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => void draw());
      };
      stage.addEventListener('scroll', schedule, { passive: true });
      const resize = new ResizeObserver(schedule);
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
          cancelAnimationFrame(frame);
          resize.disconnect();
          root.remove();
        },
      };
    },
  };
}
