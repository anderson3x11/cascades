<script lang="ts">
  import {
    samePath,
    t,
    type ExtensionContext,
    type FileMatches,
    type SearchOptions,
  } from '../../api';
  import { MAX_MATCHES, type SearchModel } from './model.svelte';

  let { ctx, model }: { ctx: ExtensionContext; model: SearchModel } = $props();

  const toggles: { key: keyof SearchOptions; label: string; text: string }[] = [
    { key: 'caseSensitive', label: t('Match case'), text: 'Aa' },
    { key: 'wholeWord', label: t('Whole word'), text: 'ab' },
    { key: 'regex', label: t('Regular expression'), text: '.*' },
  ];

  const lastSeparator = (path: string) => Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const nameOf = (path: string) => path.slice(lastSeparator(path) + 1);

  /** The folder of a file, from the name of the open folder it is in. */
  function placeOf(path: string): string {
    const dir = path.slice(0, Math.max(lastSeparator(path), 0));
    const root = model.roots.find((r) => samePath(dir).startsWith(samePath(r)));
    return root ? `${nameOf(root)}${dir.slice(root.length)}` : dir;
  }

  function toggle(key: keyof SearchOptions) {
    model.options[key] = !model.options[key];
    void model.search();
  }

  function toggleFile(file: FileMatches) {
    if (model.collapsed.has(file.path)) model.collapsed.delete(file.path);
    else model.collapsed.add(file.path);
  }

  const summary = $derived.by(() => {
    const count = model.matchCount;
    const files = model.results.length;
    if (count === 0) return model.running ? t('Searching…') : t('No results.');
    const text = t('{results} in {files}', {
      results: count === 1 ? t('1 result') : t('{count} results', { count }),
      files: files === 1 ? t('1 file') : t('{count} files', { count: files }),
    });
    return model.running ? `${text}…` : `${text}.`;
  });
</script>

