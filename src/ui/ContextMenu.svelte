<script lang="ts">
  import type { ContextMenuItem } from '../api';
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  const menu = $derived(workbench.contextMenu.current);
  /** Items with a check keep a column for it, so the labels line up. */
  const checks = $derived(menu?.items.some((i) => typeof i === 'object' && 'checked' in i));

  let box = $state<HTMLElement>();
  /** Where the menu fits in the window. */
  let position = $state({ x: 0, y: 0 });

  $effect(() => {
    if (!menu || !box) return;
    const { width, height } = box.getBoundingClientRect();
    position = {
      x: Math.max(4, Math.min(menu.x, window.innerWidth - width - 4)),
      y: Math.max(4, Math.min(menu.y, window.innerHeight - height - 4)),
    };
    const buttons = box.querySelectorAll<HTMLElement>('button:not(:disabled)');
    const first = box.querySelector<HTMLElement>('button[aria-checked="true"]') ?? buttons[0];
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: 'nearest' });
  });

  $effect(() => {
    if (!menu) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!box?.contains(target)) {
        workbench.contextMenu.close();
      }
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

  const isHeading = (item: ContextMenuItem): item is { heading: string } =>
    typeof item === 'object' && 'heading' in item;
</script>

{#if menu}
  <div
    class="menu"
    class:checks
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
      {:else if isHeading(item)}
        <div class="heading" role="presentation">{item.heading}</div>
      {:else}
        <button
          role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          aria-checked={item.checked}
          disabled={item.disabled}
          onfocus={() => item.preview?.()}
          onpointerenter={(e) => (e.currentTarget as HTMLElement).focus({ preventScroll: true })}
          onclick={() => {
            workbench.contextMenu.close(true);
            item.run();
          }}
        >
          {#if checks}
            <svg class="check" class:on={item.checked} viewBox="0 0 24 24" aria-hidden="true"
              ><path d="M20 6L9 17l-5-5" /></svg
            >
          {/if}
          <span class="label" style:font-family={item.font}>{item.label}</span>
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
    max-height: calc(100vh - 16px);
    padding: 5px;
    overflow-y: auto;
    background: var(--menu-bg);
    border: 1px solid var(--ui-border);
    border-radius: 10px;
    box-shadow: var(--menu-shadow);
    outline: none;
    scrollbar-width: thin;
    animation: pop 120ms ease-out;
  }

  button {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .checks button {
    padding-left: 6px;
  }

  .label {
    flex: 1;
    white-space: nowrap;
  }

  button:hover:not(:disabled),
  button:focus-visible,
  button:focus {
    background: var(--menu-active-bg);
    color: var(--menu-active-fg);
    outline: none;
  }

  button:disabled {
    color: var(--ui-fg);
    opacity: 0.5;
    cursor: default;
  }

  .check {
    flex: none;
    width: 14px;
    height: 14px;
    fill: none;
    stroke: var(--accent);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.5;
    visibility: hidden;
  }

  .check.on {
    visibility: visible;
  }

  .shortcut {
    margin-left: 16px;
    color: var(--ui-fg);
    font-size: 12px;
  }

  .heading {
    padding: 8px 10px 4px;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .separator {
    flex: none;
    height: 1px;
    margin: 4px 8px;
    background: var(--ui-border);
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .menu {
      animation: none;
    }
  }
</style>
