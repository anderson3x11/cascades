<script lang="ts">
  import type { ExtensionContext } from '../../api';
  import { sections, type Setting } from './sections';

  let { ctx, openFile }: { ctx: ExtensionContext; openFile: () => void } = $props();

  let query = $state('');
  /** Empty for every file, else the language whose "[language]" block is edited. */
  let scope = $state('');
  let error = $state<string | null>(null);
  // Bumped on every settings change, to re-read the values.
  let version = $state(0);
  $effect(() => {
    const subscription = ctx.settings.onDidChange(() => version++);
    return () => subscription.dispose();
  });

  const shown = $derived(sections(ctx.settings.schemas(), query));
  const languages = $derived.by(() => {
    void version;
    const found = [
      ...ctx.settings.overriddenLanguages(),
      ...ctx.workspace.tabs().map((tab) => tab.language),
    ];
    return [...new Set(found)].sort();
  });

  function current(setting: Setting): { value: unknown; modified: boolean } {
    void version;
    const language = scope || undefined;
    const info = ctx.settings.inspect(setting.key, language);
    const own = language ? info.languageValue : info.globalValue;
    return { value: ctx.settings.get(setting.key, language), modified: own !== undefined };
  }

  async function set(setting: Setting, value: unknown) {
    error = null;
    try {
      await ctx.settings.update(setting.key, value, scope || undefined);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  function setNumber(setting: Setting, input: HTMLInputElement, previous: unknown) {
    const value = Number(input.value);
    if (input.value.trim() !== '' && Number.isFinite(value)) void set(setting, value);
    else input.value = String(previous);
  }

  const id = (setting: Setting) => `setting-${setting.key}`;
</script>

<div class="page">
  <div class="toolbar">
    <input
      class="search"
      type="search"
      placeholder="Rechercher un réglage"
      aria-label="Rechercher un réglage"
      bind:value={query}
      spellcheck="false"
    />
    <label class="scope">
      Pour
      <select bind:value={scope}>
        <option value="">tous les fichiers</option>
        {#each languages as language (language)}
          <option value={language}>les fichiers {language}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="list">
    {#each shown as section (section.title)}
      <section>
        <h3>{section.title}</h3>
        {#each section.settings as setting (setting.key)}
          {@const { value, modified } = current(setting)}
          <div class="row" class:modified>
            <div class="text">
              <span class="description" id={id(setting)}>
                {setting.description ?? setting.key}
              </span>
              <code>{setting.key}</code>
            </div>
            <div class="control">
              {#if setting.type === 'boolean'}
                <input
                  type="checkbox"
                  role="switch"
                  class="switch"
                  aria-labelledby={id(setting)}
                  checked={value === true}
                  onchange={(e) => set(setting, e.currentTarget.checked)}
                />
              {:else if setting.enum}
                <select
                  aria-labelledby={id(setting)}
                  value={JSON.stringify(value)}
                  onchange={(e) => set(setting, JSON.parse(e.currentTarget.value))}
                >
                  {#each setting.enum as option (JSON.stringify(option))}
                    <option value={JSON.stringify(option)}>{String(option)}</option>
                  {/each}
                </select>
              {:else if setting.type === 'number'}
                <input
                  type="number"
                  class="number"
                  aria-labelledby={id(setting)}
                  value={String(value)}
                  onchange={(e) => setNumber(setting, e.currentTarget, value)}
                />
              {:else if setting.type === 'string'}
                <input
                  type="text"
                  aria-labelledby={id(setting)}
                  value={String(value)}
                  spellcheck="false"
                  onchange={(e) => set(setting, e.currentTarget.value)}
                />
              {:else}
                <button class="link" onclick={openFile}>Modifier dans settings.json</button>
              {/if}
              <button
                class="reset"
                class:hidden={!modified}
                title="Revenir à la valeur par défaut"
                aria-label="Revenir à la valeur par défaut : {setting.key}"
                onclick={() => set(setting, undefined)}>↺</button
              >
            </div>
          </div>
        {/each}
      </section>
    {:else}
      <p class="empty">Aucun réglage ne correspond.</p>
    {/each}
  </div>

  <footer>
    <button class="link" onclick={openFile}>Ouvrir settings.json</button>
    <span>Tout ce qui est changé ici y est écrit, commentaires conservés.</span>
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
    gap: 12px;
    align-items: center;
    padding: 14px 20px 10px;
  }

  input,
  select {
    padding: 5px 8px;
    border: 1px solid var(--ui-border);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
    font-size: 13px;
  }

  input:focus-visible,
  select:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .search {
    flex: 1;
  }

  .scope {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--ui-fg);
    font-size: 13px;
  }

  .error {
    margin: 0 20px 8px;
    padding: 8px 10px;
    border-radius: 5px;
    background: var(--banner-warning-bg);
    font-size: 13px;
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 16px;
  }

  h3 {
    margin: 18px 0 4px;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .row {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
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

  .description {
    font-size: 13px;
  }

  code {
    color: var(--ui-fg);
    font-family: var(--font-editor);
    font-size: 11px;
  }

  .control {
    display: flex;
    flex: none;
    gap: 6px;
    align-items: center;
  }

  .control input[type='text'],
  .control select {
    width: 180px;
  }

  .number {
    width: 80px;
  }

  .switch {
    appearance: none;
    position: relative;
    width: 32px;
    height: 18px;
    padding: 0;
    border-radius: 9px;
    background: var(--ui-border);
    cursor: pointer;
    transition: background 120ms;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--bg);
    transition: transform 120ms;
  }

  .switch:checked {
    border-color: var(--accent);
    background: var(--accent);
  }

  .switch:checked::after {
    transform: translateX(14px);
  }

  .reset {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--ui-fg);
    font-size: 14px;
    cursor: pointer;
  }

  .reset:hover {
    background: var(--ui-border);
    color: var(--fg);
  }

  .reset.hidden {
    visibility: hidden;
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

  @media (prefers-reduced-motion: reduce) {
    .switch,
    .switch::after {
      transition: none;
    }
  }
</style>
