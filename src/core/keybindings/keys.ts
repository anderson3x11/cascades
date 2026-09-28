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

/** Normalizes one chord, e.g. "Shift+Ctrl+p" -> "ctrl+shift+p". */
export function normalizeChord(chord: string): string {
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

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** Returns the normalized chord for a keyboard event, or null for a lone modifier press. */
export function chordFromEvent(event: KeyEventLike): string | null {
  const key = normalizeKey(event.key);
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
