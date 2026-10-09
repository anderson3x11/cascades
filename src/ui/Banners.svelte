<script lang="ts">
  import type { Banner } from '../app/banners.svelte';
  import type { Workbench } from '../app/workbench';

  /**
   * Without `tabId`: the banners that concern the whole app. With it (inside
   * a group): the banners of that group's shown tab.
   */
  let { workbench, tabId }: { workbench: Workbench; tabId?: string | null } = $props();

  const visible = $derived(
    workbench.banners.banners.filter((b) =>
      tabId === undefined ? b.tabId === undefined : b.tabId !== undefined && b.tabId === tabId,
    ),
  );

  function run(banner: Banner, action: () => void) {
    workbench.banners.remove(banner);
    action();
    workbench.workspace.editorView()?.focus();
  }
</script>

{#each visible as banner (banner)}
  <div class="banner {banner.kind}" role="status">
    <span class="message">{banner.message}</span>
    <div class="actions">
      {#each banner.actions as action (action.label)}
        <button onclick={() => run(banner, action.run)}>{action.label}</button>
      {/each}
    </div>
  </div>
{/each}

<style>
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 4px 8px;
    padding: 6px 8px 6px 14px;
    border-radius: 10px;
    background: var(--banner-bg);
    color: var(--fg);
  }

  .banner.warning {
    background: var(--banner-warning-bg);
  }

  .actions {
    display: flex;
    gap: 6px;
    flex: none;
  }

  button {
    padding: 4px 12px;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
    cursor: pointer;
  }

  button:first-child {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
  }

  button:hover {
    filter: brightness(1.08);
  }
</style>
