<script lang="ts">
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  const ws = $derived(workbench.workspace);

  let dragged: string | null = null;

  function run(command: string, ...args: unknown[]) {
    workbench.commands.execute(command, ...args).catch((err: unknown) => console.error(err));
  }

  function onAuxClick(event: MouseEvent, id: string) {
    if (event.button === 1) run('tabs.close', id);
  }

  function onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    if (dragged) ws.move(dragged, index);
    dragged = null;
  }
</script>

<div
  class="tabbar"
  role="tablist"
  tabindex="-1"
  ondblclick={(e) => e.target === e.currentTarget && run('file.new')}
>
  {#each ws.tabs as tab, index (tab.id)}
    <div
      class="tab"
      class:active={tab.id === ws.activeId}
      role="tab"
      tabindex="0"
      aria-selected={tab.id === ws.activeId}
      title={tab.path ?? tab.title}
      draggable="true"
      onclick={() => ws.activate(tab.id)}
      onkeydown={(e) => e.key === 'Enter' && ws.activate(tab.id)}
      onauxclick={(e) => onAuxClick(e, tab.id)}
      ondragstart={() => (dragged = tab.id)}
      ondragover={(e) => e.preventDefault()}
      ondrop={(e) => onDrop(e, index)}
    >
      <span class="title">{tab.title}</span>
      <button
        class="close"
        class:dirty={tab.dirty}
        aria-label="Fermer"
        onclick={(e) => {
          e.stopPropagation();
          run('tabs.close', tab.id);
        }}
      ></button>
    </div>
  {/each}
</div>

<style>
  .tabbar {
    display: flex;
    overflow-x: auto;
    background: var(--ui-bg);
    border-bottom: 1px solid var(--ui-border);
    min-height: 34px;
    scrollbar-width: thin;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 12px;
    color: var(--ui-fg);
    border-right: 1px solid var(--ui-border);
    cursor: default;
    user-select: none;
    white-space: nowrap;
  }

  .tab.active {
    background: var(--bg);
    color: var(--fg);
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .close {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: 1;
    cursor: pointer;
  }

  .close::before {
    content: '×';
    opacity: 0;
  }

  .tab:hover .close::before,
  .tab.active .close::before {
    opacity: 0.7;
  }

  .close.dirty::before {
    content: '●';
    opacity: 0.7;
    font-size: 10px;
  }

  .close:hover {
    background: var(--ui-border);
  }

  .close:hover::before {
    content: '×';
    font-size: inherit;
    opacity: 1;
  }
</style>
