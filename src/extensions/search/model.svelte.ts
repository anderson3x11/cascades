import { SvelteSet } from 'svelte/reactivity';
import type { ExtensionContext, FileMatches, SearchOptions, SearchRun } from '../../api';
import { t } from '../../api';

/** Past this many matches the search stops: the list must stay readable. */
export const MAX_MATCHES = 2000;
const DELAY_MS = 250;

const samePath = (path: string) => path.replace(/\\/g, '/').toLowerCase();

/** Search and replace in the files of the open folders. */
export class SearchModel {
  query = $state('');
  replacement = $state('');
  options = $state<SearchOptions>({ caseSensitive: false, wholeWord: false, regex: false });

  /** Files with matches, in the order found. Raw: replaced as a whole. */
  results = $state.raw<FileMatches[]>([]);
  running = $state(false);
  truncated = $state(false);
  /** Invalid expression, or a failure to report. */
  error = $state<string | null>(null);
  /** What the last replacement did. */
  notice = $state<string | null>(null);
  /** No folder is open in the explorer. */
  noFolder = $state(false);
  /** Folders of the last search, to show paths from them. */
  roots = $state.raw<string[]>([]);
  readonly collapsed = new SvelteSet<string>();

  private run: SearchRun | null = null;
  /** Bumped by each search: results of an older one are dropped. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private ctx: ExtensionContext) {}

  get matchCount(): number {
    return this.results.reduce((sum, file) => sum + file.matches.length, 0);
  }

  /** Searches again after a short pause in typing. */
  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(), DELAY_MS);
  }

  async search(): Promise<void> {
    clearTimeout(this.timer);
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.run?.cancel();
    this.run = null;
    this.results = [];
    this.collapsed.clear();
    this.error = null;
    this.truncated = false;
    this.running = false;
    if (this.query === '') return;
    const roots = await this.folders();
    if (!current()) return;
    this.roots = roots;
    this.noFolder = roots.length === 0;
    if (this.noFolder) return;

    this.running = true;
    try {
      this.run = this.ctx.fs.searchFiles(
        {
          roots,
          exclude: this.exclude(),
          query: this.query,
          options: { ...this.options },
          replacement: this.replacement === '' ? null : this.replacement,
          maxMatches: MAX_MATCHES,
        },
        (file) => {
          if (current()) this.results = [...this.results, file];
        },
      );
      const { truncated } = await this.run.done;
      if (current()) this.truncated = truncated;
    } catch (err) {
      if (current()) this.error = message(err);
    } finally {
      if (current()) this.running = false;
    }
  }

  /** Stops the search in progress, keeping what it found. */
  stop(): void {
    this.generation++;
    this.run?.cancel();
    this.run = null;
    this.running = false;
  }

  /** Takes a file out of the results (it will not be replaced). */
  dismiss(path: string): void {
    this.results = this.results.filter((f) => f.path !== path);
  }

  /** Replaces in the files listed, after asking; files with unsaved changes are left alone. */
  async replace(paths: string[]): Promise<void> {
    const files = this.results.filter((f) => paths.includes(f.path));
    const dirty = this.ctx.workspace
      .tabs()
      .filter((t) => t.dirty && t.path)
      .map((t) => samePath(t.path as string));
    const kept = files.filter((f) => !dirty.includes(samePath(f.path)));
    const skipped = files.length - kept.length;
    if (kept.length === 0) {
      this.notice = t('These files have unsaved changes: save them first.');
      return;
    }
    const count = kept.reduce((sum, f) => sum + f.matches.length, 0);
    const what = t('{matches} in {files}', {
      matches: count === 1 ? t('1 match') : t('{count} matches', { count }),
      files: kept.length === 1 ? t('1 file') : t('{count} files', { count: kept.length }),
    });
    const question =
      this.replacement === ''
        ? t('Delete {what}?', { what })
        : t('Replace {what} with "{replacement}"?', { what, replacement: this.replacement });
    const answer = await this.ctx.dialogs.choose(question, {
      buttons: [t('Replace'), t('Cancel')],
    });
    if (answer !== t('Replace')) return;

    try {
      const done = await this.ctx.fs.replaceInFiles(
        kept.map((f) => f.path),
        this.query,
        { ...this.options },
        this.replacement,
      );
      const replaced = done.reduce((sum, r) => sum + r.count, 0);
      const failed = done.filter((r) => r.error);
      const parts = [
        replaced === 1
          ? t('1 match replaced.')
          : t('{count} matches replaced.', { count: replaced }),
      ];
      if (skipped > 0) {
        parts.push(
          skipped === 1
            ? t('1 open file with unsaved changes left out.')
            : t('{count} open files with unsaved changes left out.', { count: skipped }),
        );
      }
      if (failed.length > 0) {
        parts.push(t('Failed for {files}.', { files: failed.map((r) => r.path).join(', ') }));
      }
      await this.search();
      this.notice = parts.join(' ');
    } catch (err) {
      this.error = message(err);
    }
  }

  /** Opens a file with a match selected. */
  async reveal(path: string, line: number, column: number, length: number): Promise<void> {
    await this.ctx.commands.execute('file.openPath', path);
    const view = this.ctx.editor.view();
    if (!view || line > view.state.doc.lines) return;
    const from = Math.min(view.state.doc.line(line).from + column, view.state.doc.length);
    view.dispatch({
      selection: { anchor: from, head: Math.min(from + length, view.state.doc.length) },
      scrollIntoView: true,
    });
    view.focus();
  }

  private async folders(): Promise<string[]> {
    const folders = await this.ctx.commands.execute('explorer.folders').catch(() => []);
    return Array.isArray(folders) ? folders.filter((f): f is string => typeof f === 'string') : [];
  }

  private exclude(): string[] {
    try {
      return this.ctx.settings.get<string[]>('explorer.exclude');
    } catch {
      return [];
    }
  }
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
