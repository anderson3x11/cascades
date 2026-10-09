<script lang="ts">
  import { onMount } from 'svelte';
  import { t, type ContextMenuItem, type ExtensionContext, type StatusMenu } from '../../api';

  /**
   * The Display panel: the status bar menus (Display, Font, Theme…) as
   * sections that unfold in place, and the light or dark switch.
   */
  let { ctx }: { ctx: ExtensionContext } = $props();

  // Lucide icons (lucide.dev, ISC license), on their 24×24 grid.
  const SUN =
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41';
  const MOON = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z';

  let version = $state(0);
  let open = $state<string | null>(null);
  const sections = $derived.by(() => {
    void version;
    return ctx.statusBar.menus();
  });
  /** Items of the open section, built again when a setting changes. */
  const opened = $derived.by((): StatusMenu | null => {
    void version;
    return sections.find((s) => s.id === open)?.menu() ?? null;
  });
  const dark = $derived.by(() => {
    void version;
    return ctx.themes.current()?.type === 'dark';
  });

  onMount(() => {
    const changed = ctx.settings.onDidChange(() => version++);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const bump = () => version++;
    media.addEventListener('change', bump);
    return () => {
      changed.dispose();
      media.removeEventListener('change', bump);
    };
  });

  function toggle(id: string) {
    if (open === id) opened?.onCancel?.();
    open = open === id ? null : id;
  }

  function pick(item: Extract<ContextMenuItem, { run: () => void }>) {
    item.run();
    version++;
  }

  const isHeading = (item: ContextMenuItem): item is { heading: string } =>
    typeof item === 'object' && 'heading' in item;
</script>

<div class="display">
  {#each sections as section (section.id)}
    <button class="row" aria-expanded={open === section.id} onclick={() => toggle(section.id)}>
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      {#if section.icon}<svg viewBox="0 0 24 24" aria-hidden="true"><path d={section.icon} /></svg
        >{/if}
      <span class="label">{section.label}</span>
      <!-- The current value (font, theme); the Display button only shows its name. -->
      {#if section.id !== 'display'}<span class="value">{section.text}</span>{/if}
    </button>
    {#if open === section.id && opened}
      <div
        class="items"
        role="menu"
        aria-label={section.label}
        tabindex="-1"
        onpointerleave={() => opened?.onCancel?.()}
      >
        {#each opened.items as item, i (i)}
          {#if item === 'separator'}
            <div class="separator" role="separator"></div>
          {:else if isHeading(item)}
            <div class="heading" role="presentation">{item.heading}</div>
          {:else}
            <button
              class="item"
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              disabled={item.disabled}
              onpointerenter={() => item.preview?.()}
              onfocus={() => item.preview?.()}
              onclick={() => pick(item)}
            >
              <svg class="check" class:on={item.checked} viewBox="0 0 24 24" aria-hidden="true"
                ><path d="M20 6L9 17l-5-5" /></svg
              >
              <span class="label" style:font-family={item.font}>{item.label}</span>
              {#if item.shortcut}<span class="value">{item.shortcut}</span>{/if}
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  {/each}
  <button class="row" onclick={() => void ctx.commands.execute('view.toggleLightDark')}>
    <span class="chevron"></span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={dark ? MOON : SUN} /></svg>
    <span class="label">{dark ? t('Dark') : t('Light')}</span>
  </button>
</div>

<style>
  .display {
    display: flex;
    flex-direction: column;
    padding: 0 8px 4px;
  }

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    background: var(--ui-hover);
    outline: none;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  svg {
    flex: none;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.75;
  }

  .chevron {
    width: 12px;
    height: 12px;
    color: var(--ui-fg);
    transition: transform 120ms;
  }

  [aria-expanded='true'] .chevron {
    transform: rotate(90deg);
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
    max-width: 45%;
    overflow: hidden;
    color: var(--ui-fg);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .items {
    display: flex;
    flex-direction: column;
    margin: 2px 0 6px 20px;
    padding-left: 6px;
    border-left: 1px solid var(--ui-border);
    outline: none;
  }

  .item {
    padding: 5px 8px;
  }

  .check {
    width: 13px;
    height: 13px;
    stroke: var(--accent);
    stroke-width: 2.5;
    visibility: hidden;
  }

  .check.on {
    visibility: visible;
  }

  .heading {
    padding: 8px 8px 2px;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--ui-border);
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
