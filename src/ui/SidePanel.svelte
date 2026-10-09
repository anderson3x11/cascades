<script lang="ts">
  import { onMount } from 'svelte';
  import type { PanelSide, PanelSpec } from '../api';
  import type { Workbench } from '../app/workbench';
  import { t } from '../core/i18n/i18n';
  import { formatKeySequence } from '../core/keybindings/keys';

  let { workbench, panel, side }: { workbench: Workbench; panel: PanelSpec; side: PanelSide } =
    $props();

  let host = $state<HTMLElement>();
  let version = $state(0);

  /** The panels of this side, shown as icons (or names) when there are several. */
  const siblings = $derived(workbench.panels.of(side));
  const actions = $derived(panel.actions?.() ?? []);

  /** The menus the panel lists, each with its commands. */
  const menus = $derived.by(() => {
    void version;
    const titles = new Map(workbench.menus.bar().map((m) => [m.id, m.title]));
    const commands = new Map(workbench.commands.list().map((c) => [c.id, c.title ?? c.id]));
    return (panel.menus ?? []).map((id) => ({
      id,
      title: titles.get(id) ?? id,
      // A menu named like the panel (the Edit menu in the Edit panel) needs no heading.
      own: titles.get(id) === panel.title,
      entries: workbench.menus.entries(id).map((entry) =>
        entry.kind === 'separator'
          ? null
          : {
              command: entry.item.command,
              title: entry.item.title ?? commands.get(entry.item.command) ?? entry.item.command,
              shortcut: shortcutOf(entry.item.command),
            },
      ),
    }));
  });
  /** A heading over each menu, unless the panel is a single list of commands. */
  const headings = $derived(menus.length > 1 || !!panel.render);

  function shortcutOf(command: string): string {
    const binding = workbench.keybindings.forCommand(command)[0];
    return binding ? formatKeySequence(binding.chords) : '';
  }

  function run(command: string) {
    workbench.workspace.editorView()?.focus();
    workbench.commands.execute(command).catch((err: unknown) => console.error(err));
  }

  onMount(() => {
    const changed = workbench.menus.onDidChange.on(() => version++);
    return () => changed.dispose();
  });

  $effect(() => {
    if (!host || !panel.render) return;
    const content = panel.render(host);
    return () => content.dispose();
  });
</script>

<aside class="panel {side}" aria-label={panel.title}>
  {#if siblings.length > 1}
    <div class="families" role="tablist" aria-label={t('Panels')}>
      {#each siblings as sibling (sibling.id)}
        <button
          role="tab"
          class="family"
          class:named={!sibling.icon}
          aria-selected={sibling.id === panel.id}
          aria-label={sibling.title}
          title={sibling.title}
          onclick={() => workbench.panels.show(sibling.id)}
        >
          {#if sibling.icon}
            <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"
              ><path d={sibling.icon} /></svg
            >
          {:else}
            {sibling.title}
          {/if}
        </button>
      {/each}
      <button
        class="close"
        aria-label={t('Close the panel')}
        title={t('Close')}
        onclick={() => workbench.panels.hide(panel.id)}>×</button
      >
    </div>
  {/if}
  <header>
    <h2>{panel.title}</h2>
    <span class="actions">
      {#each actions as action (action.label)}
        <button class="action" title={action.label} aria-label={action.label} onclick={action.run}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d={action.icon} /></svg>
        </button>
      {/each}
    </span>
    {#if siblings.length <= 1}
      <button
        class="close"
        aria-label={t('Close the panel')}
        title={t('Close')}
        onclick={() => workbench.panels.hide(panel.id)}>×</button
      >
    {/if}
  </header>
  <div class="body">
    {#if panel.render}<div class="content" bind:this={host}></div>{/if}
    {#each menus as menu (menu.id)}
      <div class="commands" role="menu" aria-label={menu.title}>
        {#if headings && menu.own && panel.render}
          <div class="separator" role="separator"></div>
        {:else if headings && !menu.own}
          <h3>{menu.title}</h3>
        {/if}
        {#each menu.entries as entry, i (i)}
          {#if entry === null}
            <div class="separator" role="separator"></div>
          {:else}
            <button
              role="menuitem"
              class="command"
              title={entry.title}
              onclick={() => run(entry.command)}
            >
              <span class="label">{entry.title}</span>
              {#if entry.shortcut}<span class="shortcut">{entry.shortcut}</span>{/if}
            </button>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
</aside>

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
    width: 270px;
    border-right: 1px solid var(--ui-border);
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

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.2;
  }

  .families {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px;
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

  .family:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .family[aria-selected='true'] {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .lucide {
    width: 17px;
    height: 17px;
    stroke-width: 1.75;
  }

  header {
    display: flex;
    align-items: center;
    min-height: 32px;
    padding: 2px 8px 2px 14px;
  }

  h2,
  h3 {
    margin: 0;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .actions {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .action {
    display: grid;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 6px;
    place-items: center;
  }

  .action:hover,
  .close:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .close {
    width: 24px;
    height: 24px;
    margin-left: auto;
    padding: 0;
    border-radius: 6px;
    font-size: 16px;
    line-height: 1;
  }

  header .close {
    margin-left: 2px;
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

  .commands {
    display: flex;
    flex-direction: column;
    padding: 0 8px 8px;
  }

  h3 {
    padding: 12px 6px 4px;
  }

  .command {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 8px;
    border-radius: 6px;
    color: var(--fg);
    text-align: left;
  }

  .command:hover {
    background: var(--ui-hover);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shortcut {
    flex: none;
    color: var(--ui-fg);
    font-size: 11px;
  }

  .separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--ui-border);
  }
</style>
