import {
  defineExtension,
  type ExtensionContext,
  type GroupTarget,
  type OpenOptions,
} from '../../api';
import { parseSession, type Session, type SessionGroup, type SessionTab } from './session';

const FILE = 'session.json';
const SAVE_DELAY_MS = 1000;

async function restoreTab(ctx: ExtensionContext, tab: SessionTab): Promise<OpenOptions | null> {
  const view = { selection: tab.selection, scrollTop: tab.scrollTop };
  // Files shown by a viewer (images) are reopened as such, without reading them.
  const viewer = tab.path && tab.content === undefined ? ctx.viewers.replaceFor(tab.path) : null;
  if (viewer) return { path: tab.path, text: '', viewer: viewer.id };
  const disk = tab.path ? await ctx.fs.readTextFile(tab.path).catch(() => null) : null;
  if (tab.content === undefined) {
    // Saved file: reload it from disk, skip it if it is gone.
    if (!disk) return null;
    if (disk.binary) {
      const binary = ctx.viewers.binaryViewer();
      return binary && tab.path ? { path: tab.path, text: '', viewer: binary.id } : null;
    }
    const large = disk.text.length > ctx.settings.get<number>('files.largeFileSize') * 1024 * 1024;
    return { path: tab.path, ...disk, ...view, large };
  }
  // Unsaved changes: the session text on top of the file as saved (if any).
  return {
    path: tab.path,
    text: tab.content,
    savedText: disk && !disk.binary ? disk.text : '',
    encoding: tab.encoding ?? disk?.encoding,
    bom: tab.bom ?? disk?.bom,
    lineEnding: tab.lineEnding ?? disk?.lineEnding,
    ...view,
  };
}

function snapshot(ctx: ExtensionContext): Session {
  const ws = ctx.workspace;
  const all = ws.tabs();
  /** Documents shown by more than one tab get a key linking their tabs. */
  const shared = new Set(
    all.map((t) => t.documentId).filter((id, i, ids) => ids.indexOf(id) !== i),
  );
  const saved = new Set<string>();
  const groups: SessionGroup[] = [];
  let activeGroup = 0;

  for (const group of ws.groups()) {
    const tabs: SessionTab[] = [];
    let active = 0;
    for (const tab of group.tabs) {
      // The text of a document is stored once, with its first tab.
      const first = !saved.has(tab.documentId);
      saved.add(tab.documentId);
      const text = first && (!tab.path || tab.dirty) ? ws.getText(tab.id) : undefined;
      // An empty untitled tab is not worth restoring.
      if (!tab.path && first && text === '') continue;
      if (tab.id === group.active?.id) active = tabs.length;
      const entry: SessionTab = { path: tab.path, ...ws.viewState(tab.id) };
      if (shared.has(tab.documentId)) entry.doc = tab.documentId;
      if (text !== undefined) {
        entry.content = text;
        entry.encoding = tab.encoding;
        entry.bom = tab.bom;
        entry.lineEnding = tab.lineEnding;
      }
      tabs.push(entry);
    }
    if (tabs.length === 0) continue;
    if (group.id === ws.activeGroup()) activeGroup = groups.length;
    groups.push({ active, tabs });
  }
  return { version: 2, activeGroup, orientation: ws.orientation(), groups };
}

async function restore(ctx: ExtensionContext, session: Session): Promise<void> {
  const ws = ctx.workspace;
  /** Tab opened for each document key, to clone it into later groups. */
  const docs = new Map<string, string>();
  /** Active tab of each restored group, in order. */
  const actives: string[] = [];
  let activeTab: string | null = null;

  /** The existing (empty) group takes the first restored group; the others are created. */
  let existingUsed = false;
  for (const [index, group] of session.groups.entries()) {
    let groupId: string | null = null;
    const opened: string[] = [];
    for (const tab of group.tabs) {
      const target: GroupTarget = groupId ?? (existingUsed ? 'new' : ws.activeGroup());
      const source = tab.doc ? docs.get(tab.doc) : undefined;
      let id: string | null = null;
      if (source) {
        id = ws.clone(source, target)?.id ?? null;
      } else {
        const options = await restoreTab(ctx, tab);
        if (options) id = ws.open(options, target).id;
        if (id && tab.doc) docs.set(tab.doc, id);
      }
      if (!id) continue;
      groupId ??= ws.tabs().find((t) => t.id === id)?.groupId ?? null;
      existingUsed = true;
      opened.push(id);
    }
    const shown = opened[Math.min(group.active, opened.length - 1)];
    if (!shown) continue;
    ws.activate(shown);
    actives.push(shown);
    if (index === session.activeGroup) activeTab = shown;
  }
  ws.setOrientation(session.orientation);
  const focus = activeTab ?? actives[0];
  if (focus) ws.activate(focus);
}

/** Restores open tabs and split views, unsaved text, cursor and scroll at startup, like Notepad++. */
export default defineExtension({
  id: 'cascades.session',
  async activate(ctx) {
    ctx.settings.register('session', {
      restore: {
        type: 'boolean',
        default: true,
        description: 'Rouvrir les onglets, y compris non enregistrés, au démarrage.',
      },
    });

    const raw = await ctx.configFiles.read(FILE).catch(() => null);
    const session = raw && ctx.settings.get<boolean>('session.restore') ? parseSession(raw) : null;
    if (session) await restore(ctx, session);

    const save = () => ctx.configFiles.write(FILE, JSON.stringify(snapshot(ctx)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void save().catch((err: unknown) => console.error(err)),
        SAVE_DELAY_MS,
      );
    };
    ctx.subscriptions.add({ dispose: () => clearTimeout(timer) });

    ctx.events.on('editor.didUpdate', schedule);
    ctx.events.on('workspace.didOpen', schedule);
    ctx.events.on('workspace.didClose', schedule);
    ctx.events.on('workspace.didChangeActive', schedule);
    ctx.events.on('workspace.didChangeTab', schedule);
    ctx.app.onWillQuit(() => {
      clearTimeout(timer);
      return save();
    });
  },
});
