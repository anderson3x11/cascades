<script lang="ts">
  import { tick } from 'svelte';
  import type { QuickPickItem } from '../api';
  import type { Workbench } from '../app/workbench';
  import { fuzzyFilter } from '../core/fuzzy';

  let { workbench }: { workbench: Workbench } = $props();
  const model = $derived(workbench.quickPick);

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();

  const session = $derived(model.session);
  const matches = $derived(session ? fuzzyFilter(query, session.items, (item) => item.label) : []);
  /** Only the best ones are drawn: typing more narrows the rest down. */
  const MAX_SHOWN = 200;
  const results = $derived(matches.slice(0, MAX_SHOWN));

  /** The list being shown: items added to it later keep the query typed. */
  let shownFor: unknown = null;

  // A new session starts on its active value with an empty query.
  $effect(() => {
    const s = session;
    if (!s || s.resolve === shownFor) return;
    shownFor = s.resolve;
    query = '';
    const index = s.items.findIndex((item) => item.value === s.options.activeValue);
    active = Math.max(0, index);
    void tick().then(() => {
      input?.focus();
      scrollToActive();
    });
  });

  // Tell the caller about the highlighted item (theme preview...).
  $effect(() => {
    const item = results[active]?.item;
    if (item && session) session.options.onHighlight?.(item);
  });

  function scrollToActive() {
    list?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function move(delta: number) {
    if (results.length === 0) return;
    active = (active + delta + results.length) % results.length;
    void tick().then(scrollToActive);
  }

  function close(item: QuickPickItem<unknown> | undefined) {
    model.close(item?.value);
    workbench.workspace.editorView()?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') move(1);
    else if (event.key === 'ArrowUp') move(-1);
    else if (event.key === 'Enter') close(results[active]?.item);
    else if (event.key === 'Escape') close(undefined);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  /** Label split into matched and unmatched runs, for highlighting. */
  function parts(label: string, indices: number[]): { text: string; hit: boolean }[] {
    const hits = new Set(indices);
    const out: { text: string; hit: boolean }[] = [];
    [...label].forEach((ch, i) => {
      const hit = hits.has(i);
      const last = out[out.length - 1];
      if (last && last.hit === hit) last.text += ch;
      else out.push({ text: ch, hit });
    });
    return out;
  }
</script>

{#if session}
  <div class="backdrop" role="presentation" onpointerdown={() => close(undefined)}></div>
  <div class="picker" role="dialog" aria-label={session.options.placeholder ?? 'Sélection'}>
    <input
      bind:this={input}
      bind:value={query}
      placeholder={session.options.placeholder ?? ''}
      oninput={() => (active = 0)}
      onkeydown={onKeydown}
      role="combobox"
      aria-expanded="true"
      aria-controls="quick-pick-list"
      spellcheck="false"
    />
    <ul id="quick-pick-list" role="listbox" bind:this={list}>
      {#each results as { item, match }, i (i)}
        <li
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onpointermove={() => (active = i)}
          onpointerdown={(e) => {
            e.preventDefault();
            close(item);
          }}
        >
          <span class="label">
            {#each parts(item.label, match.indices) as part, p (p)}
              {#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}
            {/each}
          </span>
          {#if item.description}<span class="description">{item.description}</span>{/if}
        </li>
      {:else}
        <li class="empty">Aucun résultat</li>
      {/each}
      {#if matches.length > results.length}
        <li class="empty">
          {matches.length - results.length} autres résultats : précise la recherche.
        </li>
      {/if}
    </ul>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  .picker {
    position: fixed;
    top: 56px;
    left: 50%;
    z-index: 201;
    display: flex;
    flex-direction: column;
    width: min(560px, calc(100vw - 32px));
    max-height: min(420px, calc(100vh - 80px));
    transform: translateX(-50%);
    padding: 6px;
    background: var(--menu-bg);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    box-shadow: var(--menu-shadow);
  }

  input {
    padding: 7px 10px;
    border: 1px solid var(--ui-border);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
    font-size: 14px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  ul {
    margin: 6px 0 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
  }

  li.active {
    background: var(--menu-active-bg);
    color: var(--menu-active-fg);
  }

  mark {
    background: none;
    color: var(--accent);
    font-weight: 600;
  }

  li.active mark {
    color: inherit;
    text-decoration: underline;
  }

  .description {
    color: var(--ui-fg);
    font-size: 12px;
  }

  li.active .description {
    color: inherit;
    opacity: 0.8;
  }

  .empty {
    color: var(--ui-fg);
    cursor: default;
  }
</style>
