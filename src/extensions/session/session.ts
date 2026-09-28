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
}

export interface Session {
  version: 1;
  /** Index of the active tab in `tabs`. */
  active: number;
  tabs: SessionTab[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function parseTab(raw: unknown): SessionTab | null {
  if (!isObject(raw)) return null;
  const { path, content, encoding, bom, lineEnding, selection, scrollTop } = raw;
  if (path !== null && typeof path !== 'string') return null;
  if (content !== undefined && typeof content !== 'string') return null;
  if (path === null && content === undefined) return null;
  const tab: SessionTab = {
    path,
    selection: { anchor: 0, head: 0 },
    scrollTop: isCount(scrollTop) ? scrollTop : 0,
  };
  if (content !== undefined) tab.content = content;
  if (typeof encoding === 'string') tab.encoding = encoding;
  if (typeof bom === 'boolean') tab.bom = bom;
  if (lineEnding === 'lf' || lineEnding === 'crlf') tab.lineEnding = lineEnding;
  if (isObject(selection) && isCount(selection.anchor) && isCount(selection.head)) {
    tab.selection = { anchor: selection.anchor, head: selection.head };
  }
  return tab;
}

/** Parses session.json, dropping invalid tabs. Null when the file is unusable. */
export function parseSession(json: string): Session | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(raw) || raw.version !== 1 || !Array.isArray(raw.tabs)) return null;
  const tabs = raw.tabs.map(parseTab).filter((t): t is SessionTab => t !== null);
  const active = isCount(raw.active) && raw.active < tabs.length ? raw.active : 0;
  return { version: 1, active, tabs };
}
