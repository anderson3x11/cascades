<script lang="ts">
  import { onMount } from 'svelte';
  import type { Workbench } from '../app/workbench';
  import { formatKeySequence } from '../core/keybindings/keys';
  import type { MenuItemSpec } from '../core/menus/registry';

  /** The classic menu bar, shown with the workbench.showMenuBar setting. */
  let { workbench }: { workbench: Workbench } = $props();

  let nav: HTMLElement;
  let version = $state(0);
  let openId = $state<string | null>(null);

  const bar = $derived.by(() => {
    void version;
    return workbench.menus.bar();
  });

  onMount(() => {
    const changed = workbench.menus.onDidChange.on(() => version++);
    const onPointerDown = (e: PointerEvent) => {
      if (openId && !nav.contains(e.target as Node)) openId = null;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      changed.dispose();
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  });

  /** Opens the first menu with the keyboard (Alt), or closes the open one. */
  export function toggleFromKeyboard() {
    if (openId) {
      close();
      return;
    }
    openId = bar[0]?.id ?? null;
    requestAnimationFrame(() => nav.querySelector<HTMLElement>('.top')?.focus());
  }

  function titleOf(item: MenuItemSpec): string {
    if (item.title) return item.title;
    return workbench.commands.list().find((c) => c.id === item.command)?.title ?? item.command;
  }

  function shortcutOf(command: string): string {
    const binding = workbench.keybindings.forCommand(command)[0];
    return binding ? formatKeySequence(binding.chords) : '';
  }

  function close() {
    openId = null;
    workbench.workspace.editorView()?.focus();
  }

  function run(command: string) {
    close();
    workbench.commands.execute(command).catch((err: unknown) => console.error(err));
  }

  /** Moves a menu up when it would go past the bottom of the window; a taller one scrolls. */
  function fit(element: HTMLElement) {
    const overflow = element.getBoundingClientRect().bottom - (window.innerHeight - 8);
    if (overflow > 0) element.style.translate = `0 -${overflow}px`;
  }

  /** Arrow keys move inside the open menu and between menus, Escape closes. */
  function onKeydown(event: KeyboardEvent) {
    if (!openId) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    const ids = bar.map((m) => m.id);
    const index = ids.indexOf(openId);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      openId = ids[(index + delta + ids.length) % ids.length] ?? null;
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const items = [...nav.querySelectorAll<HTMLButtonElement>('.dropdown button')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = current === -1 && delta < 0 ? items.length - 1 : current + delta;
      items[(next + items.length) % items.length]?.focus();
      event.preventDefault();
    }
  }
</script>

<div class="menubar" role="menubar" tabindex="-1" bind:this={nav} onkeydown={onKeydown}>
  {#each bar as menu (menu.id)}
    <div class="menu">
      <button
        class="top"
        class:open={openId === menu.id}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={openId === menu.id}
        onclick={() => (openId = openId === menu.id ? null : menu.id)}
        onpointerenter={() => openId && (openId = menu.id)}>{menu.title}</button
      >
      {#if openId === menu.id}
        <div class="dropdown" role="menu" aria-label={menu.title} {@attach fit}>
          {#each workbench.menus.entries(menu.id) as entry, i (i)}
            {#if entry.kind === 'separator'}
              <div class="separator" role="separator"></div>
            {:else}
              <button role="menuitem" onclick={() => run(entry.item.command)}>
                <span>{titleOf(entry.item)}</span>
                <span class="shortcut">{shortcutOf(entry.item.command)}</span>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .menubar {
    display: flex;
    align-items: center;
    flex: none;
    padding: 0 4px;
    user-select: none;
  }

  .menu {
    position: relative;
  }

  button {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: default;
  }

  .top {
    height: 26px;
    padding: 0 9px;
    border-radius: 6px;
    color: var(--ui-fg);
  }

  .top:hover,
  .top.open,
  .top:focus-visible {
    background: var(--ui-hover);
    color: var(--fg);
    outline: none;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    min-width: 270px;
    max-height: calc(100vh - 56px);
    overflow-y: auto;
    scrollbar-width: thin;
    padding: 5px;
    background: var(--menu-bg);
    border: 1px solid var(--ui-border);
    border-radius: 10px;
    box-shadow: var(--menu-shadow);
    animation: pop 120ms ease-out;
  }

  .dropdown button {
    display: flex;
    flex: none;
    justify-content: space-between;
    gap: 24px;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--fg);
    text-align: left;
    white-space: nowrap;
  }

  .dropdown button:hover,
  .dropdown button:focus-visible {
    background: var(--menu-active-bg);
    color: var(--menu-active-fg);
    outline: none;
  }

  .shortcut {
    color: var(--ui-fg);
    font-size: 12px;
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
      transform: translateY(-3px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dropdown {
      animation: none;
    }
  }
</style>
