<script lang="ts">
  import type { PanelSpec } from '../api';
  import type { Workbench } from '../app/workbench';

  let { workbench, panel }: { workbench: Workbench; panel: PanelSpec } = $props();

  let host: HTMLElement;

  $effect(() => {
    const content = panel.render(host);
    return () => content.dispose();
  });
</script>

<aside class="panel" aria-label={panel.title}>
  <header>
    <h2>{panel.title}</h2>
    <button
      aria-label="Fermer le panneau"
      title="Fermer"
      onclick={() => workbench.panels.hide(panel.id)}>×</button
    >
  </header>
  <div class="body" bind:this={host}></div>
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    flex: none;
    width: 320px;
    min-height: 0;
    background: var(--ui-bg);
    border-left: 1px solid var(--ui-border);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px 6px 12px;
    border-bottom: 1px solid var(--ui-border);
  }

  h2 {
    margin: 0;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  header button {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--ui-fg);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  header button:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
