<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import type { Group } from '../app/tab.svelte';
  import type { Workbench } from '../app/workbench';
  import { ICON_PATHS, iconFor } from '../core/file-icons';
  import { t } from '../core/i18n/i18n';
  import { platform } from '../core/platform';

  /**
   * The tabs in a column on the left, like browsers: one section per view,
   * full names, reordered by dragging, resized by the right edge, folded to
   * icons. The menu button sits on top while the side panel is closed.
   */
  let { workbench }: { workbench: Workbench } = $props();

  const ws = $derived(workbench.workspace);
  const collapsed = $derived(workbench.layout.tabsCollapsed);
  const mac = isTauri() && platform() === 'macos';

  const MENU_ICON = 'M4 6h16M4 12h16M4 18h16';
  /** Lucide panel-left-close / panel-left-open. */
  const FOLD_ICON =
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18M16 15l-3-3 3-3';
  const UNFOLD_ICON =
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18M14 9l3 3-3 3';
  const MIN_WIDTH = 140;
  const MAX_WIDTH = 420;

  let nav: HTMLElement;

  function run(command: string, ...args: unknown[]) {
    workbench.commands.execute(command, ...args).catch((err: unknown) => console.error(err));
  }

  function toggleSide() {
    workbench.panels.toggleSide('left');
  }

  function iconOf(title: string): string {
    return ICON_PATHS[iconFor(title, false, false)];
  }

  function showMenu(event: MouseEvent, group: Group, id: string) {
    event.preventDefault();
    const index = ws.groups.indexOf(group);
    const canGrow = ws.groups.length < 4;
    const item = (label: string, command: string, enabled: boolean) => ({
      label,
      disabled: !enabled,
      run: () => run(command, id),
    });
    workbench.contextMenu.show({ x: event.clientX, y: event.clientY }, [
      item(
        t('Clone to the next view'),
        'view.cloneToNextGroup',
        index < ws.groups.length - 1 || canGrow,
      ),
      item(
        t('Move to the next view'),
        'view.moveToNextGroup',
        index < ws.groups.length - 1 || (canGrow && group.tabs.length > 1),
      ),
      item(t('Move to the previous view'), 'view.moveToPreviousGroup', index > 0),
      item(t('Join all views'), 'view.joinGroups', ws.groups.length > 1),
      'separator',
      item(t('Close'), 'tabs.close', true),
    ]);
  }

  /**
   * Reordering with pointer events (native drag and drop is taken over by
   * Tauri on Windows to receive files): the tab follows the pointer and a
   * line shows where it will land.
   */
  interface Drag {
    id: string;
    group: Group;
    startY: number;
    dy: number;
    moved: boolean;
    /** Final index of the tab, among the others. */
    target: number;
    /** Middles of the other tabs when the drag started. */
    middles: number[];
  }
  let drag = $state<Drag | null>(null);
  /** The click that ends a drag must not activate the tab. */
  let dragged = false;

  function onPointerDown(event: PointerEvent, group: Group, id: string) {
    if (event.button !== 0) return;
    const list = (event.currentTarget as HTMLElement).parentElement;
    const middles = [...(list?.querySelectorAll<HTMLElement>('[data-tab-id]') ?? [])]
      .filter((el) => el.dataset.tabId !== id)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
    drag = { id, group, startY: event.clientY, dy: 0, moved: false, target: 0, middles };
    dragged = false;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || (event.buttons & 1) === 0) return;
    drag.dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(drag.dy) < 5) return;
    drag.moved = true;
    drag.target = drag.middles.filter((middle) => middle < event.clientY).length;
  }

  function onPointerUp() {
    if (drag?.moved) {
      ws.move(drag.id, drag.target);
      dragged = true;
    }
    drag = null;
  }

  /** Index of the line that shows where the dragged tab lands, among all the tabs. */
  function dropLine(group: Group): number | null {
    if (!drag?.moved || drag.group !== group) return null;
    const from = group.tabs.findIndex((tab) => tab.id === drag?.id);
    return drag.target >= from ? drag.target + 1 : drag.target;
  }

  function onResizeDown(event: PointerEvent) {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    let width = nav.getBoundingClientRect().width;
    const move = (e: PointerEvent) => {
      width = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, e.clientX - nav.getBoundingClientRect().left),
      );
      document.documentElement.style.setProperty('--tabs-width', `${width}px`);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      run('view.setTabsWidth', width);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  }
</script>

