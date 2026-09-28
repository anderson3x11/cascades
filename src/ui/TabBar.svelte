<script lang="ts">
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  const ws = $derived(workbench.workspace);

  /**
   * Tab reordering uses pointer events: native HTML drag and drop is taken
   * over by Tauri on Windows (to receive dropped files).
   */
  let drag: { id: string; startX: number; moved: boolean } | null = null;
  const DRAG_THRESHOLD = 5;

  function run(command: string, ...args: unknown[]) {
    workbench.commands.execute(command, ...args).catch((err: unknown) => console.error(err));
  }

  function onAuxClick(event: MouseEvent, id: string) {
    if (event.button === 1) run('tabs.close', id);
  }

  function onPointerDown(event: PointerEvent, id: string) {
    if (event.button !== 0) return;
    drag = { id, startX: event.clientX, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag) return;
    // Released outside the tab bar (capture can be lost when the tab moves in the DOM).
    if ((event.buttons & 1) === 0) {
      drag = null;
      return;
    }
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const over = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-tab-id]');
    const target = over?.dataset.tabId;
    if (target && target !== drag.id) {
      ws.move(
        drag.id,
        ws.tabs.findIndex((t) => t.id === target),
      );
    }
  }

  function onPointerUp() {
    drag = null;
  }
</script>

<div
  class="tabbar"
  role="tablist"
  tabindex="-1"
  ondblclick={(e) => e.target === e.currentTarget && run('file.new')}
>
  {#each ws.tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === ws.activeId}
      role="tab"
      tabindex="0"
      aria-selected={tab.id === ws.activeId}
      title={tab.path ?? tab.title}
      data-tab-id={tab.id}
      onclick={() => ws.activate(tab.id)}
      onkeydown={(e) => e.key === 'Enter' && ws.activate(tab.id)}
      onauxclick={(e) => onAuxClick(e, tab.id)}
      onpointerdown={(e) => onPointerDown(e, tab.id)}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
    >
      <span class="title">{tab.title}</span>
      <button
        class="close"
        class:dirty={tab.dirty}
        aria-label="Fermer"
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => {
          e.stopPropagation();
          run('tabs.close', tab.id);
        }}
      ></button>
    </div>
  {/each}
  <button
    class="new"
    aria-label="Nouveau fichier"
    title="Nouveau fichier"
    onclick={() => run('file.new')}>+</button
  >
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

  .new {
    flex: none;
    align-self: center;
    width: 26px;
    height: 26px;
    margin: 0 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--ui-fg);
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .new:hover {
    background: var(--ui-border);
    color: var(--fg);
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
