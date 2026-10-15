<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';
  import type { Workbench } from '../app/workbench';
  import { t } from '../core/i18n/i18n';
  import { platform } from '../core/platform';
  import TabBar from './TabBar.svelte';
  import WindowControls from './WindowControls.svelte';

  /**
   * The top of the window, standing in for the system title bar: the menu
   * button unless a column on the left holds it (side panel, vertical tabs),
   * the tabs when they are on top with a single view (else the name of the
   * file), a strip to move the window, and the window buttons (macOS keeps
   * its own).
   */
  let { workbench, besideColumn }: { workbench: Workbench; besideColumn: boolean } = $props();

  const layout = $derived(workbench.layout);
  const ws = $derived(workbench.workspace);
  const top = $derived(layout.tabsPosition === 'top');
  const group = $derived(top && layout.tabs && ws.groups.length === 1 ? ws.groups[0] : undefined);
  const title = $derived(top ? null : (ws.activeTab()?.title ?? null));
  const desktop = isTauri();
  const mac = platform() === 'macos';

  function toggleSide() {
    workbench.panels.toggleSide('left');
    if (!workbench.panels.current('left')) workbench.workspace.editorView()?.focus();
  }

  // Alt pressed and released alone opens or closes the side panel.
  // AltGr comes with Ctrl, so it does not count.
  onMount(() => {
    let altAlone = false;
    const onKeyDown = (e: KeyboardEvent) => {
      altAlone = e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' || !altAlone) return;
      altAlone = false;
      e.preventDefault();
      toggleSide();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  });
</script>

<header class="titlebar" class:mac={desktop && mac && !besideColumn} data-tauri-drag-region>
  {#if !besideColumn}
    <button class="menu-button" aria-label={t('Menu')} title={t('Menu (Alt)')} onclick={toggleSide}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
  {/if}
  {#if group}
    <div class="tabs"><TabBar {workbench} {group} focused /></div>
  {/if}
  <div class="drag" data-tauri-drag-region>
    {#if title}<span class="name" data-tauri-drag-region>{title}</span>{/if}
  </div>
  {#if desktop && !mac}<WindowControls />{/if}
</header>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    flex: none;
    height: 40px;
    background: var(--ui-bg);
    user-select: none;
  }

  /* Room for the traffic lights the system draws over the window, unless the side panel takes it. */
  .titlebar.mac {
    padding-left: 72px;
  }

  .menu-button {
    display: grid;
    flex: none;
    width: 30px;
    height: 28px;
    margin: 0 2px 0 6px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--ui-fg);
    place-items: center;
  }

  .menu-button:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .menu-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-width: 1.75;
  }

  .name {
    overflow: hidden;
    color: var(--ui-fg);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tabs {
    display: flex;
    align-self: stretch;
    min-width: 0;
  }

  .drag {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    align-self: stretch;
    min-width: 40px;
  }

  :global(.titlebar .controls) {
    align-self: stretch;
  }
</style>
