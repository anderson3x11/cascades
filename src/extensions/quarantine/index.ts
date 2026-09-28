import { invertedEffects } from '@codemirror/commands';
import { StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { defineExtension, type TabInfo } from '../../api';
import { formatAge } from './age';
import { passagesToQuarantine } from './extract';
import { QuarantineStore, type Snippet } from './store';
import './quarantine.css';

const FILE = 'quarantine.json';
const PANEL = 'quarantine';
const SAVE_DELAY_MS = 500;
/** Pointer travel before a card starts being dragged. */
const DRAG_THRESHOLD = 5;

/** Untitled buffers are kept by tab until they get a path. */
const keyOf = (tab: TabInfo) => tab.path ?? `untitled:${tab.id}`;

/** Snippets moving between a file and its quarantine, with their place in the list. */
interface Moved {
  key: string;
  items: { snippet: Snippet; index: number }[];
}

/**
 * Effects carried by the edits that move text in or out of the quarantine.
 * Undo applies the inverted effect (see invertedEffects), so Ctrl+Z and
 * Ctrl+Y keep the file and the quarantine in step.
 */
const intoQuarantine = StateEffect.define<Moved>();
const outOfQuarantine = StateEffect.define<Moved>();

/** A deleted card, which the panel offers to bring back (not an edit, so not in Ctrl+Z). */
interface Deleted {
  key: string;
  snippet: Snippet;
  index: number;
}

/**
 * "Quarantaine": passages set aside from a file, kept per file (never in the
 * file itself) and put back anywhere, by button or by dragging a card.
 */
export default defineExtension({
  id: 'cascades.quarantine',
  async activate(ctx) {
    const store = new QuarantineStore();
    try {
      store.load(JSON.parse((await ctx.configFiles.read(FILE)) ?? '{}'));
    } catch {
      // A broken file starts an empty quarantine rather than blocking the app.
    }

    const listeners = new Set<() => void>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: Deleted | null = null;

    const changed = () => {
      for (const listener of listeners) listener();
      clearTimeout(timer);
      timer = setTimeout(() => {
        const data = store.toJSON((key) => !key.startsWith('untitled:'));
        void ctx.configFiles.write(FILE, JSON.stringify(data));
      }, SAVE_DELAY_MS);
    };
    ctx.subscriptions.add({ dispose: () => clearTimeout(timer) });

    // Follow renames: an untitled buffer saved, or "save as".
    const keys = new Map<string, string>();
    for (const tab of ctx.workspace.tabs()) keys.set(tab.id, keyOf(tab));
    ctx.events.on('workspace.didOpen', (tab) => keys.set(tab.id, keyOf(tab)));
    ctx.events.on('workspace.didChangeTab', (tab) => {
      const before = keys.get(tab.id);
      const after = keyOf(tab);
      keys.set(tab.id, after);
      if (before && before !== after) {
        store.rename(before, after);
        changed();
      }
    });
    ctx.events.on('workspace.didChangeActive', () => changed());

    /** Active text tab and its view, or null (no tab, image tab). */
    const target = (): { tab: TabInfo; view: EditorView } | null => {
      const tab = ctx.workspace.active();
      const view = ctx.editor.view();
      return tab && view && !tab.viewer ? { tab, view } : null;
    };

    /** Applies what an undone or redone quarantine edit implies for the cards. */
    const replay = (effect: StateEffect<unknown>) => {
      if (effect.is(intoQuarantine)) {
        // Redo of "set aside": the cards come back at their places.
        const { key, items } = effect.value;
        for (const { snippet, index } of [...items].sort((a, b) => a.index - b.index)) {
          store.restore(key, snippet, index);
        }
      } else if (effect.is(outOfQuarantine)) {
        // Undo of "set aside", or redo of "reinsert": the cards leave the list.
        const { key, items } = effect.value;
        for (const { snippet } of items) store.remove(key, snippet.id);
      } else {
        return;
      }
      changed();
    };

    ctx.editor.addExtension(() => [
      invertedEffects.of((tr) =>
        tr.effects.flatMap((e) =>
          e.is(intoQuarantine)
            ? [outOfQuarantine.of(e.value)]
            : e.is(outOfQuarantine)
              ? [intoQuarantine.of(e.value)]
              : [],
        ),
      ),
      EditorView.updateListener.of((update) => {
        for (const tr of update.transactions) {
          if (tr.isUserEvent('undo') || tr.isUserEvent('redo')) tr.effects.forEach(replay);
        }
      }),
    ]);

    /**
     * Puts a card back at `pos` (the cursor by default). At the start of a line
     * it goes in as whole lines, so a passage taken as a line comes back as one.
     */
    const reinsert = (snippet: Snippet, pos?: number) => {
      const t = target();
      if (!t) return;
      const key = keyOf(t.tab);
      const removed = store.remove(key, snippet.id);
      if (!removed) return;
      const { view } = t;
      const at = pos ?? view.state.selection.main.head;
      const line = view.state.doc.lineAt(at);
      const asLine = at === line.from && line.length > 0 && !snippet.text.endsWith('\n');
      const inserted = asLine ? `${snippet.text}\n` : snippet.text;
      view.dispatch({
        changes: { from: at, insert: inserted },
        selection: { anchor: at + inserted.length },
        effects: outOfQuarantine.of({ key, items: [removed] }),
        scrollIntoView: true,
        userEvent: 'input.quarantine',
      });
      view.focus();
      last = null;
      changed();
    };

    const remove = (snippet: Snippet) => {
      const t = target();
      if (!t) return;
      const key = keyOf(t.tab);
      const removed = store.remove(key, snippet.id);
      if (!removed) return;
      last = { key, ...removed };
      changed();
    };

    const undoDelete = () => {
      if (!last) return;
      store.restore(last.key, last.snippet, last.index);
      last = null;
      changed();
    };

    ctx.commands.register(
      'quarantine.add',
      () => {
        const t = target();
        if (!t) return;
        const passages = passagesToQuarantine(t.view.state);
        if (passages.length === 0) return;
        // Added last to first, so the list shows them in document order.
        const key = keyOf(t.tab);
        const added = [...passages].reverse().map((p) => store.add(key, p.text, p.line));
        const list = store.list(key);
        const items = added.map((snippet) => ({ snippet, index: list.indexOf(snippet) }));
        t.view.dispatch({
          changes: passages.map(({ from, to }) => ({ from, to })),
          effects: intoQuarantine.of({ key, items }),
          userEvent: 'delete.quarantine',
        });
        last = null;
        ctx.panels.show(PANEL);
        changed();
      },
      { title: 'Mettre en quarantaine', category: 'Édition' },
    );
    ctx.commands.register('quarantine.togglePanel', () => ctx.panels.toggle(PANEL), {
      title: 'Panneau de quarantaine',
      category: 'Affichage',
    });
    ctx.keybindings.register([
      { key: 'Leader Q', command: 'quarantine.add' },
      { key: 'Leader Shift+Q', command: 'quarantine.togglePanel' },
    ]);
    ctx.menus.registerItem('edit', { command: 'quarantine.add', group: '5_quarantine', order: 1 });
    ctx.menus.registerItem('view', {
      command: 'quarantine.togglePanel',
      group: '1_preview',
      order: 3,
    });

    // Panel -------------------------------------------------------------------

    /** Drags a card into the text with the pointer, showing where it will land. */
    const startDrag = (card: HTMLElement, snippet: Snippet, down: PointerEvent) => {
      const startX = down.clientX;
      const startY = down.clientY;
      let ghost: HTMLElement | null = null;
      let caret: HTMLElement | null = null;
      let pos: number | null = null;

      const move = (e: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
          ghost = document.createElement('div');
          ghost.className = 'qx-ghost';
          ghost.textContent = snippet.text.split('\n')[0] ?? '';
          caret = document.createElement('div');
          caret.className = 'qx-caret';
          document.body.append(ghost, caret);
          card.classList.add('dragging');
        }
        ghost.style.left = `${e.clientX + 12}px`;
        ghost.style.top = `${e.clientY + 8}px`;
        const view = target()?.view;
        const rect = view?.scrollDOM.getBoundingClientRect();
        const inside =
          rect &&
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        pos = view && inside ? view.posAtCoords({ x: e.clientX, y: e.clientY }) : null;
        const coords = view && pos !== null ? view.coordsAtPos(pos) : null;
        if (caret) {
          caret.hidden = !coords;
          if (coords) {
            caret.style.left = `${coords.left - 1}px`;
            caret.style.top = `${coords.top}px`;
            caret.style.height = `${coords.bottom - coords.top}px`;
          }
        }
      };

      const end = () => {
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerup', end);
        card.removeEventListener('pointercancel', end);
        card.classList.remove('dragging');
        ghost?.remove();
        caret?.remove();
        if (ghost && pos !== null) reinsert(snippet, pos);
      };

      card.setPointerCapture(down.pointerId);
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerup', end);
      card.addEventListener('pointercancel', end);
    };

    const button = (label: string, run: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onpointerdown = (e) => e.stopPropagation();
      b.onclick = run;
      return b;
    };

    const renderCard = (snippet: Snippet): HTMLElement => {
      const card = document.createElement('article');
      card.className = 'qx-card';
      card.title = 'Glisser dans le texte pour le replacer';
      const text = document.createElement('pre');
      text.className = 'qx-text';
      text.textContent = snippet.text;
      const meta = document.createElement('div');
      meta.className = 'qx-meta';
      meta.textContent = `ligne ${snippet.line} · ${formatAge(snippet.createdAt)}`;

      const del = button('Supprimer', () => {
        // First click arms, second confirms.
        if (del.dataset.armed) remove(snippet);
        else {
          del.dataset.armed = '1';
          del.textContent = 'Confirmer ?';
          setTimeout(() => {
            delete del.dataset.armed;
            del.textContent = 'Supprimer';
          }, 3000);
        }
      });
      const actions = document.createElement('div');
      actions.className = 'qx-actions';
      actions.append(
        button('Réinsérer au curseur', () => reinsert(snippet)),
        button('Copier', () => void navigator.clipboard.writeText(snippet.text)),
        del,
      );
      card.append(text, meta, actions);
      card.addEventListener('pointerdown', (e) => {
        if (e.button === 0) startDrag(card, snippet, e);
      });
      return card;
    };

    ctx.panels.register({
      id: PANEL,
      title: 'Quarantaine',
      render(host) {
        const root = document.createElement('div');
        root.className = 'qx-panel';
        host.append(root);

        const draw = () => {
          const t = target();
          const snippets = t ? store.list(keyOf(t.tab)) : [];
          const children: HTMLElement[] = [];
          const intro = document.createElement('p');
          intro.className = 'qx-intro';
          if (!t) {
            intro.textContent = 'Ouvre un fichier texte pour voir sa quarantaine.';
          } else if (snippets.length === 0) {
            const key = ctx.keybindings.label('quarantine.add');
            intro.textContent = `Aucun passage de côté pour « ${t.tab.title} ». Sélectionne du texte puis ${key ?? 'Édition > Mettre en quarantaine'}.`;
          } else {
            intro.textContent = `${snippets.length} passage${snippets.length > 1 ? 's' : ''} de côté pour « ${t.tab.title} ». Glisse une carte dans le texte pour la replacer.`;
          }
          children.push(intro, ...snippets.map(renderCard));
          if (last && t && last.key === keyOf(t.tab)) {
            const bar = document.createElement('div');
            bar.className = 'qx-undo';
            bar.append('Passage supprimé.', button('Annuler', undoDelete));
            children.push(bar);
          }
          root.replaceChildren(...children);
        };

        draw();
        listeners.add(draw);
        // Ages ("il y a 3 min") stay current.
        const clock = setInterval(draw, 60_000);
        return {
          dispose: () => {
            listeners.delete(draw);
            clearInterval(clock);
            root.remove();
          },
        };
      },
    });
  },
});
