<script lang="ts">
  import { onMount } from 'svelte';
  import type { Workbench } from '../app/workbench';
  import { t } from '../core/i18n/i18n';
  import { formatKeySequence } from '../core/keybindings/keys';
  import type { MenuItemSpec } from '../core/menus/registry';

  /**
   * The menus. By default a single button opens them as a column (`compact`);
   * with workbench.showMenuBar they are a classic bar. Pressing Alt alone opens
   * them from the keyboard in both forms.
   */
  let { workbench, compact = false }: { workbench: Workbench; compact?: boolean } = $props();

  let nav = $state<HTMLElement>();
  let version = $state(0);
  /** Compact form: the column of menus is shown. */
  let expanded = $state(false);
  let openId = $state<string | null>(null);

  const bar = $derived.by(() => {
    void version;
    return workbench.menus.bar();
  });
  const shown = $derived(!compact || expanded);

  onMount(() => {
    const changed = workbench.menus.onDidChange.on(() => version++);
    const onPointerDown = (e: PointerEvent) => {
      if ((openId || expanded) && !nav?.contains(e.target as Node)) close(false);
    };
    // Alt pressed and released alone. AltGr comes with Ctrl, so it does not count.
    let altAlone = false;
    const onKeyDown = (e: KeyboardEvent) => {
      altAlone = e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' || !altAlone) return;
      altAlone = false;
      e.preventDefault();
      if (openId || expanded) close(true);
      else open(true);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      changed.dispose();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  });

  function titleOf(item: MenuItemSpec): string {
    if (item.title) return item.title;
    return workbench.commands.list().find((c) => c.id === item.command)?.title ?? item.command;
  }

  function shortcutOf(command: string): string {
    const binding = workbench.keybindings.forCommand(command)[0];
    return binding ? formatKeySequence(binding.chords) : '';
  }

  function close(refocus: boolean) {
    openId = null;
    expanded = false;
    if (refocus) workbench.workspace.editorView()?.focus();
  }

  /** Opens the menus with the first one focused (Alt, or the menu button). */
  function open(fromKeyboard: boolean) {
    if (compact) expanded = true;
    else openId = bar[0]?.id ?? null;
    if (fromKeyboard || compact) {
      requestAnimationFrame(() => nav?.querySelector<HTMLElement>('.top')?.focus());
    }
  }

  /** Moves a menu up when it would go past the bottom of the window; a taller one scrolls. */
  function fit(element: HTMLElement) {
    const overflow = element.getBoundingClientRect().bottom - (window.innerHeight - 8);
    if (overflow > 0) element.style.translate = `0 -${overflow}px`;
  }

  function run(command: string) {
    close(true);
    workbench.commands.execute(command).catch((err: unknown) => console.error(err));
  }

  function toggle(id: string) {
    openId = openId === id ? null : id;
  }

  function focusItems(): HTMLButtonElement[] {
    return [...(nav?.querySelectorAll<HTMLButtonElement>('.dropdown button') ?? [])];
  }

  function moveIn(items: HTMLElement[], delta: number) {
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = current === -1 && delta < 0 ? items.length - 1 : current + delta;
    items[(next + items.length) % items.length]?.focus();
  }

  /**
   * Bar: Left/Right switch menus, Up/Down move in the open one. Column: Up/Down
   * move between menus, Right enters one, Left comes back. Escape closes.
   */
  function onKeydown(event: KeyboardEvent) {
    if (!openId && !expanded) return;
    const key = event.key;
    if (key === 'Escape') {
      close(true);
    } else if (!compact && (key === 'ArrowRight' || key === 'ArrowLeft')) {
      const ids = bar.map((m) => m.id);
      const delta = key === 'ArrowRight' ? 1 : -1;
      openId = ids[(ids.indexOf(openId ?? '') + delta + ids.length) % ids.length] ?? null;
    } else if (compact && focusItems().includes(document.activeElement as HTMLButtonElement)) {
      if (key === 'ArrowDown' || key === 'ArrowUp')
        moveIn(focusItems(), key === 'ArrowDown' ? 1 : -1);
      else if (key === 'ArrowLeft') nav?.querySelector<HTMLElement>('.top.open')?.focus();
      else return;
    } else if (compact) {
      const tops = [...(nav?.querySelectorAll<HTMLElement>('.top') ?? [])];
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        moveIn(tops, key === 'ArrowDown' ? 1 : -1);
        openId = (document.activeElement as HTMLElement | null)?.dataset.menu ?? openId;
      } else if (key === 'ArrowRight' || key === 'Enter' || key === ' ') {
        openId = (document.activeElement as HTMLElement | null)?.dataset.menu ?? openId;
        requestAnimationFrame(() => focusItems()[0]?.focus());
      } else return;
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      moveIn(focusItems(), key === 'ArrowDown' ? 1 : -1);
    } else return;
    event.preventDefault();
  }
