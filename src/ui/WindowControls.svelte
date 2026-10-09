<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { t } from '../core/i18n/i18n';

  /** Minimize, maximize and close, drawn by the app since the window has no system title bar. */
  const win = getCurrentWindow();
  let maximized = $state(false);

  onMount(() => {
    const sync = async () => (maximized = await win.isMaximized());
    void sync();
    const unlisten = win.onResized(() => void sync());
    return () => void unlisten.then((stop) => stop());
  });
</script>

<div class="controls">
  <button aria-label={t('Minimize')} title={t('Minimize')} onclick={() => win.minimize()}>
    <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5h10" /></svg>
  </button>
  <button
    aria-label={maximized ? t('Restore') : t('Maximize')}
    title={maximized ? t('Restore') : t('Maximize')}
    onclick={() => win.toggleMaximize()}
  >
    <svg viewBox="0 0 10 10" aria-hidden="true">
      {#if maximized}
        <path d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z" />
      {:else}
        <path d="M.5 .5h9v9h-9z" />
      {/if}
    </svg>
  </button>
  <button class="close" aria-label={t('Close')} title={t('Close')} onclick={() => win.close()}>
    <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0l10 10M10 0L0 10" /></svg>
  </button>
</div>

<style>
  .controls {
    display: flex;
    align-self: stretch;
    flex: none;
  }

  button {
    display: grid;
    width: 46px;
    padding: 0;
    border: none;
    background: none;
    color: var(--ui-fg);
    place-items: center;
  }

  button:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .close:hover {
    background: #e81123;
    color: #ffffff;
  }

  svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
</style>
