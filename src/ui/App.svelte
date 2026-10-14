<script lang="ts">
  import type { Workbench } from '../app/workbench';
  import Banners from './Banners.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import EditorArea from './EditorArea.svelte';
  import KeyHint from './KeyHint.svelte';
  import Modal from './Modal.svelte';
  import QuickPick from './QuickPick.svelte';
  import SidePanel from './SidePanel.svelte';
  import StatusBar from './StatusBar.svelte';
  import TitleBar from './TitleBar.svelte';

  let { workbench }: { workbench: Workbench } = $props();
  const layout = $derived(workbench.layout);
  /** With a single view, its tabs sit in the title bar. */
  const tabsInTitle = $derived(workbench.workspace.groups.length === 1);
  const left = $derived(layout.zen ? null : workbench.panels.current('left'));
</script>

<div class="shell">
  {#if left}
    {#key left.id}
      <SidePanel {workbench} panel={left} side="left" />
    {/key}
  {/if}
  <div class="work">
    {#if !layout.zen}<TitleBar {workbench} />{/if}
    <Banners {workbench} />
    <EditorArea {workbench} zen={layout.zen} showTabs={layout.tabs && !tabsInTitle} />
    <KeyHint {workbench} />
    {#if layout.shows('statusBar')}<StatusBar {workbench} />{/if}
  </div>
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
    height: 100vh;
  }

  .work {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
</style>
