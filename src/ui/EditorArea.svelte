<script lang="ts">
  import type { ViewerSpec } from '../api';
  import type { Workbench } from '../app/workbench';
  import EditorHost from './EditorHost.svelte';
  import PreviewPane from './PreviewPane.svelte';

  let { workbench, zen = false }: { workbench: Workbench; zen?: boolean } = $props();

  const ws = $derived(workbench.workspace);
  const viewers = $derived(workbench.viewers);
  const tab = $derived(ws.tabs.find((t) => t.id === ws.activeId) ?? null);

  const spec = $derived.by((): ViewerSpec | null => {
    void viewers.version;
    if (!tab) return null;
    if (tab.viewer) return viewers.get(tab.viewer) ?? null;
    return viewers.previewFor(tab);
  });

  /** A viewer tab (image) always shows its viewer alone. */
  const mode = $derived(!tab || !spec ? 'off' : tab.viewer ? 'full' : viewers.previewMode(tab.id));

  let area: HTMLElement;

  function onDividerDown(event: PointerEvent) {
    const divider = event.currentTarget as HTMLElement;
    divider.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const rect = area.getBoundingClientRect();
      viewers.split = Math.min(0.85, Math.max(0.15, (e.clientX - rect.left) / rect.width));
    };
    const up = () => {
      divider.removeEventListener('pointermove', move);
      divider.removeEventListener('pointerup', up);
    };
    divider.addEventListener('pointermove', move);
    divider.addEventListener('pointerup', up);
  }
</script>

<div class="area" bind:this={area}>
  <div
    class="editor"
    class:hidden={mode === 'full'}
    style:flex={mode === 'side' ? `0 0 ${viewers.split * 100}%` : null}
  >
    <EditorHost {workbench} {zen} />
  </div>
  {#if mode === 'side'}
    <div
      class="divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionner l’aperçu"
      onpointerdown={onDividerDown}
      ondblclick={() => (viewers.split = 0.5)}
    ></div>
  {/if}
  {#if mode !== 'off' && spec && tab}
    {#key `${tab.id}:${spec.id}`}
      <PreviewPane {workbench} {spec} tabId={tab.id} />
    {/key}
  {/if}
</div>

<style>
  .area {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .editor {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .editor.hidden {
    display: none;
  }

  .divider {
    flex: none;
    width: 5px;
    margin: 0 -2px;
    z-index: 1;
    cursor: col-resize;
    background: linear-gradient(
      to right,
      transparent 2px,
      var(--ui-border) 2px,
      var(--ui-border) 3px,
      transparent 3px
    );
  }

  .divider:hover {
    background: var(--accent);
  }
</style>