{#snippet icon(d: string, grid = 24)}
  <svg class="icon" class:small={grid === 16} viewBox="0 0 {grid} {grid}" aria-hidden="true"
    ><path {d} /></svg
  >
{/snippet}

<nav class="vtabs" class:collapsed class:mac aria-label={t('Tabs')} bind:this={nav}>
  <div class="top" data-tauri-drag-region>
    <button class="tool" aria-label={t('Menu')} title={t('Menu (Alt)')} onclick={toggleSide}>
      {@render icon(MENU_ICON)}
    </button>
    {#if !collapsed}<div class="drag" data-tauri-drag-region></div>{/if}
    <button
      class="tool"
      aria-label={collapsed ? t('Unfold the tabs') : t('Fold the tabs')}
      title={collapsed ? t('Unfold the tabs') : t('Fold the tabs')}
      onclick={() => run('view.toggleTabsCollapsed')}
    >
      {@render icon(collapsed ? UNFOLD_ICON : FOLD_ICON)}
    </button>
  </div>

  <div class="list">
    {#each ws.groups as group, index (group.id)}
      {#if ws.groups.length > 1}
        <div class="view" class:focused={ws.activeGroupId === group.id}>
          {collapsed ? index + 1 : t('View {number}', { number: index + 1 })}
        </div>
      {/if}
      <div
        class="tabs"
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('View {number}', { number: index + 1 })}
        data-group-id={group.id}
      >
        {#each group.tabs as tab, i (tab.id)}
          {#if dropLine(group) === i}<div class="drop" aria-hidden="true"></div>{/if}
          <div
            class="tab"
            class:active={tab.id === group.activeId}
            class:dragging={drag?.moved && drag.id === tab.id}
            style:translate={drag?.moved && drag.id === tab.id ? `0 ${drag.dy}px` : null}
            role="tab"
            tabindex="0"
            aria-selected={tab.id === group.activeId}
            title={tab.path ?? tab.title}
            data-tab-id={tab.id}
            onclick={() => !dragged && ws.activate(tab.id)}
            onkeydown={(e) => e.key === 'Enter' && ws.activate(tab.id)}
            onauxclick={(e) => e.button === 1 && run('tabs.close', tab.id)}
            oncontextmenu={(e) => showMenu(e, group, tab.id)}
            onpointerdown={(e) => onPointerDown(e, group, tab.id)}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointercancel={onPointerUp}
          >
            {#if collapsed}
              <!-- Folded, the start of the name tells the tabs apart better than their icon. -->
              <span class="initials">{tab.title.slice(0, 2)}</span>
            {:else}
              {@render icon(iconOf(tab.title), 16)}
              <span class="title">{tab.title}</span>
            {/if}
            <button
              class="close"
              class:dirty={tab.dirty}
              aria-label={t('Close')}
              title={tab.dirty ? t('Unsaved changes') : t('Close')}
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                run('tabs.close', tab.id);
              }}
            ></button>
          </div>
        {/each}
        {#if dropLine(group) === group.tabs.length}<div class="drop" aria-hidden="true"></div>{/if}
      </div>
    {/each}
    <button
      class="tab new"
      aria-label={t('New file')}
      title={t('New file')}
      onclick={() => run('file.new')}
    >
      {@render icon('M12 5v14M5 12h14')}
      {#if !collapsed}<span class="title">{t('New file')}</span>{/if}
    </button>
  </div>

  {#if !collapsed}
    <div
      class="resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('Resize the tabs')}
      onpointerdown={onResizeDown}
    ></div>
  {/if}
</nav>

<style>
  .vtabs {
    position: relative;
    display: flex;
    flex: none;
    flex-direction: column;
    width: var(--tabs-width, 220px);
    min-height: 0;
    background: var(--ui-bg);
    border-right: 1px solid var(--ui-border);
    user-select: none;
  }

  .vtabs.collapsed {
    width: 48px;
  }

  button {
    border: none;
    background: none;
    color: var(--ui-fg);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible,
  .tab:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .icon {
    flex: none;
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.75;
  }

  .icon.small {
    width: 16px;
    height: 16px;
    stroke-width: 1.2;
  }

  .top {
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: 40px;
    padding: 0 6px;
  }

  .mac .top {
    padding-left: 72px;
  }

  .mac.collapsed .top {
    height: auto;
    flex-direction: column;
    padding: 30px 0 4px;
  }

  .collapsed .top {
    flex-direction: column;
    justify-content: center;
    height: auto;
    padding: 6px 0;
  }

  .drag {
    flex: 1;
    align-self: stretch;
  }

  .tool {
    display: grid;
    flex: none;
    width: 30px;
    height: 28px;
    padding: 0;
    border-radius: 7px;
    place-items: center;
  }

  .tool:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .list {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 2px 6px 8px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .view {
    padding: 10px 8px 4px;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .collapsed .view {
    padding: 8px 0 2px;
    text-align: center;
  }

  .view.focused {
    color: var(--fg);
  }

  .tabs {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 4px 0 10px;
    border-radius: 7px;
    color: var(--ui-fg);
    cursor: pointer;
    transition: background-color 120ms;
  }

  .collapsed .tab {
    justify-content: center;
    padding: 0;
  }

  .tab:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .tab.active {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .tab.dragging {
    z-index: 2;
    background: var(--menu-bg);
    box-shadow: var(--menu-shadow);
    cursor: grabbing;
    transition: none;
  }

  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .initials {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .new {
    margin-top: 4px;
    font-size: inherit;
    text-align: left;
  }

  .drop {
    height: 2px;
    margin: -1px 6px;
    border-radius: 1px;
    background: var(--accent);
  }

  .close {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 5px;
    color: inherit;
    line-height: 1;
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
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    content: '';
    opacity: 1;
  }

  .close:hover {
    background: var(--ui-border);
  }

  .close:hover::before {
    width: auto;
    height: auto;
    border-radius: 0;
    background: none;
    content: '×';
    opacity: 1;
  }

  /* Folded, the close button gives way to the icon; the dot of unsaved changes stays, in a corner. */
  .collapsed .close {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    pointer-events: none;
  }

  .collapsed .close:not(.dirty) {
    display: none;
  }

  .collapsed .close.dirty::before {
    width: 6px;
    height: 6px;
  }

  .resize {
    position: absolute;
    top: 0;
    right: -3px;
    bottom: 0;
    z-index: 3;
    width: 6px;
    cursor: col-resize;
  }

  .resize:hover {
    background: linear-gradient(
      to right,
      transparent 2px,
      var(--accent) 2px,
      var(--accent) 4px,
      transparent 4px
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .tab {
      transition: none;
    }
  }
</style>
