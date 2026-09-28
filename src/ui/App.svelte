<script lang="ts">
  import type { Workbench } from '../app/workbench';
  import Banners from './Banners.svelte';
  import EditorArea from './EditorArea.svelte';
  import KeyHint from './KeyHint.svelte';
  import MenuBar from './MenuBar.svelte';
  import QuickPick from './QuickPick.svelte';
  import StatusBar from './StatusBar.svelte';
  import TabBar from './TabBar.svelte';

  let { workbench }: { workbench: Workbench } = $props();
  const layout = $derived(workbench.layout);
</script>

<div class="shell">
  {#if layout.shows('menuBar')}<MenuBar {workbench} />{/if}
  {#if layout.shows('tabs')}<TabBar {workbench} />{/if}
  <Banners {workbench} />
  <EditorArea {workbench} zen={layout.zen} />
  <KeyHint {workbench} />
  {#if layout.shows('statusBar')}<StatusBar {workbench} />{/if}
</div>
<QuickPick {workbench} />

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
</style>
