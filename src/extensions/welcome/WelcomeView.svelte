<script lang="ts">
  import { t, type ExtensionContext } from '../../api';

  let {
    ctx,
    startNote,
  }: {
    ctx: ExtensionContext;
    /** Opens a new note, with `text` already typed. */
    startNote: (text: string) => void;
  } = $props();

  /** Recent files shown on the page. */
  const RECENT_SHOWN = 8;

  let root: HTMLElement;
  let recent = $state<string[]>([]);

  $effect(() => {
    root.focus();
    // The recent files come from quick open, if it is there.
    void ctx.commands
      .execute('quickOpen.recentFiles')
      .then((files) => {
        if (Array.isArray(files)) recent = files.slice(0, RECENT_SHOWN);
      })
      .catch(() => {});
  });

  const cut = (path: string) => Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const nameOf = (path: string) => path.slice(cut(path) + 1);
  const dirOf = (path: string) => path.slice(0, Math.max(cut(path), 0));

  const actions = [
    { label: t('New file'), command: 'file.new' },
    { label: t('Open file…'), command: 'file.open' },
    { label: t('Add folder…'), command: 'explorer.addFolder' },
    { label: t('Quick open…'), command: 'workbench.quickOpen' },
  ];
  const tips = [
    { label: t('All commands'), command: 'workbench.commandPalette' },
    { label: t('Preferences'), command: 'preferences.open' },
    { label: t('Zen mode'), command: 'view.toggleZen' },
    { label: t('Spell checker'), command: 'editor.toggleSpellcheck' },
  ];
  const shortcut = (command: string) => ctx.keybindings.label(command) ?? '';

  /** Typing a letter starts a note with it: no click needed to begin writing. */
  function onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key.length !== 1 && event.key !== 'Enter') return;
    if (event.target !== root) return;
    event.preventDefault();
    startNote(event.key === 'Enter' ? '' : event.key);
  }
</script>

<!-- Typing anywhere on the page starts a note. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="welcome"
  role="region"
  aria-label={t('Welcome')}
  tabindex="-1"
  bind:this={root}
  onkeydown={onKeydown}
>
  <div class="inner">
    <header>
      <h1>Cascades</h1>
      <p>{t('Type to start a note.')}</p>
    </header>

    <section>
      <h2>{t('Start')}</h2>
      <ul>
        {#each actions as { label, command } (command)}
          <li>
            <button onclick={() => ctx.commands.execute(command)}>
              <span>{label}</span><kbd>{shortcut(command)}</kbd>
            </button>
          </li>
        {/each}
      </ul>
    </section>

    {#if recent.length > 0}
      <section>
        <h2>{t('Recent')}</h2>
        <ul>
          {#each recent as path (path)}
            <li>
              <button title={path} onclick={() => ctx.commands.execute('file.openPath', path)}>
                <span class="name">{nameOf(path)}</span><span class="dir">{dirOf(path)}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h2>{t('Good to know')}</h2>
      <ul>
        {#each tips as { label, command } (command)}
          <li>
            <button onclick={() => ctx.commands.execute(command)}>
              <span>{label}</span><kbd>{shortcut(command)}</kbd>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</div>

<style>
  .welcome {
    height: 100%;
    overflow-y: auto;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-ui);
    outline: none;
  }

  .inner {
    max-width: 520px;
    margin: 0 auto;
    padding: 56px 24px 32px;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  header p {
    margin: 6px 0 0;
    color: var(--ui-fg);
    font-size: 14px;
  }

  section {
    margin-top: 32px;
  }

  h2 {
    margin: 0 0 6px;
    color: var(--ui-fg);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  button {
    display: flex;
    gap: 12px;
    align-items: baseline;
    justify-content: space-between;
    width: 100%;
    padding: 6px 10px;
    margin-left: -10px;
    border: none;
    border-radius: 5px;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-hover);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  kbd {
    flex: none;
    color: var(--ui-fg);
    font-family: inherit;
    font-size: 12px;
  }

  .name {
    flex: none;
  }

  .dir {
    overflow: hidden;
    color: var(--ui-fg);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: right;
  }
</style>
