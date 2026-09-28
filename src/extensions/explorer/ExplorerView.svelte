<script lang="ts">
  import { tick } from 'svelte';
  import type { ExtensionContext } from '../../api';
  import type { ExplorerModel, Row } from './model.svelte';
  import { baseName, parentOf, samePath } from './paths';

  let { ctx, model }: { ctx: ExtensionContext; model: ExplorerModel } = $props();

  let tree = $state<HTMLElement>();
  let inputError = $state<string | null>(null);

  type Item = { kind: 'row'; row: Row } | { kind: 'input'; depth: number; isDir: boolean };

  /** Rows, with the field of a new entry at the top of its folder. */
  const items = $derived.by((): Item[] => {
    const rows = model.rows();
    const editing = model.editing;
    const out: Item[] = [];
    const newEntry = editing && editing.kind !== 'rename' ? editing : null;
    const field = (depth: number): Item => ({
      kind: 'input',
      depth,
      isDir: newEntry?.kind === 'folder',
    });
    if (newEntry && newEntry.dir === model.root) out.push(field(0));
    for (const row of rows) {
      out.push({ kind: 'row', row });
      if (newEntry && row.isDir && row.path === newEntry.dir) out.push(field(row.depth + 1));
    }
    return out;
  });

  const visibleRows = $derived(items.flatMap((i) => (i.kind === 'row' ? [i.row] : [])));
  const idOf = (path: string) => `explorer-${samePath(path).replace(/[^a-z0-9]/g, '-')}`;
  const renaming = (row: Row) =>
    model.editing?.kind === 'rename' && model.editing.path === row.path;

  /** Opens a file, or folds a folder. */
  async function activate(row: Row) {
    model.selected = row.path;
    if (row.isDir) await model.toggle(row.path);
    else await ctx.commands.execute('file.openPath', row.path);
  }

  function select(path: string) {
    model.selected = path;
    void tick().then(() =>
      document.getElementById(idOf(path))?.scrollIntoView({ block: 'nearest' }),
    );
  }

  function onKeydown(event: KeyboardEvent) {
    if (model.editing) return;
    const rows = visibleRows;
    const index = rows.findIndex((r) => r.path === model.selected);
    const row = rows[index];
    const move = (delta: number) => {
      const next = rows[Math.min(Math.max(index + delta, 0), rows.length - 1)];
      if (next) select(next.path);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(1);
        break;
      case 'ArrowUp':
        move(-1);
        break;
      case 'Home':
        if (rows[0]) select(rows[0].path);
        break;
      case 'End':
        if (rows.at(-1)) select((rows.at(-1) as Row).path);
        break;
      case 'ArrowRight':
        if (row?.isDir && !row.expanded) void model.expand(row.path);
        else if (row?.isDir) move(1);
        break;
      case 'ArrowLeft':
        if (row?.isDir && row.expanded) model.collapse(row.path);
        else if (row && parentOf(row.path) !== model.root) select(parentOf(row.path));
        break;
      case 'Enter':
        if (row) void activate(row);
        break;
      case 'F2':
        if (row) model.startRename(row.path);
        break;
      case 'Delete':
        if (row) void model.trash(row.path);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function showMenu(event: MouseEvent, row: Row | null) {
    event.preventDefault();
    if (row) model.selected = row.path;
    const dir = model.folderFor(row?.path ?? null) ?? model.root;
    if (!dir) return;
    const entryItems = row
      ? [
          'separator' as const,
          { label: 'Renommer', shortcut: 'F2', run: () => model.startRename(row.path) },
          {
            label: 'Mettre à la corbeille',
            shortcut: 'Suppr',
            run: () => void model.trash(row.path),
          },
          'separator' as const,
          { label: 'Copier le chemin', run: () => void navigator.clipboard.writeText(row.path) },
        ]
      : [];
    ctx.contextMenu.show({ x: event.clientX, y: event.clientY }, [
      { label: 'Nouveau fichier', run: () => void model.startNew('file', dir) },
      { label: 'Nouveau dossier', run: () => void model.startNew('folder', dir) },
      ...entryItems,
    ]);
  }

  /** Focuses the name field when it appears, with the name but not the extension selected. */
  function field(input: HTMLInputElement) {
    inputError = null;
    input.focus();
    const editing = model.editing;
    if (editing?.kind === 'rename') {
      const name = baseName(editing.path);
      const dot = editing.isDir ? -1 : name.lastIndexOf('.');
      input.setSelectionRange(0, dot > 0 ? dot : name.length);
    }
  }

  async function commit(input: HTMLInputElement) {
    if (!model.editing) return;
    if (input.value.trim() === '' && model.editing.kind !== 'rename') {
      model.editing = null;
      return;
    }
    inputError = await model.commit(input.value);
    if (inputError) input.focus();
    else tree?.focus();
  }

  function onFieldKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit(event.currentTarget as HTMLInputElement);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      model.editing = null;
      inputError = null;
      tree?.focus();
    }
  }

  const indent = (depth: number) => `${8 + depth * 14}px`;
</script>

