<script lang="ts">
  import type { Workbench } from '../app/workbench';
  import Banners from './Banners.svelte';
  import EditorHost from './EditorHost.svelte';
  import MenuBar from './MenuBar.svelte';
  import QuickPick from './QuickPick.svelte';
  import StatusBar from './StatusBar.svelte';
  import TabBar from './TabBar.svelte';

  let { workbench }: { workbench: Workbench } = $props();
</script>

<div class="shell">
  <MenuBar {workbench} />
  <TabBar {workbench} />
  <Banners {workbench} />
  <EditorHost {workbench} />
  <StatusBar {workbench} />
</div>
<QuickPick {workbench} />

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
</style>
