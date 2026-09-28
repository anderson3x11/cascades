import { defineExtension } from '../../api';
import { countChars, countWords } from './counts';

const COUNT_DELAY_MS = 200;

export default defineExtension({
  id: 'cascades.status-bar',
  activate(ctx) {
    const position = ctx.statusBar.addItem({ id: 'position', alignment: 'left', priority: 100 });
    const counts = ctx.statusBar.addItem({ id: 'counts', alignment: 'left', priority: 90 });
    const language = ctx.statusBar.addItem({ id: 'language', alignment: 'right', priority: 30 });
    const encoding = ctx.statusBar.addItem({ id: 'encoding', alignment: 'right', priority: 20 });
    const eol = ctx.statusBar.addItem({ id: 'eol', alignment: 'right', priority: 10 });

    const updatePosition = () => {
      const state = ctx.editor.state();
      if (!state) return;
      const main = state.selection.main;
      const line = state.doc.lineAt(main.head);
      const selected = state.selection.ranges.reduce((n, r) => n + (r.to - r.from), 0);
      position.text =
        `Ln ${line.number}, Col ${main.head - line.from + 1}` +
        (selected > 0 ? ` (${selected} sélectionnés)` : '') +
        (state.selection.ranges.length > 1 ? ` · ${state.selection.ranges.length} curseurs` : '');
    };

    // Counting walks the whole document, so it is debounced.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const updateCounts = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const state = ctx.editor.state();
        if (!state) return;
        const text = state.doc.toString();
        counts.text = `${countWords(text)} mots, ${countChars(text)} caractères`;
      }, COUNT_DELAY_MS);
    };
    ctx.subscriptions.add({ dispose: () => clearTimeout(timer) });

    const updateFile = () => {
      const tab = ctx.workspace.active();
      if (!tab) return;
      language.text = tab.language;
      encoding.text = tab.encoding.toUpperCase() + (tab.bom ? ' BOM' : '');
      eol.text = tab.lineEnding.toUpperCase();
    };

    const updateAll = () => {
      updatePosition();
      updateCounts();
      updateFile();
    };

    ctx.events.on('editor.didUpdate', ({ docChanged }) => {
      updatePosition();
      if (docChanged) updateCounts();
    });
    ctx.events.on('workspace.didChangeActive', updateAll);
    ctx.events.on('workspace.didChangeTab', (tab) => {
      if (tab.id === ctx.workspace.active()?.id) updateFile();
    });
    updateAll();
  },
});
