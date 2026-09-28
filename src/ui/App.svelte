<script lang="ts">
  import type { Workbench } from '../app/workbench';
  import EditorHost from './EditorHost.svelte';
  import MenuBar from './MenuBar.svelte';
  import StatusBar from './StatusBar.svelte';
  import TabBar from './TabBar.svelte';

  let { workbench }: { workbench: Workbench } = $props();
</script>

<div class="shell">
  <MenuBar {workbench} />
  <TabBar {workbench} />
  <EditorHost {workbench} />
  <StatusBar {workbench} />
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
</style>
