<script lang="ts">
  import { onMount } from 'svelte';
  import type { Workbench } from '../app/workbench';
  import { formatKeySequence } from '../core/keybindings/keys';
  import type { MenuItemSpec } from '../core/menus/registry';

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

  function titleOf(item: MenuItemSpec): string {
    if (item.title) return item.title;
    return workbench.commands.list().find((c) => c.id === item.command)?.title ?? item.command;
  }

  function shortcutOf(command: string): string {
    const binding = workbench.keybindings.forCommand(command)[0];
    return binding ? formatKeySequence(binding.chords) : '';
  }

  function run(command: string) {
    openId = null;
    workbench.workspace.editorView()?.focus();
    workbench.commands.execute(command).catch((err: unknown) => console.error(err));
  }

  function toggle(id: string) {
    openId = openId === id ? null : id;
  }

  /** Arrow keys move inside the open menu and between menus, Escape closes. */
  function onKeydown(event: KeyboardEvent) {
    if (!openId) return;
    if (event.key === 'Escape') {
      openId = null;
      workbench.workspace.editorView()?.focus();
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
        onclick={() => toggle(menu.id)}
        onpointerenter={() => openId && (openId = menu.id)}>{menu.title}</button
      >
      {#if openId === menu.id}
        <div class="dropdown" role="menu" aria-label={menu.title}>
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
    height: 30px;
    padding: 0 4px;
    background: var(--ui-bg);
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
    height: 24px;
    padding: 0 9px;
    border-radius: 4px;
    color: var(--ui-fg);
  }

  .top:hover,
  .top.open {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    min-width: 260px;
    padding: 4px;
    background: var(--menu-bg);
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    box-shadow: var(--menu-shadow);
  }

  .dropdown button {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding: 5px 10px;
    border-radius: 4px;
    text-align: left;
    color: var(--fg);
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

  .dropdown button:hover .shortcut,
  .dropdown button:focus-visible .shortcut {
    color: inherit;
    opacity: 0.85;
  }

  .separator {
    height: 1px;
    margin: 4px 6px;
    background: var(--ui-border);
  }
</style>
