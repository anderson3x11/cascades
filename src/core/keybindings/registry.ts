import { toDisposable, type Disposable } from '../disposable';
import { parseWhen, type ContextLookup, type WhenExpr } from '../context/when';
import { parseKeySequence } from './keys';

export interface KeybindingSpec {
  /** Key sequence, e.g. "Ctrl+Shift+P" or "Ctrl+K Z". */
  key: string;
  command: string;
  args?: unknown[];
  /** Context condition, e.g. "editorFocus && vim.mode == 'normal'". */
  when?: string;
}

export interface Keybinding {
  chords: string[];
  command: string;
  args: unknown[];
  when: string | undefined;
}

interface Entry {
  binding: Keybinding;
  when: WhenExpr | null;
  order: number;
}

export type ResolveResult =
  { kind: 'match'; binding: Keybinding } | { kind: 'pending'; chords: string[] } | { kind: 'none' };

/**
 * Holds keybindings and resolves key presses, including multi-chord sequences.
 * When several bindings match, the one registered last wins, so user bindings
 * registered after the defaults override them.
 */
export class KeybindingRegistry {
  private entries: Entry[] = [];
  private counter = 0;
  private pending: string[] = [];

  register(spec: KeybindingSpec): Disposable {
    const entry: Entry = {
      binding: {
        chords: parseKeySequence(spec.key),
        command: spec.command,
        args: spec.args ?? [],
        when: spec.when,
      },
      when: spec.when ? parseWhen(spec.when) : null,
      order: this.counter++,
    };
    this.entries.push(entry);
    return toDisposable(() => {
      this.entries = this.entries.filter((e) => e !== entry);
    });
  }

  list(): Keybinding[] {
    return this.entries.map((e) => e.binding);
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

    for (const entry of this.entries) {
      const chords = entry.binding.chords;
      if (chords.length < sequence.length) continue;
      if (!sequence.every((c, i) => chords[i] === c)) continue;
      if (entry.when && !entry.when(context)) continue;
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
    if (exact) return { kind: 'match', binding: exact.binding };
    return { kind: 'none' };
  }

  /** Bindings for a command, most recent first (to display the active shortcut). */
  forCommand(command: string): Keybinding[] {
    return this.entries
      .filter((e) => e.binding.command === command)
      .sort((a, b) => b.order - a.order)
      .map((e) => e.binding);
  }
}
