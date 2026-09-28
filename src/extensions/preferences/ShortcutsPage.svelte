<script lang="ts">
  import type { ExtensionContext, KeybindingInfo } from '../../api';
  import {
    isCustomized,
    removeShortcut,
    resetCommand,
    setShortcut,
    groupByCommand,
    type Shortcut,
  } from './keybindings-edit';
  import { fold } from './sections';

  let { ctx, openFile }: { ctx: ExtensionContext; openFile: () => void } = $props();

  const FILE = 'keybindings.json';

  let query = $state('');
  let notice = $state<string | null>(null);
  /** The command whose new shortcut is being typed, and the one it replaces. */
  let recording = $state<{ command: string; previous?: Shortcut } | null>(null);
  let shortcuts = $state<KeybindingInfo[]>([]);
  let fileText = $state<string | null>(null);

  $effect(() => {
    const refresh = () => (shortcuts = ctx.keybindings.list());
    const readFile = () => void ctx.configFiles.read(FILE).then((text) => (fileText = text));
    refresh();
    readFile();
    const subscriptions = [
      ctx.keybindings.onDidChange(refresh),
      ctx.configFiles.watch(FILE, readFile),
    ];
    return () => subscriptions.forEach((s) => s.dispose());
  });

  interface Row {
    id: string;
    title: string;
    shortcuts: KeybindingInfo[];
  }

  const rows = $derived.by((): Row[] => {
    const byCommand = groupByCommand(shortcuts);
    const words = fold(query).split(/\s+/).filter(Boolean);
    return (
      ctx.commands
        .list()
        // Hidden commands only when they have a shortcut.
        .filter((c) => (c.title && !c.hidden) || byCommand.has(c.id))
        .map((c) => ({
          id: c.id,
          title: c.category ? `${c.category} : ${c.title ?? c.id}` : (c.title ?? c.id),
          shortcuts: byCommand.get(c.id) ?? [],
        }))
        .filter((row) => {
          const haystack = fold(
            `${row.title} ${row.id} ${row.shortcuts.map((s) => s.label).join(' ')}`,
          );
          return words.every((word) => haystack.includes(word));
        })
        .sort((a, b) => a.title.localeCompare(b.title))
    );
  });

  function titleOf(command: string): string {
    const info = ctx.commands.list().find((c) => c.id === command);
    if (!info?.title) return command;
    return info.category ? `${info.category} : ${info.title}` : info.title;
  }

  /** Keys that type text on their own would stop typing: they need a modifier. */
  const typesText = (key: string) =>
    !/^(Leader |.*\b(Ctrl|Alt|Meta)\+)/.test(key) && !/^(Shift\+)?F\d{1,2}$/.test(key);

  async function change(edit: (text: string | null) => string) {
    try {
      const next = edit(await ctx.configFiles.read(FILE));
      await ctx.configFiles.write(FILE, next);
      fileText = next;
    } catch (err) {
      notice = err instanceof Error ? err.message : String(err);
    }
  }

  async function record(command: string, previous?: Shortcut) {
    notice = null;
    recording = { command, previous };
    const key = await ctx.keybindings.capture();
    recording = null;
    if (!key) return;
    if (typesText(key)) {
      notice = `« ${ctx.keybindings.format(key)} » seul taperait du texte : ajoute Ctrl ou Alt.`;
      return;
    }
    const label = ctx.keybindings.format(key);
    const others = shortcuts.filter((s) => s.label === label && s.command !== command);
    await change((text) => setShortcut(text, command, key, previous));
    if (others.length > 0) {
      const names = [...new Set(others.map((s) => `« ${titleOf(s.command)} »`))].join(', ');
      notice = `${label} servait aussi à ${names} : c'est le nouveau raccourci qui l'emporte.`;
    }
  }
</script>

