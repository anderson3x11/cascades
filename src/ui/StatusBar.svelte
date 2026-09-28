<script lang="ts">
  import type { StatusBarItem } from '../app/status-bar.svelte';
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  const model = $derived(workbench.statusBar);

  const left = $derived(model.items.filter((i) => i.visible && i.alignment === 'left'));
  const right = $derived(model.items.filter((i) => i.visible && i.alignment === 'right'));

  function run(item: StatusBarItem) {
    if (!item.command) return;
    workbench.commands.execute(item.command).catch((err: unknown) => console.error(err));
  }
</script>

{#snippet entry(item: StatusBarItem)}
  {#if item.command}
    <button class="item" title={item.tooltip} onclick={() => run(item)}>{item.text}</button>
  {:else}
    <span class="item" title={item.tooltip}>{item.text}</span>
  {/if}
{/snippet}

<footer>
  <div class="side">
    {#each left as item (item.id)}{@render entry(item)}{/each}
  </div>
  <div class="side">
    {#each right as item (item.id)}{@render entry(item)}{/each}
  </div>
</footer>

<style>
  footer {
    display: flex;
    justify-content: space-between;
    height: 24px;
    padding: 0 8px;
    background: var(--ui-bg);
    border-top: 1px solid var(--ui-border);
    color: var(--ui-fg);
    font-size: 12px;
  }

  .side {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .item {
    padding: 0 6px;
    white-space: nowrap;
  }

  button.item {
    height: 100%;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  button.item:hover {
    background: var(--ui-border);
  }
</style>
