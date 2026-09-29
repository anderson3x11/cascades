import { toDisposable, type Disposable } from '../disposable';
import { Emitter } from '../events/emitter';
import { parseWhen, type ContextLookup, type WhenExpr } from '../context/when';
import { t } from '../i18n/i18n';
import { LEADER, normalizeChord, parseKeySequence } from './keys';

export interface KeybindingSpec {
  /**
   * Key sequence, e.g. "Ctrl+Shift+P", "Ctrl+K Z", or with the leader key: "Leader Z".
   * Empty only in a removal rule, to remove every shortcut of the command.
   */
  key: string;
  /** A leading "-" makes a removal rule: "-file.save" removes earlier shortcuts of file.save. */
  command: string;
  args?: unknown[];
  /** Context condition, e.g. "editorFocus && vim.mode == 'normal'". */
  when?: string;
}

/** Who declared a binding: the app and its extensions, or keybindings.json. */
export type KeybindingSource = 'default' | 'user';

export interface Keybinding {
  /** Normalized chords, the leader already replaced by its actual chord. */
  chords: string[];
  /** The key as written in the spec ("Leader S", "Ctrl+D"). */
  key: string;
  command: string;
  args: unknown[];
  when: string | undefined;
  source: KeybindingSource;
}

interface Entry {
  /** Chords as written, possibly containing LEADER. */
  chords: string[];
  key: string;
  source: KeybindingSource;
  command: string;
  args: unknown[];
  when: string | undefined;
  test: WhenExpr | null;
  order: number;
}

/** Removes the bindings registered before it that it matches. */
interface Removal {
  command: string;
  /** Null matches any key. */
  chords: string[] | null;
  when: string | undefined;
  order: number;
}

export type ResolveResult =
  { kind: 'match'; binding: Keybinding } | { kind: 'pending'; chords: string[] } | { kind: 'none' };

/** A key that can follow the chords typed so far. */
export interface Continuation {
  chord: string;
  command: string;
  /** More keys are needed after this one. */
  prefix: boolean;
}

export const DEFAULT_LEADER = 'ctrl+space';

/**
 * Holds keybindings and resolves key presses, including multi-chord sequences.
 * When several bindings match, the one registered last wins, so user bindings
 * registered after the defaults override them. "Leader" in a sequence stands
 * for a configurable chord, like the leader key of Vim.
 */
export class KeybindingRegistry {
  private entries: Entry[] = [];
  private removals: Removal[] = [];
  private counter = 0;
  private pending: string[] = [];
  private leader = DEFAULT_LEADER;
  /** Fired when bindings are added or removed, or the leader changes. */
  readonly onDidChange = new Emitter<void>();

  register(spec: KeybindingSpec, source: KeybindingSource = 'default'): Disposable {
    if (spec.command.startsWith('-')) return this.registerRemoval(spec);
    const entry: Entry = {
      chords: parseKeySequence(spec.key),
      key: spec.key,
      source,
      command: spec.command,
      args: spec.args ?? [],
      when: spec.when,
      test: spec.when ? parseWhen(spec.when) : null,
      order: this.counter++,
    };
    this.entries.push(entry);
    this.onDidChange.fire();
    return toDisposable(() => {
      this.entries = this.entries.filter((e) => e !== entry);
      this.onDidChange.fire();
    });
  }

  private registerRemoval(spec: KeybindingSpec): Disposable {
    const removal: Removal = {
      command: spec.command.slice(1),
      chords: spec.key.trim() === '' ? null : parseKeySequence(spec.key),
      when: spec.when,
      order: this.counter++,
    };
    this.removals.push(removal);
    this.onDidChange.fire();
    return toDisposable(() => {
      this.removals = this.removals.filter((r) => r !== removal);
      this.onDidChange.fire();
    });
  }

  /** Bindings in effect: those not removed by a later removal rule. */
  private live(): Entry[] {
    if (this.removals.length === 0) return this.entries;
    return this.entries.filter(
      (entry) =>
        !this.removals.some(
          (r) =>
            r.order > entry.order &&
            r.command === entry.command &&
            (r.when === undefined || r.when === entry.when) &&
            (r.chords === null || sameChords(this.actualOf(r.chords), this.actual(entry))),
        ),
    );
  }

  /** Changes the chord that "Leader" stands for, e.g. "Ctrl+Space". */
  setLeader(key: string): void {
    const chord = normalizeChord(key);
    if (chord === LEADER) throw new Error(t('the leader key cannot be "Leader"'));
    this.leader = chord;
    this.pending = [];
    this.onDidChange.fire();
  }

  get leaderChord(): string {
    return this.leader;
  }

  list(): Keybinding[] {
    return this.live().map((e) => this.toBinding(e));
  }

  /** Chords typed so far in an unfinished sequence. */
  get pendingChords(): readonly string[] {
    return this.pending;
  }

  reset(): void {
    this.pending = [];
  }

  /** Feeds one chord. Returns a match, a pending sequence, or none (state is reset). */
  resolve(chord: string, context: ContextLookup): ResolveResult {
    const sequence = [...this.pending, chord];
    let exact: Entry | null = null;
    let hasLonger = false;

    for (const entry of this.live()) {
      const chords = this.actual(entry);
      if (chords.length < sequence.length) continue;
      if (!sequence.every((c, i) => chords[i] === c)) continue;
      if (entry.test && !entry.test(context)) continue;
      if (chords.length === sequence.length) {
        if (!exact || entry.order > exact.order) exact = entry;
      } else {
        hasLonger = true;
      }
    }

    // A longer sequence takes precedence: wait for the next chord.
    if (hasLonger) {
      this.pending = sequence;
      return { kind: 'pending', chords: sequence };
    }
    this.pending = [];
    if (exact) return { kind: 'match', binding: this.toBinding(exact) };
    return { kind: 'none' };
  }

  /** Keys that can follow the pending chords in this context (for a hint bar). */
  continuations(context: ContextLookup): Continuation[] {
    const pending = this.pending;
    const byChord = new Map<string, Continuation>();
    // Entries are in registration order, so later bindings overwrite the command.
    for (const entry of this.live()) {
      const chords = this.actual(entry);
      if (chords.length <= pending.length) continue;
      if (!pending.every((c, i) => chords[i] === c)) continue;
      if (entry.test && !entry.test(context)) continue;
      const chord = chords[pending.length] as string;
      const prefix = chords.length > pending.length + 1;
      const current = byChord.get(chord);
      // As in resolve(), a longer sequence wins: the key then only leads further.
      byChord.set(chord, {
        chord,
        command: current?.prefix && !prefix ? current.command : entry.command,
        prefix: prefix || (current?.prefix ?? false),
      });
    }
    return [...byChord.values()].sort((a, b) => a.chord.localeCompare(b.chord));
  }

  /** Bindings for a command, most recent first (to display the active shortcut). */
  forCommand(command: string): Keybinding[] {
    return this.live()
      .filter((e) => e.command === command)
      .sort((a, b) => b.order - a.order)
      .map((e) => this.toBinding(e));
  }

  private actual(entry: Entry): string[] {
    return this.actualOf(entry.chords);
  }

  /** Chords with "Leader" replaced by the leader key. */
  actualChords(chords: string[]): string[] {
    return this.actualOf(chords);
  }

  private actualOf(chords: string[]): string[] {
    return chords.map((c) => (c === LEADER ? this.leader : c));
  }

  private toBinding(entry: Entry): Keybinding {
    return {
      chords: this.actual(entry),
      key: entry.key,
      source: entry.source,
      command: entry.command,
      args: entry.args,
      when: entry.when,
    };
  }
}

function sameChords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}
