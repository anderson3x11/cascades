<script lang="ts">
  import type { Workbench } from '../app/workbench';
  import { t } from '../core/i18n/i18n';

  let { workbench }: { workbench: Workbench } = $props();
  const hint = $derived(workbench.keyHint);
</script>

{#if hint.typed}
  <div class="hint" role="status" aria-label={t('Available keys')}>
    <span class="typed">{hint.typed} …</span>
    <ul>
      {#each hint.items as item (item.key)}
        <li>
          <kbd>{item.key}</kbd>
          <span class:prefix={item.prefix}>{item.title}</span>
        </li>
      {/each}
    </ul>
    <span class="escape"><kbd>{t('Esc')}</kbd> {t('cancel')}</span>
  </div>
{/if}

<style>
  .hint {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 6px 12px;
    background: var(--ui-bg);
    border-top: 1px solid var(--ui-border);
    color: var(--ui-fg);
    font-size: 12px;
  }

  .typed {
    flex: none;
    color: var(--accent);
    font-weight: 600;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    flex: 1;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  kbd {
    min-width: 18px;
    padding: 0 5px;
    border: 1px solid var(--ui-border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
    font-family: inherit;
    text-align: center;
  }

  .prefix {
    color: var(--accent);
  }

  .escape {
    flex: none;
  }
</style>
