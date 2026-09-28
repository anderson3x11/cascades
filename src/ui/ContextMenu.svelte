<script lang="ts">
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  const menu = $derived(workbench.contextMenu.current);

  let box = $state<HTMLElement>();
  /** Where the menu fits in the window. */
  let position = $state({ x: 0, y: 0 });

  $effect(() => {
    if (!menu || !box) return;
    const { width, height } = box.getBoundingClientRect();
    position = {
      x: Math.min(menu.x, window.innerWidth - width - 4),
      y: Math.min(menu.y, window.innerHeight - height - 4),
    };
    box.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
  });

  $effect(() => {
    if (!menu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!box?.contains(e.target as Node)) workbench.contextMenu.close();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  });

  function onKeydown(event: KeyboardEvent) {
    const buttons = [...(box?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') workbench.contextMenu.close();
    else if (event.key === 'ArrowDown') buttons[(index + 1) % buttons.length]?.focus();
    else if (event.key === 'ArrowUp') buttons.at((index - 1) % buttons.length)?.focus();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
</script>

{#if menu}
  <div
    class="menu"
    role="menu"
    tabindex="-1"
    bind:this={box}
    style:left="{position.x}px"
    style:top="{position.y}px"
    onkeydown={onKeydown}
  >
    {#each menu.items as item, i (i)}
      {#if item === 'separator'}
        <div class="separator" role="separator"></div>
      {:else}
        <button
          role="menuitem"
          disabled={item.disabled}
          onclick={() => {
            workbench.contextMenu.close();
            item.run();
          }}
        >
          <span>{item.label}</span>
          {#if item.shortcut}<span class="shortcut">{item.shortcut}</span>{/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 250;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 4px;
    background: var(--menu-bg);
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    box-shadow: var(--menu-shadow);
    outline: none;
  }

  button {
    display: flex;
    gap: 24px;
    justify-content: space-between;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button:hover:not(:disabled),
  button:focus-visible {
    background: var(--menu-active-bg);
    color: var(--menu-active-fg);
    outline: none;
  }

  button:disabled {
    color: var(--ui-fg);
    opacity: 0.5;
    cursor: default;
  }

  .shortcut {
    opacity: 0.7;
  }

  .separator {
    height: 1px;
    margin: 4px 6px;
    background: var(--ui-border);
  }
</style>
