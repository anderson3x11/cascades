import { getSearchQuery, searchPanelOpen, type SearchQuery } from '@codemirror/search';
import type { EditorState } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { t } from '../../api';

/** Past this many matches, counting stops ("10 000+"). */
const LIMIT = 10_000;

export interface MatchCount {
  total: number;
  /** Position of the selected match among them, or null. */
  current: number | null;
  capped: boolean;
}

/** How many times the search query matches, and which one is selected. */
export function countMatches(state: EditorState, query: SearchQuery): MatchCount {
  const count: MatchCount = { total: 0, current: null, capped: false };
  if (!query.valid || query.search === '') return count;
  const main = state.selection.main;
  const cursor = query.getCursor(state);
  for (let match = cursor.next(); !match.done; match = cursor.next()) {
    count.total++;
    if (match.value.from === main.from && match.value.to === main.to) count.current = count.total;
    if (count.total >= LIMIT) {
      count.capped = true;
      break;
    }
  }
  return count;
}

export function countLabel({ total, current, capped }: MatchCount): string {
  if (total === 0) return t('No results');
  const all = capped ? `${total.toLocaleString()}+` : total.toLocaleString();
  if (current !== null) return t('{current} of {total}', { current, total: all });
  return total === 1 ? t('1 result') : t('{count} results', { count: all });
}

/** "3 sur 12" next to the field of the search panel (Ctrl+F). */
export const findCount = [
  ViewPlugin.fromClass(
    class {
      private frame = 0;
      constructor(private view: EditorView) {
        this.schedule();
      }
      update(update: ViewUpdate) {
        // Query, text, selection or the panel itself may have changed.
        if (update.transactions.length > 0) this.schedule();
      }
      destroy() {
        cancelAnimationFrame(this.frame);
      }
      /** After the frame: a panel opened by this update is in the page only then. */
      private schedule() {
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => this.show());
      }
      private show() {
        if (!searchPanelOpen(this.view.state)) return;
        const field = this.view.dom.querySelector<HTMLInputElement>('.cm-search [main-field]');
        if (!field) return;
        let label = field.parentElement?.querySelector<HTMLElement>('.cm-search-count');
        if (!label) {
          label = document.createElement('span');
          label.className = 'cm-search-count';
          label.setAttribute('aria-live', 'polite');
          field.after(label);
        }
        const query = getSearchQuery(this.view.state);
        label.textContent =
          query.search === '' ? '' : countLabel(countMatches(this.view.state, query));
      }
    },
  ),
  EditorView.baseTheme({
    '.cm-search-count': {
      display: 'inline-block',
      minWidth: '7em',
      margin: '0 6px',
      color: 'var(--ui-fg)',
      fontFamily: 'var(--font-ui)',
      fontSize: '12px',
    },
  }),
];
