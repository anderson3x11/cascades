<script lang="ts">
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  const ws = $derived(workbench.workspace);

  /**
   * Tab reordering with pointer events (native HTML drag and drop is taken
   * over by Tauri on Windows to receive dropped files). While dragging, the
   * tab follows the pointer and the others slide aside; the real order only
   * changes once the tab has landed.
   */
  interface Drag {
    id: string;
    from: number;
    startX: number;
    dx: number;
    moved: boolean;
    target: number;
    /** Tab positions when the drag started. */
    rects: { left: number; width: number }[];
    /** Released: the tab is sliding to its new place. */
    landing: boolean;
  }

  const DRAG_THRESHOLD = 5;
  const LANDING_MS = 150;

  let drag = $state<Drag | null>(null);
  /** Disables transitions for the frame where the order is committed. */
  let instant = $state(false);
  let bar: HTMLElement;

  function run(command: string, ...args: unknown[]) {
    workbench.commands.execute(command, ...args).catch((err: unknown) => console.error(err));
  }

  function onAuxClick(event: MouseEvent, id: string) {
    if (event.button === 1) run('tabs.close', id);
  }

  function onPointerDown(event: PointerEvent, id: string) {
    if (event.button !== 0 || drag) return;
    const rects = [...bar.querySelectorAll<HTMLElement>('[data-tab-id]')].map((el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    });
    const from = ws.tabs.findIndex((t) => t.id === id);
    drag = {
      id,
      from,
      startX: event.clientX,
      dx: 0,
      moved: false,
      target: from,
      rects,
      landing: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || drag.landing) return;
    if ((event.buttons & 1) === 0) {
      drag = null;
      return;
    }
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) return;
    drag.moved = true;

    const { rects, from } = drag;
    const self = rects[from];
    const first = rects[0];
    const last = rects[rects.length - 1];
    if (!self || !first || !last) return;
    const minDx = first.left - self.left;
    const maxDx = last.left + last.width - (self.left + self.width);
    drag.dx = Math.max(minDx, Math.min(maxDx, event.clientX - drag.startX));

    // A neighbor is passed when the leading edge of the dragged tab crosses its middle,
    // which works whatever the tab widths.
    const left = self.left + drag.dx;
    const right = left + self.width;
    const middle = (r: { left: number; width: number }) => r.left + r.width / 2;
    const passedRight = rects.filter((r, i) => i > from && middle(r) < right).length;
    const passedLeft = rects.filter((r, i) => i < from && middle(r) > left).length;
    drag.target = from + passedRight - passedLeft;
  }

  function onPointerUp() {
    if (!drag || drag.landing) return;
    if (!drag.moved) {
      drag = null;
      return;
    }
    const { rects, from, target, id } = drag;
    const between = target > from ? rects.slice(from + 1, target + 1) : rects.slice(target, from);
    const distance = between.reduce((sum, r) => sum + r.width, 0);
    drag.dx = target > from ? distance : -distance;
    drag.landing = true;
    setTimeout(() => {
      instant = true;
      ws.move(id, target);
      drag = null;
      requestAnimationFrame(() => (instant = false));
    }, LANDING_MS);
  }

  /** Horizontal offset of a tab during a drag. */
  function offset(index: number, id: string): number {
    if (!drag?.moved) return 0;
    if (id === drag.id) return drag.dx;
    const width = drag.rects[drag.from]?.width ?? 0;
    if (drag.target > drag.from && index > drag.from && index <= drag.target) return -width;
    if (drag.target < drag.from && index >= drag.target && index < drag.from) return width;
    return 0;
  }
</script>

<div
  class="tabbar"
  class:instant
  role="tablist"
  tabindex="-1"
  bind:this={bar}
  ondblclick={(e) => e.target === e.currentTarget && run('file.new')}
>
  {#each ws.tabs as tab, index (tab.id)}
    <div
      class="tab"
      class:active={tab.id === ws.activeId}
      class:dragging={drag?.moved && drag.id === tab.id}
      class:landing={drag?.landing && drag.id === tab.id}
      style:transform={offset(index, tab.id) ? `translateX(${offset(index, tab.id)}px)` : null}
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
        title={tab.dirty ? 'Modifications non enregistrées' : 'Fermer'}
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
    position: relative;
    transition: transform 150ms ease;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 12px;
    color: var(--ui-fg);
    border-right: 1px solid var(--ui-border);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .tab.dragging {
    z-index: 2;
    background: var(--bg);
    box-shadow: var(--menu-shadow);
    outline: 1px solid var(--ui-border);
    border-radius: 6px 6px 0 0;
    cursor: grabbing;
    transition: none;
  }

  .tab.dragging.landing {
    transition: transform 150ms ease;
  }

  .tabbar.instant .tab {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab,
    .tab.dragging.landing {
      transition: none;
    }
  }

  .tab.active {
    background: var(--bg);
    color: var(--fg);
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
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

  /* A drawn dot rather than a glyph, so it is centered whatever the font. */
  .close.dirty::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 1;
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
    width: auto;
    height: auto;
    border-radius: 0;
    background: none;
    opacity: 1;
  }
</style>
