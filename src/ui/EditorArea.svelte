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
  const left = $derived(workbench.panels.current('left'));
  const right = $derived(workbench.panels.current('right'));
  /** Zen shows only the group being written in. */
  const groups = $derived(zen ? ws.groups.filter((g) => g.id === ws.activeGroupId) : ws.groups);
</script>

<div class="area">
  {#if left && !zen}
    {#key left.id}
      <SidePanel {workbench} panel={left} side="left" />
    {/key}
  {/if}
  <div class="groups" class:column={ws.orientation === 'column'}>
    {#each groups as group, index (group.id)}
      {#if index > 0}<div class="separator" aria-hidden="true"></div>{/if}
      <GroupPane {workbench} {group} {zen} showTabs={showTabs && !zen} />
    {/each}
  </div>
  {#if right && !zen}
    {#key right.id}
      <SidePanel {workbench} panel={right} side="right" />
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
