<script lang="ts" module>
  import { SvelteSet } from 'svelte/reactivity';

  /** Sub-menus left unfolded, kept while switching families ("menu:group"). */
  const unfolded = new SvelteSet<string>();
</script>

<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import type { PanelSide, PanelSpec } from '../api';
  import type { Workbench } from '../app/workbench';
  import { t } from '../core/i18n/i18n';
  import { formatKeySequence } from '../core/keybindings/keys';
  import type { MenuItemSpec } from '../core/menus/registry';
  import { platform } from '../core/platform';

  /**
   * A side panel. On the left it is the menu of the app: a column of tool
   * icons (Folders, Search…) under the menu button, and level with the tabs a
   * row of menu icons (File, Edit…). Below come the panel's content and its
   * commands, by sub-menu, with a field to search every command.
   */
  let { workbench, panel, side }: { workbench: Workbench; panel: PanelSpec; side: PanelSide } =
    $props();

  const MENU_ICON = 'M4 6h16M4 12h16M4 18h16';
  const CHEVRON = 'M9 18l6-6-6-6';
  const SEARCH_ICON = 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3';

  let host = $state<HTMLElement>();
  let version = $state(0);
  let query = $state('');

  const left = $derived(side === 'left');
  const placeOf = (p: PanelSpec) => p.place ?? (p.render ? 'rail' : 'top');
  const siblings = $derived(workbench.panels.of(side));
  const menus = $derived(siblings.filter((p) => placeOf(p) === 'top'));
  const tools = $derived(siblings.filter((p) => placeOf(p) === 'rail'));
  /** Menus list commands: they get the search field. */
  const searchable = $derived(placeOf(panel) === 'top');
  const actions = $derived(panel.actions?.() ?? []);
  const mac = isTauri() && platform() === 'macos';

  interface Row {
    command: string;
    title: string;
    shortcut: string;
    /** Icon of its sub-menu, shown beside search results. */
    icon?: string;
  }
  interface Section {
    key: string;
    title?: string;
    icon?: string;
    rows: Row[];
  }

  const commandTitles = $derived.by(() => {
    void version;
    return new Map(workbench.commands.list().map((c) => [c.id, c.title ?? c.id]));
  });

  function rowOf(item: MenuItemSpec, icon?: string): Row {
    const binding = workbench.keybindings.forCommand(item.command)[0];
    return {
      command: item.command,
      title: item.title ?? commandTitles.get(item.command) ?? item.command,
      shortcut: binding ? formatKeySequence(binding.chords) : '',
      icon,
    };
  }

  function sectionsOf(menuId: string): Section[] {
    return workbench.menus.sections(menuId).map((s) => ({
      key: `${menuId}:${s.group}`,
      title: s.spec?.title,
      icon: s.spec?.icon,
      rows: s.items.map((item) => rowOf(item, s.spec?.icon)),
    }));
  }

  /** The panel's menus, by sub-menu. */
  const sections = $derived.by(() => {
    void version;
    return (panel.menus ?? []).flatMap(sectionsOf);
  });

  /** Lower case without accents, so "preference" finds "Préférences". */
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /** Every command of every menu matching the search. */
  const results = $derived.by(() => {
    void version;
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    return workbench.menus
      .bar()
      .flatMap((m) => sectionsOf(m.id))
      .flatMap((s) => s.rows)
      .filter((row) => words.every((w) => fold(row.title).includes(w)));
  });

  $effect(() => {
    const changed = workbench.menus.onDidChange.on(() => version++);
    return () => changed.dispose();
  });

  $effect(() => {
    if (!host || !panel.render) return;
    const content = panel.render(host);
    return () => content.dispose();
  });

  function run(command: string) {
    workbench.workspace.editorView()?.focus();
    workbench.commands.execute(command).catch((err: unknown) => console.error(err));
  }

  function toggleSide() {
    workbench.panels.toggleSide('left');
    workbench.workspace.editorView()?.focus();
  }

  function fold_(key: string) {
    if (unfolded.has(key)) unfolded.delete(key);
    else unfolded.add(key);
  }
