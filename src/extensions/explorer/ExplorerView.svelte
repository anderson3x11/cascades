<script lang="ts">
  import { tick } from 'svelte';
  import type { ExtensionContext } from '../../api';
  import type { ExplorerModel, Row } from './model.svelte';
  import { ICON_PATHS, iconFor } from './icons';
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
        else if (row && !model.isRoot(row.path)) select(parentOf(row.path));
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
    event.stopPropagation();
    tree?.focus();
    const at = { x: event.clientX, y: event.clientY };
    if (!row) {
      ctx.contextMenu.show(at, [
        {
          label: 'Ajouter un dossier…',
          run: () => void ctx.commands.execute('explorer.addFolder'),
        },
        { label: 'Tout replier', run: () => model.collapseAll(), disabled: !model.roots.length },
      ]);
      return;
    }
    model.selected = row.path;
    const dir = model.folderFor(row.path) as string;
    const copy = {
      label: 'Copier le chemin',
      run: () => void navigator.clipboard.writeText(row.path),
    };
    const entryItems = model.isRoot(row.path)
      ? [{ label: 'Retirer de la liste', run: () => model.remove(row.path) }]
      : [
          { label: 'Renommer', shortcut: 'F2', run: () => model.startRename(row.path) },
          {
            label: 'Mettre à la corbeille',
            shortcut: 'Suppr',
            run: () => void model.trash(row.path),
          },
        ];
    ctx.contextMenu.show(at, [
      { label: 'Nouveau fichier', run: () => void model.startNew('file', dir) },
      { label: 'Nouveau dossier', run: () => void model.startNew('folder', dir) },
      'separator',
      ...entryItems,
      'separator',
      copy,
    ]);
  }

  /**
   * A click anywhere in the panel but on a control puts the keyboard in the
   * tree (never on a row itself: the tree shows which row is selected).
   */
  function focusTree(event: PointerEvent) {
    const target = event.target as Element;
    if (!target.closest('button, input')) {
      event.preventDefault();
      tree?.focus();
    }
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="explorer" onpointerdown={focusTree} oncontextmenu={(e) => showMenu(e, null)}>
  {#if model.roots.length === 0}
    <div class="empty">
      <p>Aucun dossier ouvert.</p>
      <button class="primary" onclick={() => ctx.commands.execute('explorer.addFolder')}>
        Ajouter un dossier…
      </button>
    </div>
  {:else}
    {#if model.error}<p class="error" role="alert">{model.error}</p>{/if}

    <div
      class="tree"
      role="tree"
      tabindex="0"
      aria-label="Dossiers ouverts"
      aria-activedescendant={model.selected ? idOf(model.selected) : undefined}
      bind:this={tree}
      onkeydown={onKeydown}
      onfocusin={() => ctx.context.set('explorerFocus', true)}
      onfocusout={() => ctx.context.set('explorerFocus', false)}
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
          {@const icon = iconFor(row.name, row.isDir, row.expanded)}
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
            <svg class="icon {icon}" viewBox="0 0 16 16" aria-hidden="true"
              ><path d={ICON_PATHS[icon]} /></svg
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
              <span class="name" class:root={row.depth === 0}>{row.name}</span>
            {/if}
          </div>
          {#if renaming(row) && inputError}<p
              class="field-error"
              style:padding-left={indent(row.depth + 1)}
            >
              {inputError}
            </p>{/if}
        {/if}
      {/each}
    </div>
    <button class="add-folder" onclick={() => ctx.commands.execute('explorer.addFolder')}>
      + Ajouter un dossier
    </button>
  {/if}
</div>

<style>
  /* The whole panel height, so that clicks below the files still reach it. */
  .explorer {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

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

  .error {
    margin: 4px 12px;
    padding: 6px 8px;
    border-radius: 5px;
    background: var(--banner-warning-bg);
    font-size: 12px;
  }

  .tree {
    outline: none;
    font-size: 13px;
  }

  .name.root {
    font-weight: 600;
  }

  .add-folder {
    align-self: flex-start;
    margin: 6px 8px 12px;
    padding: 3px 6px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--ui-fg);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .add-folder:hover {
    background: var(--ui-hover);
    color: var(--fg);
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

  .row:focus {
    outline: none;
  }

  /* Selected: grey; while the keyboard is in the tree, tinted with the accent. */
  .row.selected {
    background: var(--ui-hover);
  }

  .tree:focus .row.selected {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .icon {
    flex: none;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--ui-fg);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.1;
  }

  .icon.folder,
  .icon.folderOpen {
    stroke: var(--syn-type);
  }

  .icon.markdown {
    stroke: var(--syn-heading);
  }

  .icon.code {
    stroke: var(--syn-function);
  }

  .icon.data {
    stroke: var(--syn-number);
  }

  .icon.image {
    stroke: var(--syn-string);
  }

  .icon.pdf {
    stroke: var(--syn-invalid);
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

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
