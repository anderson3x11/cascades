<script lang="ts">
  import { onMount } from 'svelte';
  import type { ViewerInstance, ViewerSpec } from '../api';
  import type { Workbench } from '../app/workbench';

  let { workbench, spec, tabId }: { workbench: Workbench; spec: ViewerSpec; tabId: string } =
    $props();

  /** Typing is followed with a short delay so a big document does not re-render on each key. */
  const UPDATE_DELAY_MS = 150;

  let host: HTMLElement;
  let error = $state<string | null>(null);
  let loading = $state(true);

  onMount(() => {
    const ws = workbench.workspace;
    let instance: ViewerInstance | null = null;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;

    const input = () => {
      const tab = ws.tabs.find((t) => t.id === tabId);
      return { path: tab?.path ?? null, text: tab?.viewer ? '' : ws.getText(tabId) };
    };

    // Follow the editor: the first visible line is sent to the viewer.
    const view = ws.editorView();
    const syncScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!view || !instance?.scrollToLine) return;
        const height = view.scrollDOM.scrollTop - view.documentPadding.top;
        const top = view.lineBlockAtHeight(Math.max(0, height)).from;
        instance.scrollToLine(view.state.doc.lineAt(top).number);
      });
    };

    workbench.viewers
      .load(spec)
      .then((factory) => {
        if (disposed) return;
        loading = false;
        instance = factory.create(host, input());
        syncScroll();
      })
      .catch((err: unknown) => {
        loading = false;
        error = `Impossible de charger l’aperçu : ${err instanceof Error ? err.message : String(err)}`;
      });

    const updates = workbench.events.on('editor.didUpdate', ({ tab, docChanged }) => {
      if (tab.id !== tabId || !docChanged) return;
      clearTimeout(timer);
      timer = setTimeout(() => instance?.update(input()), UPDATE_DELAY_MS);
    });
    const renames = workbench.events.on('workspace.didChangeTab', (tab) => {
      if (tab.id === tabId) instance?.update(input());
    });
    view?.scrollDOM.addEventListener('scroll', syncScroll, { passive: true });

    return () => {
      disposed = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      updates.dispose();
      renames.dispose();
      view?.scrollDOM.removeEventListener('scroll', syncScroll);
      instance?.dispose();
    };
  });
</script>

<section class="preview" aria-label="Aperçu : {spec.title}">
  {#if error}
    <p class="message">{error}</p>
  {:else if loading}
    <p class="message">Chargement…</p>
  {/if}
  <div class="host" bind:this={host}></div>
</section>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }

  .host {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .message {
    margin: 16px;
    color: var(--ui-fg);
  }
</style>
