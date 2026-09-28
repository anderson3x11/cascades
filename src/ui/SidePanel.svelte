<script lang="ts">
  import type { PanelSide, PanelSpec } from '../api';
  import type { Workbench } from '../app/workbench';

  let { workbench, panel, side }: { workbench: Workbench; panel: PanelSpec; side: PanelSide } =
    $props();

  let host: HTMLElement;

  /** The panels of this side, shown as tabs when there are several. */
  const siblings = $derived(workbench.panels.of(side));
  const actions = $derived(panel.actions?.() ?? []);

  $effect(() => {
    const content = panel.render(host);
    return () => content.dispose();
  });
</script>

<aside class="panel {side}" aria-label={panel.title}>
  <header>
    {#if siblings.length > 1}
      <div class="tabs" role="tablist">
        {#each siblings as sibling (sibling.id)}
          <button
            role="tab"
            class="tab"
            aria-selected={sibling.id === panel.id}
            onclick={() => workbench.panels.show(sibling.id)}>{sibling.title}</button
          >
        {/each}
      </div>
    {:else}
      <h2>{panel.title}</h2>
    {/if}
    <span class="actions">
      {#each actions as action (action.label)}
        <button class="action" title={action.label} aria-label={action.label} onclick={action.run}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d={action.icon} /></svg>
        </button>
      {/each}
    </span>
    <button
      class="close"
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
  }

  .panel.right {
    border-left: 1px solid var(--ui-border);
  }

  .panel.left {
    width: 260px;
    border-right: 1px solid var(--ui-border);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px 6px 12px;
    border-bottom: 1px solid var(--ui-border);
  }

  h2,
  .tab {
    margin: 0;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .tabs {
    display: flex;
    gap: 2px;
    margin-left: -6px;
  }

  .tab {
    padding: 3px 6px;
    border: none;
    border-radius: 4px;
    background: none;
    font-family: inherit;
    cursor: pointer;
  }

  .tab:hover {
    color: var(--fg);
  }

  .tab[aria-selected='true'] {
    color: var(--fg);
    box-shadow: inset 0 -2px 0 var(--accent);
    border-radius: 0;
  }

  .actions {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .action {
    display: grid;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--ui-fg);
    cursor: pointer;
    place-items: center;
  }

  .action:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .action svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.2;
  }

  .close {
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

  .close:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