</script>

{#snippet icon(d: string, extra = '')}
  <svg class="icon {extra}" viewBox="0 0 24 24" aria-hidden="true"><path {d} /></svg>
{/snippet}

{#snippet family(p: PanelSpec)}
  <button
    role="tab"
    class="family"
    class:named={!p.icon}
    aria-selected={p.id === panel.id}
    aria-label={p.title}
    title={p.title}
    onclick={() => workbench.panels.show(p.id)}
  >
    {#if p.icon}{@render icon(p.icon)}{:else}{p.title}{/if}
  </button>
{/snippet}

{#snippet commandRow(row: Row, withIcon: boolean)}
  <button role="menuitem" class="command" title={row.title} onclick={() => run(row.command)}>
    {#if withIcon}{@render icon(row.icon ?? '', 'small')}{/if}
    <span class="label">{row.title}</span>
    {#if row.shortcut}<span class="value">{row.shortcut}</span>{/if}
  </button>
{/snippet}

<aside class="panel {side}" aria-label={panel.title}>
  {#if left}
    <nav class="rail" class:mac aria-label={t('Tools')}>
      <button class="family" aria-label={t('Menu')} title={t('Menu (Alt)')} onclick={toggleSide}>
        {@render icon(MENU_ICON)}
      </button>
      <div
        class="families vertical"
        role="tablist"
        aria-label={t('Tools')}
        aria-orientation="vertical"
      >
        {#each tools as tool (tool.id)}{@render family(tool)}{/each}
      </div>
    </nav>
    <div class="column">
      <div class="top" class:mac data-tauri-drag-region>
        <div class="families" role="tablist" aria-label={t('Menus')}>
          {#each menus as menu (menu.id)}{@render family(menu)}{/each}
        </div>
        <div class="drag" data-tauri-drag-region></div>
      </div>
      {#if actions.length > 0}
        <div class="actions">
          {#each actions as action (action.label)}
            <button
              class="action"
              title={action.label}
              aria-label={action.label}
              onclick={action.run}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d={action.icon} /></svg>
            </button>
          {/each}
        </div>
      {/if}
      {@render main()}
    </div>
  {:else}
    <header>
      <h2>{panel.title}</h2>
      {#each actions as action (action.label)}
        <button class="action" title={action.label} aria-label={action.label} onclick={action.run}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d={action.icon} /></svg>
        </button>
      {/each}
      <button
        class="close"
        aria-label={t('Close the panel')}
        title={t('Close')}
        onclick={() => workbench.panels.hide(panel.id)}>×</button
      >
    </header>
    {@render main()}
  {/if}
</aside>

{#snippet main()}
  {#if searchable}
    <label class="search">
      {@render icon(SEARCH_ICON, 'small')}
      <input
        type="search"
        placeholder={t('Search…')}
        aria-label={t('Search the commands')}
        bind:value={query}
      />
    </label>
  {/if}
  <div class="body">
    {#if results}
      <div class="list" role="menu" aria-label={t('Commands')}>
        {#each results as row (row.command)}{@render commandRow(row, true)}{/each}
        {#if results.length === 0}<p class="none">{t('No command found')}</p>{/if}
      </div>
    {:else}
      {#if panel.render}<div class="content" bind:this={host}></div>{/if}
      {#if sections.length > 0}
        {#if panel.render}<div class="separator" role="separator"></div>{/if}
        <div class="list" role="menu" aria-label={panel.title}>
          {#each sections as section (section.key)}
            {#if section.title}
              <button
                class="row"
                aria-expanded={unfolded.has(section.key)}
                onclick={() => fold_(section.key)}
              >
                {@render icon(CHEVRON, 'chevron')}
                {@render icon(section.icon ?? '')}
                <span class="label">{section.title}</span>
                <span class="value">{section.rows.length}</span>
              </button>
              {#if unfolded.has(section.key)}
                <div class="items" role="group" aria-label={section.title}>
                  {#each section.rows as row (row.command)}{@render commandRow(row, false)}{/each}
                </div>
              {/if}
            {:else}
              {#each section.rows as row (row.command)}{@render commandRow(row, false)}{/each}
            {/if}
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    flex: none;
    width: 320px;
    min-height: 0;
    background: var(--ui-bg);
  }

  .panel.right {
    border-left: 1px solid var(--ui-border);
  }

  .panel.left {
    flex-direction: row;
    width: 310px;
    border-right: 1px solid var(--ui-border);
  }

  /* The tools, in a column under the menu button. */
  .rail {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 44px;
    padding-top: 6px;
    border-right: 1px solid var(--ui-border);
  }

  .rail.mac {
    padding-top: 34px;
  }

  .column {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  button {
    border: none;
    background: none;
    color: var(--ui-fg);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
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
    width: 15px;
    height: 15px;
    color: var(--ui-fg);
  }

  .icon.chevron {
    width: 13px;
    height: 13px;
    color: var(--ui-fg);
    transition: transform 120ms;
  }

  [aria-expanded='true'] > .chevron {
    transform: rotate(90deg);
  }

  /* Level with the tab bar: the menu button, then one icon per family. */
  .top {
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: 40px;
    padding: 0 6px;
  }

  .top.mac {
    padding-left: 32px;
  }

  .families {
    display: flex;
    gap: 2px;
  }

  .families.vertical {
    flex-direction: column;
    margin-top: 8px;
  }

  .family {
    display: grid;
    width: 30px;
    height: 28px;
    padding: 0;
    border-radius: 7px;
    place-items: center;
    transition: background-color 120ms;
  }

  .family.named {
    width: auto;
    padding: 0 8px;
    font-size: 12px;
  }

  .family:hover,
  .family[aria-selected='true'] {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .drag {
    flex: 1;
    align-self: stretch;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 2px;
    padding: 2px 10px 0;
  }

  header {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 36px;
    padding: 4px 8px 4px 14px;
  }

  h2 {
    flex: 1;
    margin: 0;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .action,
  .close {
    display: grid;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 6px;
    place-items: center;
  }

  .close {
    font-size: 16px;
    line-height: 1;
  }

  .action:hover,
  .close:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .action svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.2;
  }

  .search {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    margin: 6px 10px 8px;
    padding: 0 10px;
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    background: var(--bg);
  }

  .search:focus-within {
    border-color: var(--accent);
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 30px;
    padding: 0;
    border: none;
    background: none;
    color: var(--fg);
    font: inherit;
    outline: none;
  }

  .search input::placeholder {
    color: var(--ui-fg);
  }

  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  /* The content takes the room left above the commands, so clicks below it still reach it. */
  .content {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
  }

  .content > :global(*) {
    flex: 1 0 auto;
  }

  .list {
    display: flex;
    flex-direction: column;
    padding: 0 8px 8px;
  }

  .row,
  .command {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    color: var(--fg);
    text-align: left;
  }

  .row:hover,
  .command:hover {
    background: var(--ui-hover);
  }

  .items {
    display: flex;
    flex-direction: column;
    margin: 2px 0 6px 20px;
    padding-left: 6px;
    border-left: 1px solid var(--ui-border);
  }

  .items .command {
    padding: 5px 8px;
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value {
    flex: none;
    color: var(--ui-fg);
    font-size: 11px;
  }

  .separator {
    flex: none;
    height: 1px;
    margin: 6px 16px;
    background: var(--ui-border);
  }

  .none {
    margin: 8px;
    color: var(--ui-fg);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon.chevron {
      transition: none;
    }
  }
</style>