</script>

{#snippet menus()}
  {#each bar as menu (menu.id)}
    <div class="menu">
      <button
        class="top"
        class:open={openId === menu.id}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={openId === menu.id}
        data-menu={menu.id}
        onclick={() => (compact ? (openId = menu.id) : toggle(menu.id))}
        onpointerenter={() => (compact || openId) && (openId = menu.id)}
        >{menu.title}{#if compact}<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"
            ><path d="M6 4l4 4-4 4" /></svg
          >{/if}</button
      >
      {#if openId === menu.id}
        <div class="dropdown" role="menu" aria-label={menu.title} {@attach fit}>
          {#each workbench.menus.entries(menu.id) as entry, i (i)}
            {#if entry.kind === 'separator'}
              <div class="separator" role="separator"></div>
            {:else}
              <button role="menuitem" onclick={() => run(entry.item.command)}>
                <span>{titleOf(entry.item)}</span>
                <span class="shortcut">{shortcutOf(entry.item.command)}</span>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="host" class:compact bind:this={nav} onkeydown={onKeydown}>
  {#if compact}
    <button
      class="menu-button"
      class:open={expanded}
      aria-label={t('Menu')}
      title={t('Menu (Alt)')}
      aria-haspopup="menu"
      aria-expanded={expanded}
      onclick={() => (expanded ? close(false) : open(false))}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg
      >
    </button>
  {/if}
  {#if shown}
    <div
      class="menubar"
      role="menubar"
      tabindex="-1"
      aria-orientation={compact ? 'vertical' : 'horizontal'}
    >
      {@render menus()}
    </div>
  {/if}
</div>

<style>
  .host {
    position: relative;
    display: flex;
    align-items: center;
    flex: none;
    user-select: none;
  }

  button {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: default;
  }

  .menu-button {
    display: grid;
    width: 30px;
    height: 28px;
    margin: 0 2px 0 6px;
    border-radius: 6px;
    color: var(--ui-fg);
    place-items: center;
  }

  .menu-button:hover,
  .menu-button.open {
    background: var(--ui-hover);
    color: var(--fg);
  }

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.3;
  }

  .menubar {
    display: flex;
    align-items: center;
    padding: 0 4px;
  }

  .compact .menubar {
    position: absolute;
    top: calc(100% + 4px);
    left: 6px;
    z-index: 100;
    flex-direction: column;
    align-items: stretch;
    min-width: 190px;
    padding: 5px;
    background: var(--menu-bg);
    border: 1px solid var(--ui-border);
    border-radius: 10px;
    box-shadow: var(--menu-shadow);
    animation: pop 120ms ease-out;
  }

  .menu {
    position: relative;
  }

  .top {
    height: 26px;
    padding: 0 9px;
    border-radius: 6px;
    color: var(--ui-fg);
  }

  .compact .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 30px;
    padding: 0 6px 0 10px;
    color: var(--fg);
    text-align: left;
  }

  .chevron {
    width: 14px;
    height: 14px;
    color: var(--ui-fg);
  }

  .top:hover,
  .top.open,
  .top:focus-visible {
    background: var(--ui-hover);
    color: var(--fg);
    outline: none;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    min-width: 270px;
    max-height: calc(100vh - 56px);
    overflow-y: auto;
    scrollbar-width: thin;
    padding: 5px;
    background: var(--menu-bg);
    border: 1px solid var(--ui-border);
    border-radius: 10px;
    box-shadow: var(--menu-shadow);
    animation: pop 120ms ease-out;
  }

  .compact .dropdown {
    top: -6px;
    left: calc(100% + 6px);
  }

  .dropdown button {
    display: flex;
    flex: none;
    white-space: nowrap;
    justify-content: space-between;
    gap: 24px;
    padding: 6px 10px;
    border-radius: 6px;
    text-align: left;
    color: var(--fg);
  }

  .dropdown button:hover,
  .dropdown button:focus-visible {
    background: var(--menu-active-bg);
    color: var(--menu-active-fg);
    outline: none;
  }

  .shortcut {
    color: var(--ui-fg);
    font-size: 12px;
  }

  .separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--ui-border);
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .compact .menubar,
    .dropdown {
      animation: none;
    }
  }
</style>
