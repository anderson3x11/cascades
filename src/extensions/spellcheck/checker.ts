import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import type { ExtensionContext } from '../../api';
import { maskLine } from './mask';
import { t } from '../../api';

/** Waits for a pause in typing or scrolling before asking the dictionary. */
const DELAY_MS = 350;
/** Lines kept in the cache before it starts over. */
const CACHE_LINES = 20_000;

type Found = { start: number; length: number }[];

/** What is shared by the tabs: results by line text, words to ignore, a failure. */
export class SpellState {
  /** Results by language, then by line text: unchanged lines are never asked twice. */
  private cache = new Map<string, Map<string, Found>>();
  readonly ignored = new Set<string>();
  /** Set when the system has no checker; checking stops and says so once. */
  failure: string | null = null;

  results(language: string): Map<string, Found> {
    let results = this.cache.get(language);
    if (!results || results.size > CACHE_LINES) {
      results = new Map();
      this.cache.set(language, results);
    }
    return results;
  }

  /** After a word is added to the dictionary: every line is asked again. */
  forget(): void {
    this.cache.clear();
  }
}

const mark = Decoration.mark({ class: 'cm-misspelled' });

/**
 * Underlines misspelled words of the visible lines with the system's
 * dictionary; right-click on one offers corrections.
 */
export function spellChecker(
  ctx: ExtensionContext,
  shared: SpellState,
  language: () => string,
  onFailure: (message: string) => void,
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      private timer: ReturnType<typeof setTimeout> | undefined;
      private run = 0;

      constructor(private view: EditorView) {
        this.schedule(0);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = this.decorations.map(update.changes);
        if (update.docChanged || update.viewportChanged) this.schedule(DELAY_MS);
      }

      destroy() {
        clearTimeout(this.timer);
        this.run++;
      }

      schedule(delay: number) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.check(), delay);
      }

      private async check() {
        if (shared.failure) return;
        const run = ++this.run;
        const lang = language();
        const results = shared.results(lang);
        const { doc } = this.view.state;
        const lines: number[] = [];
        for (const { from, to } of this.view.visibleRanges) {
          for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) lines.push(n);
        }
        const unknown = [...new Set(lines.map((n) => doc.line(n).text))].filter(
          (text) => !results.has(text) && text.trim() !== '',
        );
        if (unknown.length > 0) {
          try {
            const found = await ctx.spelling.check(lang, unknown.map(maskLine));
            unknown.forEach((text, i) => results.set(text, found[i] ?? []));
          } catch (err) {
            shared.failure = err instanceof Error ? err.message : String(err);
            onFailure(shared.failure);
            return;
          }
        }
        if (run !== this.run) return;
        // The document may have changed meanwhile: work from the current one.
        const current = this.view.state.doc;
        const builder = new RangeSetBuilder<Decoration>();
        for (const n of lines) {
          if (n > current.lines) break;
          const line = current.line(n);
          for (const { start, length } of results.get(line.text) ?? []) {
            const word = line.text.slice(start, start + length);
            if (!shared.ignored.has(word.toLowerCase())) {
              builder.add(line.from + start, line.from + start + length, mark);
            }
          }
        }
        this.decorations = builder.finish();
        this.view.dispatch({});
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );

  /** The misspelled word under the pointer, or null. */
  const wordAt = (view: EditorView, event: MouseEvent) => {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    const decorations = view.plugin(plugin)?.decorations;
    if (pos === null || !decorations) return null;
    let found: { from: number; to: number } | null = null;
    decorations.between(pos, pos, (from, to) => {
      found = { from, to };
      return false;
    });
    return found as { from: number; to: number } | null;
  };

  /** Checks the active editor again (others do when they are next scrolled or edited). */
  const recheckAll = () => ctx.editor.view()?.plugin(plugin)?.schedule(0);

  return [
    plugin,
    EditorView.contentAttributes.of({ spellcheck: 'false' }),
    EditorView.domEventHandlers({
      contextmenu(event, view) {
        const range = wordAt(view, event);
        if (!range) return false; // The usual menu: cut, copy, paste.
        event.preventDefault();
        const word = view.state.sliceDoc(range.from, range.to);
        const at = { x: event.clientX, y: event.clientY };
        void ctx.spelling
          .suggest(language(), word)
          .catch(() => [] as string[])
          .then((suggestions) => {
            const replace = (text: string) => () => {
              view.dispatch({
                changes: { from: range.from, to: range.to, insert: text },
                userEvent: 'input.spell',
              });
              view.focus();
            };
            ctx.contextMenu.show(at, [
              ...(suggestions.length > 0
                ? suggestions.slice(0, 6).map((s) => ({ label: s, run: replace(s) }))
                : [{ label: t('No suggestions'), run: () => {}, disabled: true }]),
              'separator',
              {
                label: t('Add to the dictionary'),
                run: () =>
                  void ctx.spelling.add(language(), word).then(() => {
                    shared.forget();
                    recheckAll();
                  }),
              },
              {
                label: t('Ignore this word'),
                run: () => {
                  shared.ignored.add(word.toLowerCase());
                  recheckAll();
                },
              },
            ]);
          });
        return true;
      },
    }),
    EditorView.baseTheme({
      '.cm-misspelled': {
        textDecoration: 'underline wavy var(--change-deleted)',
        textDecorationSkipInk: 'none',
        textUnderlineOffset: '3px',
      },
    }),
  ];
}