<div class="page">
  <div class="toolbar">
    <input
      class="search"
      type="search"
      placeholder="Rechercher une commande ou un raccourci"
      aria-label="Rechercher une commande ou un raccourci"
      bind:value={query}
      spellcheck="false"
    />
  </div>

  {#if notice}<p class="notice" role="status">{notice}</p>{/if}

  <ul class="list" aria-label="Raccourcis">
    {#each rows as row (row.id)}
      {@const customized = isCustomized(fileText, row.id)}
      <li class="row" class:modified={customized}>
        <div class="text">
          <span class="title">{row.title}</span>
          <code>{row.id}</code>
        </div>
        <div class="keys">
          {#if recording?.command === row.id}
            <span class="recording" aria-live="polite"
              >Appuie sur les touches… Échap pour annuler</span
            >
          {:else}
            {#each row.shortcuts as shortcut, i (i)}
              <span class="chip">
                <button
                  class="key"
                  title={shortcut.when ? `Quand : ${shortcut.when}` : 'Changer ce raccourci'}
                  aria-label="Changer {shortcut.label} : {row.title}"
                  onclick={() => record(row.id, shortcut)}>{shortcut.label}</button
                ><button
                  class="remove"
                  title="Retirer ce raccourci"
                  aria-label="Retirer {shortcut.label} : {row.title}"
                  onclick={() => change((text) => removeShortcut(text, shortcut))}>×</button
                >
              </span>
            {/each}
            <button
              class="add"
              title="Ajouter un raccourci"
              aria-label="Ajouter un raccourci : {row.title}"
              onclick={() => record(row.id)}>+</button
            >
          {/if}
          <button
            class="reset"
            class:hidden={!customized}
            title="Revenir aux raccourcis par défaut"
            aria-label="Revenir aux raccourcis par défaut : {row.title}"
            onclick={() => change((text) => resetCommand(text, row.id))}>↺</button
          >
        </div>
      </li>
    {:else}
      <li class="empty">Aucune commande ne correspond.</li>
    {/each}
  </ul>

  <footer>
    <button class="link" onclick={openFile}>Ouvrir keybindings.json</button>
    <span>Clique sur un raccourci pour le changer. La touche leader se règle dans Réglages.</span>
  </footer>
</div>

<style>
  .page {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .toolbar {
    display: flex;
    padding: 14px 20px 10px;
  }

  .search {
    flex: 1;
    padding: 5px 8px;
    border: 1px solid var(--ui-border);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
    font-size: 13px;
  }

  button:focus-visible,
  .search:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .notice {
    margin: 0 20px 8px;
    padding: 8px 10px;
    border-radius: 5px;
    background: var(--banner-warning-bg);
    font-size: 13px;
  }

  .list {
    flex: 1;
    margin: 0;
    padding: 0 20px 16px;
    overflow-y: auto;
    list-style: none;
  }

  .row {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    border-left: 2px solid transparent;
    border-radius: 0 5px 5px 0;
  }

  .row:hover {
    background: var(--ui-hover);
  }

  .row.modified {
    border-left-color: var(--accent);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title {
    font-size: 13px;
  }

  code {
    color: var(--ui-fg);
    font-family: var(--font-editor);
    font-size: 11px;
  }

  .keys {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: flex-end;
  }

  .chip {
    display: inline-flex;
    border: 1px solid var(--ui-border);
    border-radius: 5px;
    background: var(--bg);
  }

  .key,
  .remove,
  .add,
  .reset {
    border: none;
    background: none;
    color: var(--fg);
    font: inherit;
    cursor: pointer;
  }

  .key {
    padding: 2px 8px;
    font-family: var(--font-editor);
    font-size: 12px;
    border-radius: 4px 0 0 4px;
  }

  .remove {
    padding: 0 6px;
    color: var(--ui-fg);
    border-radius: 0 4px 4px 0;
  }

  .key:hover,
  .remove:hover,
  .add:hover,
  .reset:hover {
    background: var(--ui-border);
  }

  .add,
  .reset {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    color: var(--ui-fg);
    font-size: 14px;
  }

  .reset.hidden {
    visibility: hidden;
  }

  .recording {
    padding: 3px 10px;
    border: 1px dashed var(--accent);
    border-radius: 5px;
    color: var(--accent);
    font-size: 12px;
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .link:hover {
    text-decoration: underline;
  }

  .empty {
    color: var(--ui-fg);
    font-size: 13px;
  }

  footer {
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 10px 20px;
    border-top: 1px solid var(--ui-border);
    color: var(--ui-fg);
    font-size: 12px;
  }
</style>
