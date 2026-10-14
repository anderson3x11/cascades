<script lang="ts">
  import type { StatusBarItem } from '../app/status-bar.svelte';
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  const model = $derived(workbench.statusBar);

  const side = (alignment: StatusBarItem['alignment']) =>
    model.items.filter((i) => i.visible && i.alignment === alignment);
  const left = $derived(side('left'));
  const center = $derived(side('center'));
  const right = $derived(side('right'));

  /** An item with a menu shows it in the side panel; the others run their command. */
  function activate(item: StatusBarItem) {
    if (item.menu) model.onDidRequestMenu.fire(item.id);
    else if (item.command) {
      workbench.commands.execute(item.command).catch((err: unknown) => console.error(err));
    }
  }
</script>

{#snippet entry(item: StatusBarItem)}
  {#if item.command || item.menu}
    <button class="item" title={item.tooltip} onclick={() => activate(item)}>
      {#if item.icon}<svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon} /></svg>{/if}
      {item.text}
    </button>
  {:else}
    <span class="item" title={item.tooltip}>{item.text}</span>
  {/if}
{/snippet}

<footer>
  <div class="side">
    {#each left as item (item.id)}{@render entry(item)}{/each}
  </div>
  <div class="side center">
    {#each center as item (item.id)}{@render entry(item)}{/each}
  </div>
  <div class="side end">
    {#each right as item (item.id)}{@render entry(item)}{/each}
  </div>
</footer>

<style>
  footer {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 30px;
    padding: 0 8px;
    background: var(--ui-bg);
    color: var(--ui-fg);
    font-size: 12px;
  }

  .side {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  .center {
    gap: 4px;
  }

  .end {
    justify-content: flex-end;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 7px;
    white-space: nowrap;
  }

  button.item {
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background-color 120ms;
  }

  button.item:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  button.item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }
</style>