<div class="search">
  <div class="fields">
    <div class="field">
      <input
        class="query"
        type="text"
        placeholder={t('Search')}
        aria-label={t('Search in files')}
        spellcheck="false"
        bind:value={model.query}
        oninput={() => model.schedule()}
        onkeydown={(e) => {
          if (e.key === 'Enter') void model.search();
        }}
      />
      <span class="toggles">
        {#each toggles as { key, label, text } (key)}
          <button
            class="toggle"
            class:on={model.options[key]}
            title={label}
            aria-label={label}
            aria-pressed={model.options[key]}
            onclick={() => toggle(key)}>{text}</button
          >
        {/each}
      </span>
    </div>
    <div class="field">
      <input
        type="text"
        placeholder={t('Replace with')}
        aria-label={t('Replace with')}
        spellcheck="false"
        bind:value={model.replacement}
        oninput={() => model.schedule()}
      />
      <button
        class="replace-all"
        title={t('Replace all')}
        aria-label={t('Replace all')}
        disabled={model.results.length === 0 || model.running}
        onclick={() => model.replace(model.results.map((f) => f.path))}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="M2.5 4.5h7M7 2l2.5 2.5L7 7M13.5 11.5h-7M9 9l-2.5 2.5L9 14" /></svg
        >
      </button>
    </div>
  </div>

  {#if model.noFolder}
    <div class="empty">
      <p>{t('Add a folder in the explorer to search its files.')}</p>
      <button class="primary" onclick={() => ctx.commands.execute('explorer.addFolder')}>
        {t('Add folder…')}
      </button>
    </div>
  {:else if model.query !== ''}
    <p class="status" role="status">
      {#if model.error}<span class="error">{model.error}</span>{:else}{summary}{/if}
      {#if model.running}
        <button class="link" onclick={() => model.stop()}>{t('Stop')}</button>
      {/if}
    </p>
    {#if model.notice}<p class="notice">{model.notice}</p>{/if}
    {#if model.truncated}
      <p class="notice">
        {t('More than {count} results: narrow the search.', { count: MAX_MATCHES })}
      </p>
    {/if}

    <ul class="results" aria-label={t('Results')}>
      {#each model.results as file (file.path)}
        {@const open = !model.collapsed.has(file.path)}
        <li>
          <div class="file" title={file.path}>
            <button class="file-toggle" aria-expanded={open} onclick={() => toggleFile(file)}>
              <span class="chevron" class:open aria-hidden="true">▸</span>
              <span class="name">{nameOf(file.path)}</span>
              <span class="place">{placeOf(file.path)}</span>
            </button>
            <span class="count">{file.matches.length}</span>
            <span class="file-actions">
              <button
                class="icon"
                title={t('Replace in this file')}
                aria-label={t('Replace in {file}', { file: nameOf(file.path) })}
                onclick={() => model.replace([file.path])}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"
                  ><path d="M2.5 4.5h7M7 2l2.5 2.5L7 7M13.5 11.5h-7M9 9l-2.5 2.5L9 14" /></svg
                >
              </button>
              <button
                class="icon"
                title={t('Dismiss this file')}
                aria-label={t('Dismiss {file}', { file: nameOf(file.path) })}
                onclick={() => model.dismiss(file.path)}>×</button
              >
            </span>
          </div>
          {#if open}
            <ul>
              {#each file.matches as match, i (i)}
                <li>
                  <button
                    class="match"
                    title={t('Line {number}', { number: match.line })}
                    onclick={() => model.reveal(file.path, match.line, match.column, match.length)}
                  >
                    <span class="line">{match.line}</span>
                    <span class="preview"
                      >{match.before}{#if match.replacement !== null}<del>{match.matched}</del><ins
                          >{match.replacement}</ins
                        >{:else}<mark>{match.matched}</mark>{/if}{match.after}</span
                    >
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    font-size: 13px;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 8px 6px;
  }

  .field {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--ui-border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  .query {
    padding-right: 72px;
  }

  .field:first-child {
    position: relative;
  }

  .toggles {
    position: absolute;
    right: 3px;
    display: flex;
    gap: 1px;
  }

  .toggle {
    width: 22px;
    height: 20px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 3px;
    background: none;
    color: var(--ui-fg);
    font-family: var(--font-editor);
    font-size: 11px;
    cursor: pointer;
  }

  .toggle:hover {
    background: var(--ui-hover);
  }

  .toggle.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--fg);
  }

  .replace-all,
  .icon {
    display: grid;
    flex: none;
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

  .replace-all:hover:not(:disabled),
  .icon:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .replace-all:disabled {
    opacity: 0.4;
    cursor: default;
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

  button:focus-visible,
  .toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .status,
  .notice {
    margin: 2px 10px 6px;
    color: var(--ui-fg);
    font-size: 12px;
  }

  .notice {
    padding: 6px 8px;
    border-radius: 4px;
    background: var(--ui-hover);
    color: var(--fg);
  }

  .error {
    color: var(--syn-invalid);
  }

  .link {
    margin-left: 6px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 12px;
    color: var(--ui-fg);
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

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .results {
    padding-bottom: 12px;
  }

  .file {
    display: flex;
    align-items: center;
    height: 24px;
    padding-right: 6px;
  }

  .file:hover {
    background: var(--ui-hover);
  }

  .file-toggle {
    display: flex;
    flex: 1;
    gap: 6px;
    align-items: baseline;
    min-width: 0;
    height: 100%;
    padding: 0 0 0 8px;
    border: none;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .chevron {
    flex: none;
    width: 12px;
    color: var(--ui-fg);
    font-size: 12px;
    transition: transform 120ms;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .name {
    flex: none;
    font-weight: 600;
  }

  .place {
    overflow: hidden;
    color: var(--ui-fg);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    flex: none;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 8px;
    background: var(--ui-hover);
    color: var(--ui-fg);
    font-size: 11px;
    text-align: center;
  }

  .file-actions {
    display: none;
  }

  .file:hover .file-actions,
  .file:focus-within .file-actions {
    display: flex;
  }

  .file:hover .count,
  .file:focus-within .count {
    display: none;
  }

  .match {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 2px 8px 2px 30px;
    border: none;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .match:hover {
    background: var(--ui-hover);
  }

  .line {
    flex: none;
    min-width: 2ch;
    color: var(--ui-fg);
    font-size: 11px;
    text-align: right;
  }

  .preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
  }

  mark {
    border-radius: 2px;
    background: var(--match);
    color: inherit;
  }

  del {
    background: color-mix(in srgb, var(--syn-invalid) 25%, transparent);
    text-decoration: line-through;
  }

  ins {
    background: color-mix(in srgb, var(--syn-string) 25%, transparent);
    text-decoration: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
