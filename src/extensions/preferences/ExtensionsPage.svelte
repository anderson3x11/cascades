<script lang="ts">
  import { t, type ExtensionContext, type PluginInfo } from '../../api';

  let { ctx }: { ctx: ExtensionContext } = $props();

  let plugins = $state<PluginInfo[]>([]);
  let error = $state<string | null>(null);
  $effect(() => {
    plugins = ctx.plugins.list();
    const changes = ctx.plugins.onDidChange(() => (plugins = ctx.plugins.list()));
    return () => changes.dispose();
  });

  const permissionText = (permission: string) =>
    permission === 'files' ? t('Access to the files of your computer') : permission;

  async function toggle(plugin: PluginInfo, on: boolean, input: HTMLInputElement) {
    error = null;
    if (on && plugin.permissions.length > 0) {
      const yes = t('Turn on');
      const answer = await ctx.dialogs.choose(
        t('"{name}" asks for: {permissions}. Turn it on?', {
          name: plugin.name,
          permissions: plugin.permissions.map(permissionText).join(', '),
        }),
        { buttons: [yes, t('Cancel')] },
      );
      if (answer !== yes) {
        input.checked = false;
        return;
      }
    }
    try {
      await ctx.plugins.setEnabled(plugin.id, on);
    } catch (err) {
      input.checked = !on;
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<div class="page">
  <p class="warning">
    {t(
      'Plugins run inside Cascades with the same rights as the app. Only turn on plugins you trust.',
    )}
  </p>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <ul class="list" aria-label={t('Plugins')}>
    {#each plugins as plugin (plugin.folder)}
      <li class="row">
        <div class="text">
          <span class="name">
            {plugin.name}
            {#if plugin.version}<span class="version">{plugin.version}</span>{/if}
          </span>
          {#if plugin.description}<span class="description">{plugin.description}</span>{/if}
          <span class="meta">
            {#if plugin.author}{t('by {author}', { author: plugin.author })} ·
            {/if}<code>plugins/{plugin.folder}</code>
          </span>
          {#each plugin.permissions as permission (permission)}
            <span class="permission">{permissionText(permission)}</span>
          {/each}
          {#if plugin.error}<span class="problem" role="alert">{plugin.error}</span>{/if}
        </div>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          aria-label={t('Turn on {name}', { name: plugin.name })}
          checked={plugin.enabled}
          disabled={plugin.error !== null && !plugin.enabled}
          onchange={(e) => toggle(plugin, e.currentTarget.checked, e.currentTarget)}
        />
      </li>
    {:else}
      <li class="empty">
        {t('No plugin yet. A plugin is a folder with a manifest.json, put in the plugins folder.')}
      </li>
    {/each}
  </ul>

  <footer>
    <button class="link" onclick={() => void ctx.plugins.openFolder()}>
      {t('Open the plugins folder')}
    </button>
    <button class="link" onclick={() => void ctx.plugins.reload()}>{t('Reload')}</button>
  </footer>
</div>

<style>
  .page {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .warning,
  .error {
    margin: 14px 20px 4px;
    padding: 8px 10px;
    border-radius: 5px;
    background: var(--banner-warning-bg);
    font-size: 13px;
  }

  .list {
    flex: 1;
    overflow-y: auto;
    margin: 0;
    padding: 8px 20px 16px;
    list-style: none;
  }

  .row {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    border-radius: 5px;
  }

  .row:hover {
    background: var(--ui-hover);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    font-size: 13px;
  }

  .name {
    font-weight: 600;
  }

  .version,
  .meta {
    color: var(--ui-fg);
    font-size: 12px;
    font-weight: normal;
  }

  code {
    font-family: var(--font-editor);
    font-size: 11px;
  }

  .permission {
    align-self: flex-start;
    padding: 1px 6px;
    border: 1px solid var(--ui-border);
    border-radius: 4px;
    color: var(--ui-fg);
    font-size: 11px;
  }

  .problem {
    color: var(--change-deleted);
    font-size: 12px;
  }

  .empty {
    color: var(--ui-fg);
    font-size: 13px;
  }

  .switch {
    appearance: none;
    position: relative;
    flex: none;
    width: 32px;
    height: 18px;
    margin: 0;
    border-radius: 9px;
    background: var(--ui-border);
    cursor: pointer;
    transition: background 120ms;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--bg);
    transition: transform 120ms;
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    transform: translateX(14px);
  }

  .switch:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .switch:focus-visible,
  .link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
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

  footer {
    display: flex;
    gap: 16px;
    padding: 10px 20px;
    border-top: 1px solid var(--ui-border);
  }

  @media (prefers-reduced-motion: reduce) {
    .switch,
    .switch::after {
      transition: none;
    }
  }
</style>
