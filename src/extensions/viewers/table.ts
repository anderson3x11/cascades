import type { ViewerFactory, ViewerInput } from '../../api';
import { parseCsv } from './csv';
import './viewers.css';
import { t } from '../../api';

/** Rows drawn at most, so a huge file stays responsive. */
const MAX_ROWS = 5000;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Sortable table of a CSV or TSV file; the first row is the header. */
export function createTableViewer(delimiter?: string): ViewerFactory {
  return {
    create(host: HTMLElement, input: ViewerInput) {
      const root = document.createElement('div');
      root.className = 'cv-table';
      host.append(root);
      let rows: string[][] = [];
      let sort: { column: number; descending: boolean } | null = null;

      const draw = () => {
        const [header = [], ...body] = rows;
        const columns = Math.max(header.length, ...body.map((r) => r.length));
        const by = sort;
        const sorted = by
          ? [...body].sort((a, b) => {
              const order = collator.compare(a[by.column] ?? '', b[by.column] ?? '');
              return by.descending ? -order : order;
            })
          : body;

        const table = document.createElement('table');
        const head = table.createTHead().insertRow();
        for (let c = 0; c < columns; c++) {
          const th = document.createElement('th');
          const button = document.createElement('button');
          const arrow = sort?.column === c ? (sort.descending ? ' ▼' : ' ▲') : '';
          button.textContent = (header[c] ?? '') + arrow;
          button.title = t('Sort');
          button.onclick = () => {
            sort =
              sort?.column === c
                ? sort.descending
                  ? null
                  : { column: c, descending: true }
                : { column: c, descending: false };
            draw();
          };
          th.append(button);
          head.append(th);
        }
        const tbody = table.createTBody();
        for (const row of sorted.slice(0, MAX_ROWS)) {
          const tr = tbody.insertRow();
          for (let c = 0; c < columns; c++) tr.insertCell().textContent = row[c] ?? '';
        }

        const info = document.createElement('p');
        info.className = 'cv-table-info';
        info.textContent =
          body.length > MAX_ROWS
            ? t('First {shown} lines of {count}.', { shown: MAX_ROWS, count: body.length })
            : t('{lines}, {columns}.', {
                lines: body.length === 1 ? t('1 line') : t('{count} lines', { count: body.length }),
                columns: columns === 1 ? t('1 column') : t('{count} columns', { count: columns }),
              });
        root.replaceChildren(info, table);
      };

      const render = ({ text }: ViewerInput) => {
        rows = parseCsv(text, delimiter);
        draw();
      };

      render(input);
      return { update: render, dispose: () => root.remove() };
    },
  };
}
