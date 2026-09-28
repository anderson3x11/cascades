/**
 * Passages set aside from a file ("quarantine"), by file. Pure data: the
 * extension moves text between the document and this store.
 */

export interface Snippet {
  id: string;
  text: string;
  /** Line it came from, for information. */
  line: number;
  /** Epoch milliseconds. */
  createdAt: number;
}

/** Serialized form, for quarantine.json: file path -> snippets, newest first. */
export type QuarantineData = Record<string, Snippet[]>;

let counter = 0;
const newId = () => `q${Date.now().toString(36)}${(counter++).toString(36)}`;

export class QuarantineStore {
  private files = new Map<string, Snippet[]>();

  /** Snippets of a file, newest first. */
  list(key: string): readonly Snippet[] {
    return this.files.get(key) ?? [];
  }

  add(key: string, text: string, line: number, now = Date.now()): Snippet {
    const snippet = { id: newId(), text, line, createdAt: now };
    this.files.set(key, [snippet, ...this.list(key)]);
    return snippet;
  }

  /** Removes a snippet and returns it with its position, to put it back later. */
  remove(key: string, id: string): { snippet: Snippet; index: number } | null {
    const list = this.list(key);
    const index = list.findIndex((s) => s.id === id);
    const snippet = list[index];
    if (!snippet) return null;
    this.set(
      key,
      list.filter((s) => s.id !== id),
    );
    return { snippet, index };
  }

  /** Puts a removed snippet back where it was. */
  restore(key: string, snippet: Snippet, index: number): void {
    const list = [...this.list(key)];
    list.splice(Math.min(index, list.length), 0, snippet);
    this.files.set(key, list);
  }

  /** Moves a file's snippets to another key (untitled buffer saved, file renamed). */
  rename(from: string, to: string): void {
    if (from === to) return;
    const moving = this.list(from);
    if (moving.length === 0) return;
    this.files.delete(from);
    this.files.set(to, [...moving, ...this.list(to)]);
  }

  /** Data to save, restricted to keys accepted by `keep` (drops untitled buffers). */
  toJSON(keep: (key: string) => boolean): QuarantineData {
    const data: QuarantineData = {};
    for (const [key, list] of this.files) if (keep(key) && list.length > 0) data[key] = list;
    return data;
  }

  /** Loads saved data, skipping anything malformed. */
  load(raw: unknown): void {
    this.files.clear();
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return;
    for (const [key, value] of Object.entries(raw)) {
      if (!Array.isArray(value)) continue;
      const list = value.filter(
        (s): s is Snippet =>
          typeof s === 'object' &&
          s !== null &&
          typeof s.id === 'string' &&
          typeof s.text === 'string' &&
          typeof s.line === 'number' &&
          typeof s.createdAt === 'number',
      );
      if (list.length > 0) this.files.set(key, list);
    }
  }

  private set(key: string, list: Snippet[]): void {
    if (list.length === 0) this.files.delete(key);
    else this.files.set(key, list);
  }
}
