<script lang="ts">
  import type { Workbench } from '../app/workbench';
  import Banners from './Banners.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import EditorArea from './EditorArea.svelte';
  import KeyHint from './KeyHint.svelte';
  import Modal from './Modal.svelte';
  import QuickPick from './QuickPick.svelte';
  import StatusBar from './StatusBar.svelte';
  import TitleBar from './TitleBar.svelte';

  let { workbench }: { workbench: Workbench } = $props();
  const layout = $derived(workbench.layout);
  /** With a single view, its tabs sit in the title bar. */
  const tabsInTitle = $derived(workbench.workspace.groups.length === 1);
</script>

<div class="shell">
  {#if !layout.zen}<TitleBar {workbench} />{/if}
  <Banners {workbench} />
  <EditorArea {workbench} zen={layout.zen} showTabs={layout.tabs && !tabsInTitle} />
  <KeyHint {workbench} />
  {#if layout.shows('statusBar')}<StatusBar {workbench} />{/if}
</div>
<QuickPick {workbench} />
<ContextMenu {workbench} />
{#if workbench.modals.current}
  {#key workbench.modals.current}
    <Modal {workbench} modal={workbench.modals.current} />
  {/key}
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
</style>
