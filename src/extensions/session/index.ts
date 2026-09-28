import { defineExtension, type ExtensionContext, type OpenOptions } from '../../api';
import { parseSession, type Session, type SessionTab } from './session';

const FILE = 'session.json';
const SAVE_DELAY_MS = 1000;

async function restoreTab(ctx: ExtensionContext, tab: SessionTab): Promise<OpenOptions | null> {
  const view = { selection: tab.selection, scrollTop: tab.scrollTop };
  const disk = tab.path ? await ctx.fs.readTextFile(tab.path).catch(() => null) : null;
  if (tab.content === undefined) {
    // Saved file: reload it from disk, skip it if it is gone.
    if (!disk || disk.binary) return null;
    return { path: tab.path, ...disk, ...view };
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
  const tabs: SessionTab[] = [];
  let active = 0;
  for (const tab of ctx.workspace.tabs()) {
    const text = !tab.path || tab.dirty ? ctx.workspace.getText(tab.id) : undefined;
    // An empty untitled tab is not worth restoring.
    if (!tab.path && text === '') continue;
    if (tab.id === ctx.workspace.active()?.id) active = tabs.length;
    const entry: SessionTab = { path: tab.path, ...ctx.workspace.viewState(tab.id) };
    if (text !== undefined) {
      entry.content = text;
      entry.encoding = tab.encoding;
      entry.bom = tab.bom;
      entry.lineEnding = tab.lineEnding;
    }
    tabs.push(entry);
  }
  return { version: 1, active, tabs };
}

/** Restores open tabs, unsaved text, cursor and scroll at startup, like Notepad++. */
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
    if (session) {
      const opened: string[] = [];
      for (const tab of session.tabs) {
        const options = await restoreTab(ctx, tab);
        opened.push(options ? ctx.workspace.open(options).id : '');
      }
      const active = opened[session.active];
      if (active) ctx.workspace.activate(active);
    }

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
