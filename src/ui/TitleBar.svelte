<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import type { Workbench } from '../app/workbench';
  import { platform } from '../core/platform';
  import MenuBar from './MenuBar.svelte';
  import TabBar from './TabBar.svelte';
  import WindowControls from './WindowControls.svelte';

  /**
   * The top of the window, standing in for the system title bar: menus, the
   * tabs when there is a single view, a strip to move the window, and the
   * window buttons (macOS keeps its own, on the left).
   */
  let { workbench }: { workbench: Workbench } = $props();

  const layout = $derived(workbench.layout);
  const ws = $derived(workbench.workspace);
  const group = $derived(layout.tabs && ws.groups.length === 1 ? ws.groups[0] : undefined);
  const desktop = isTauri();
  const mac = platform() === 'macos';
</script>

<header class="titlebar" class:mac={desktop && mac} data-tauri-drag-region>
  <MenuBar {workbench} compact={!layout.menuBar} />
  {#if group}
    <div class="tabs"><TabBar {workbench} {group} focused /></div>
  {/if}
  <div class="drag" data-tauri-drag-region></div>
  {#if desktop && !mac}<WindowControls />{/if}
</header>

<style>
  .titlebar {
    display: flex;
    align-items: stretch;
    flex: none;
    height: 40px;
    background: var(--ui-bg);
    user-select: none;
  }

  /* Room for the traffic lights the system draws over the window. */
  .titlebar.mac {
    padding-left: 72px;
  }

  .tabs {
    display: flex;
    min-width: 0;
  }

  .drag {
    flex: 1;
    min-width: 40px;
  }
</style>
