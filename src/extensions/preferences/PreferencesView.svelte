<script lang="ts" module>
  export type PreferencesPage = 'settings' | 'shortcuts';
</script>

<script lang="ts">
  import type { ExtensionContext } from '../../api';
  import SettingsPage from './SettingsPage.svelte';
  import ShortcutsPage from './ShortcutsPage.svelte';
  import { t } from '../../api';

  let {
    ctx,
    page = 'settings',
    runAndClose,
  }: {
    ctx: ExtensionContext;
    page?: PreferencesPage;
    /** Closes the window and runs a command (to open a file in a tab). */
    runAndClose: (command: string) => void;
  } = $props();

  const pages: { id: PreferencesPage; label: string }[] = [
    { id: 'settings', label: t('Settings') },
    { id: 'shortcuts', label: t('Shortcuts') },
  ];
</script>

<nav aria-label={t('Preferences pages')}>
  {#each pages as { id, label } (id)}
    <button class:active={page === id} aria-current={page === id} onclick={() => (page = id)}>
      {label}
    </button>
  {/each}
</nav>
{#if page === 'settings'}
  <SettingsPage {ctx} openFile={() => runAndClose('preferences.openSettingsFile')} />
{:else}
  <ShortcutsPage {ctx} openFile={() => runAndClose('preferences.openKeybindingsFile')} />
{/if}

<style>
  nav {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 2px;
    width: 150px;
    padding: 12px 8px;
    border-right: 1px solid var(--ui-border);
  }

  button {
    padding: 6px 10px;
    border: none;
    border-radius: 5px;
    background: none;
    color: var(--ui-fg);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  button.active {
    background: var(--ui-hover);
    color: var(--fg);
    font-weight: 600;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
</style>
