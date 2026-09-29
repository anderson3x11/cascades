import { mount, tick, unmount } from 'svelte';
import { defineExtension, t } from '../../api';
import { SearchModel } from './model.svelte';
import SearchView from './SearchView.svelte';

const PANEL = 'search';

/** Search and replace in the files of the folders open in the explorer. */
export default defineExtension({
  id: 'cascades.search',
  activate(ctx) {
    const model = new SearchModel(ctx);

    ctx.panels.register({
      id: PANEL,
      title: t('Search'),
      side: 'left',
      actions: () => [
        {
          label: t('Search again'),
          icon: 'M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5',
          run: () => void model.search(),
        },
        {
          label: t('Collapse all'),
          icon: 'M4 10l4-4 4 4',
          run: () => model.results.forEach((f) => model.collapsed.add(f.path)),
        },
      ],
      render(host) {
        const view = mount(SearchView, { target: host, props: { ctx, model } });
        return { dispose: () => void unmount(view) };
      },
    });

    ctx.commands.register(
      'search.inFiles',
      async () => {
        // The selected text, if on one line, is what to look for.
        const state = ctx.editor.state();
        const range = state?.selection.main;
        if (state && range && !range.empty) {
          const selected = state.sliceDoc(range.from, range.to);
          if (!selected.includes('\n')) {
            model.query = selected;
            void model.search();
          }
        }
        ctx.panels.show(PANEL);
        await tick();
        const input = document.querySelector<HTMLInputElement>('.search input.query');
        input?.focus();
        input?.select();
      },
      { title: t('Search in files…'), category: t('Edit') },
    );
    ctx.keybindings.register({ key: 'Ctrl+Shift+F', command: 'search.inFiles' });
    ctx.menus.registerItem('edit', { command: 'search.inFiles', group: '2_find', order: 10 });
  },
});
