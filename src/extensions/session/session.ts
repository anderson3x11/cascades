import type { LineEnding } from '../../api';

export interface SessionTab {
  /** null for an untitled buffer. */
  path: string | null;
  /** Only for untitled or modified tabs: the unsaved text. */
  content?: string;
  encoding?: string;
  bom?: boolean;
  lineEnding?: LineEnding;
  selection: { anchor: number; head: number };
  scrollTop: number;
  /** Tabs of the same document (a clone in another group) share this key. */
  doc?: string;
}

export interface SessionGroup {
  /** Index of the active tab in `tabs`. */
  active: number;
  tabs: SessionTab[];
}

export interface Session {
  version: 2;
  /** Index of the active group. */
  activeGroup: number;
  orientation: 'row' | 'column';
  groups: SessionGroup[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function parseTab(raw: unknown): SessionTab | null {
  if (!isObject(raw)) return null;
  const { path, content, encoding, bom, lineEnding, selection, scrollTop, doc } = raw;
  if (path !== null && typeof path !== 'string') return null;
  if (content !== undefined && typeof content !== 'string') return null;
  // An untitled tab needs its text, unless it is a clone of a tab that has it.
  if (path === null && content === undefined && typeof doc !== 'string') return null;
  const tab: SessionTab = {
    path,
    selection: { anchor: 0, head: 0 },
    scrollTop: isCount(scrollTop) ? scrollTop : 0,
  };
  if (content !== undefined) tab.content = content;
  if (typeof encoding === 'string') tab.encoding = encoding;
  if (typeof bom === 'boolean') tab.bom = bom;
  if (lineEnding === 'lf' || lineEnding === 'crlf') tab.lineEnding = lineEnding;
  if (typeof doc === 'string') tab.doc = doc;
  if (isObject(selection) && isCount(selection.anchor) && isCount(selection.head)) {
    tab.selection = { anchor: selection.anchor, head: selection.head };
  }
  return tab;
}

function parseGroup(raw: unknown): SessionGroup | null {
  if (!isObject(raw) || !Array.isArray(raw.tabs)) return null;
  const tabs = raw.tabs.map(parseTab).filter((t): t is SessionTab => t !== null);
  if (tabs.length === 0) return null;
  return { active: isCount(raw.active) && raw.active < tabs.length ? raw.active : 0, tabs };
}

/**
 * Parses session.json, dropping invalid tabs and empty groups. Reads the
 * version 1 format (one list of tabs) too. Null when the file is unusable.
 */
export function parseSession(json: string): Session | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;
  let groups: SessionGroup[];
  let activeGroup = 0;
  if (raw.version === 1 && Array.isArray(raw.tabs)) {
    const group = parseGroup({ active: raw.active, tabs: raw.tabs });
    groups = group ? [group] : [];
  } else if (raw.version === 2 && Array.isArray(raw.groups)) {
    groups = raw.groups.map(parseGroup).filter((g): g is SessionGroup => g !== null);
    if (isCount(raw.activeGroup) && raw.activeGroup < groups.length) activeGroup = raw.activeGroup;
  } else {
    return null;
  }
  const orientation = raw.orientation === 'column' ? 'column' : 'row';
  return { version: 2, activeGroup, orientation, groups };
}
