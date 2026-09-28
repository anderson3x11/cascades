<script lang="ts">
  import type { Workbench } from '../app/workbench';
  import GroupPane from './GroupPane.svelte';
  import SidePanel from './SidePanel.svelte';

  let {
    workbench,
    zen = false,
    showTabs = true,
  }: { workbench: Workbench; zen?: boolean; showTabs?: boolean } = $props();

  const ws = $derived(workbench.workspace);
  const panel = $derived(workbench.panels.current());
  /** Zen shows only the group being written in. */
  const groups = $derived(zen ? ws.groups.filter((g) => g.id === ws.activeGroupId) : ws.groups);
</script>

<div class="area">
  <div class="groups" class:column={ws.orientation === 'column'}>
    {#each groups as group, index (group.id)}
      {#if index > 0}<div class="separator" aria-hidden="true"></div>{/if}
      <GroupPane {workbench} {group} {zen} showTabs={showTabs && !zen} />
    {/each}
  </div>
  {#if panel && !zen}
    {#key panel.id}
      <SidePanel {workbench} {panel} />
    {/key}
  {/if}
</div>

<style>
  .area {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .groups {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .groups.column {
    flex-direction: column;
  }

  .separator {
    flex: none;
    width: 1px;
    background: var(--ui-border);
  }

  .groups.column .separator {
    width: auto;
    height: 1px;
  }
</style>
