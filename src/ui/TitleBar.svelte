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
   * button while the side panel is closed (it opens it), the tabs when there
   * is a single view, a strip to move the window, and the window buttons
   * (macOS keeps its own).
   */
  let { workbench }: { workbench: Workbench } = $props();

  const layout = $derived(workbench.layout);
  const ws = $derived(workbench.workspace);
  const group = $derived(layout.tabs && ws.groups.length === 1 ? ws.groups[0] : undefined);
  const sideOpen = $derived(workbench.panels.current('left') !== null);
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

<header class="titlebar" class:mac={desktop && mac && !sideOpen} data-tauri-drag-region>
  {#if !sideOpen}
    <button class="menu-button" aria-label={t('Menu')} title={t('Menu (Alt)')} onclick={toggleSide}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
  {/if}
  {#if group}
    <div class="tabs"><TabBar {workbench} {group} focused /></div>
  {/if}
  <div class="drag" data-tauri-drag-region></div>
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

  /* Room for the traffic lights the system draws over the window. */
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

  .tabs {
    display: flex;
    align-self: stretch;
    min-width: 0;
  }

  .drag {
    flex: 1;
    align-self: stretch;
    min-width: 40px;
  }

  :global(.titlebar .controls) {
    align-self: stretch;
  }
</style>