{#if !model.root}
  <div class="empty">
    <p>Aucun dossier ouvert.</p>
    <button class="primary" onclick={() => ctx.commands.execute('explorer.openFolder')}>
      Ouvrir un dossier…
    </button>
  </div>
{:else}
  <div class="toolbar">
    <span class="folder" title={model.root}>{baseName(model.root)}</span>
    <button
      class="icon"
      title="Nouveau fichier"
      aria-label="Nouveau fichier"
      onclick={() =>
        model.startNew('file', model.folderFor(model.selected) ?? (model.root as string))}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"
        ><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9 1.5Z" /><path
          d="M9 1.5v4h4M8 8v4M6 10h4"
        /></svg
      >
    </button>
    <button
      class="icon"
      title="Nouveau dossier"
      aria-label="Nouveau dossier"
      onclick={() =>
        model.startNew('folder', model.folderFor(model.selected) ?? (model.root as string))}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"
        ><path
          d="M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4Z"
        /><path d="M8 7v4M6 9h4" /></svg
      >
    </button>
    <button
      class="icon"
      title="Tout replier"
      aria-label="Tout replier"
      onclick={() => model.collapseAll()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" /></svg>
    </button>
  </div>

  {#if model.error}<p class="error" role="alert">{model.error}</p>{/if}

  <div
    class="tree"
    role="tree"
    tabindex="0"
    aria-label="Fichiers de {baseName(model.root)}"
    aria-activedescendant={model.selected ? idOf(model.selected) : undefined}
    bind:this={tree}
    onkeydown={onKeydown}
    onfocusin={() => ctx.context.set('explorerFocus', true)}
    onfocusout={() => ctx.context.set('explorerFocus', false)}
    oncontextmenu={(e) => {
      if (e.target === e.currentTarget) showMenu(e, null);
    }}
  >
    {#each items as item (item.kind === 'row' ? item.row.path : 'new-entry')}
      {#if item.kind === 'input'}
        <div class="row editing" style:padding-left={indent(item.depth)}>
          <span class="chevron" aria-hidden="true">{item.isDir ? '▸' : ''}</span>
          <input
            aria-label={item.isDir ? 'Nom du nouveau dossier' : 'Nom du nouveau fichier'}
            spellcheck="false"
            use:field
            onkeydown={onFieldKeydown}
            onblur={(e) => void commit(e.currentTarget)}
          />
        </div>
        {#if inputError}<p class="field-error" style:padding-left={indent(item.depth + 1)}>
            {inputError}
          </p>{/if}
      {:else}
        {@const row = item.row}
        <!-- The keys are handled by the tree, which points to the selected row. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          id={idOf(row.path)}
          class="row"
          class:selected={model.selected === row.path}
          class:active={model.activePath !== null &&
            samePath(model.activePath) === samePath(row.path)}
          role="treeitem"
          tabindex="-1"
          aria-level={row.depth + 1}
          aria-expanded={row.isDir ? row.expanded : undefined}
          aria-selected={model.selected === row.path}
          title={row.path}
          style:padding-left={indent(row.depth)}
          onclick={() => void activate(row)}
          oncontextmenu={(e) => showMenu(e, row)}
        >
          <span class="chevron" class:open={row.expanded} aria-hidden="true"
            >{row.isDir ? '▸' : ''}</span
          >
          {#if renaming(row)}
            <input
              aria-label="Nouveau nom de {row.name}"
              spellcheck="false"
              value={row.name}
              use:field
              onclick={(e) => e.stopPropagation()}
              onkeydown={onFieldKeydown}
              onblur={(e) => void commit(e.currentTarget)}
            />
          {:else}
            <span class="name" class:dir={row.isDir}>{row.name}</span>
          {/if}
        </div>
        {#if renaming(row) && inputError}<p
            class="field-error"
            style:padding-left={indent(row.depth + 1)}
          >
            {inputError}
          </p>{/if}
      {/if}
    {:else}
      <p class="hint">Ce dossier est vide.</p>
    {/each}
  </div>
{/if}

<style>
  .empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    padding: 14px 12px;
    color: var(--ui-fg);
    font-size: 13px;
  }

  .empty p {
    margin: 0;
  }

  .primary {
    padding: 5px 12px;
    border: none;
    border-radius: 5px;
    background: var(--accent);
    color: var(--menu-active-fg);
    font: inherit;
    cursor: pointer;
  }

  .toolbar {
    display: flex;
    gap: 2px;
    align-items: center;
    padding: 6px 6px 4px 12px;
  }

  .folder {
    flex: 1;
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon {
    display: grid;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--ui-fg);
    cursor: pointer;
    place-items: center;
  }

  .icon:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .icon svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.2;
  }

  .error {
    margin: 4px 12px;
    padding: 6px 8px;
    border-radius: 5px;
    background: var(--banner-warning-bg);
    font-size: 12px;
  }

  .tree {
    padding-bottom: 12px;
    outline: none;
    font-size: 13px;
  }

  .row {
    display: flex;
    gap: 4px;
    align-items: center;
    height: 24px;
    padding-right: 8px;
    cursor: pointer;
    user-select: none;
  }

  .row:hover {
    background: var(--ui-hover);
  }

  .row.selected {
    background: var(--ui-hover);
  }

  .tree:focus-visible .row.selected {
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .row.active .name {
    color: var(--accent);
  }

  .chevron {
    flex: none;
    width: 12px;
    color: var(--ui-fg);
    font-size: 12px;
    text-align: center;
    transition: transform 120ms;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 1px 4px;
    border: 1px solid var(--accent);
    border-radius: 3px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
    outline: none;
  }

  .field-error {
    margin: 2px 8px 4px;
    color: var(--syn-invalid);
    font-size: 12px;
  }

  .hint {
    margin: 4px 12px;
    color: var(--ui-fg);
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
