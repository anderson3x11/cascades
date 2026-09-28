/**
 * Key notation: chords are `Mod+Mod+key`, sequences are chords separated by spaces.
 *   "Ctrl+Shift+P", "Ctrl+K Ctrl+S", "Ctrl+K Z"
 * Everything is normalized to lower case with a fixed modifier order.
 */

const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'] as const;
type Modifier = (typeof MODIFIER_ORDER)[number];

const MODIFIER_ALIASES: Record<string, Modifier> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  win: 'meta',
  super: 'meta',
};

const KEY_ALIASES: Record<string, string> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  ' ': 'space',
  spacebar: 'space',
  plus: '+',
};

function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

/** Placeholder chord for the configurable leader key ("Leader Z"). */
export const LEADER = 'leader';

/** Normalizes one chord, e.g. "Shift+Ctrl+p" -> "ctrl+shift+p". */
export function normalizeChord(chord: string): string {
  if (chord.trim().toLowerCase() === LEADER) return LEADER;
  // Split on '+' but keep a literal trailing '+' key ("Ctrl++").
  const parts = chord.trim().split(/\+(?!$)/);
  const key = parts.pop();
  if (!key) throw new Error(`Invalid chord: '${chord}'`);
  const mods = new Set<Modifier>();
  for (const part of parts) {
    const mod = MODIFIER_ALIASES[part.toLowerCase()];
    if (!mod) throw new Error(`Unknown modifier '${part}' in '${chord}'`);
    mods.add(mod);
  }
  return [...MODIFIER_ORDER.filter((m) => mods.has(m)), normalizeKey(key)].join('+');
}

/** Parses "Ctrl+K Ctrl+S" into ["ctrl+k", "ctrl+s"]. */
export function parseKeySequence(sequence: string): string[] {
  const chords = sequence.trim().split(/\s+/).filter(Boolean);
  if (chords.length === 0) throw new Error('Empty key sequence');
  return chords.map(normalizeChord);
}

const KEY_LABELS: Record<string, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  escape: 'Échap',
  enter: 'Entrée',
  space: 'Espace',
};

/** Human readable form of normalized chords: ["ctrl+k", "z"] -> "Ctrl+K Z". */
export function formatKeySequence(chords: readonly string[]): string {
  return chords
    .map((chord) =>
      chord
        .split(/\+(?!$)/)
        .map((part) => KEY_LABELS[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
        .join('+'),
    )
    .join(' ');
}

export interface KeyEventLike {
  key: string;
  /** Physical key ("Digit0"), used for digits on layouts where they need Shift (AZERTY). */
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** Returns the normalized chord for a keyboard event, or null for a lone modifier press. */
export function chordFromEvent(event: KeyEventLike): string | null {
  let key = normalizeKey(event.key);
  // On AZERTY the top-row digits need Shift: Ctrl + "0" key gives "à". With
  // Ctrl or Alt held, use the digit printed on the physical key instead.
  const digit = /^Digit(\d)$/.exec(event.code ?? '')?.[1];
  if (digit && (event.ctrlKey || event.altKey) && !/^\d$/.test(key)) key = digit;
  if (['control', 'alt', 'shift', 'meta', 'altgraph', 'os', 'dead', 'unidentified'].includes(key)) {
    return null;
  }
  const mods: Modifier[] = [];
  if (event.ctrlKey) mods.push('ctrl');
  if (event.altKey) mods.push('alt');
  if (event.shiftKey) mods.push('shift');
  if (event.metaKey) mods.push('meta');
  return [...mods, key].join('+');
}
