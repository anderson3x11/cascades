<script lang="ts">
  import type { ModalSpec } from '../api';
  import type { Workbench } from '../app/workbench';
  import { t } from '../core/i18n/i18n';

  let { workbench, modal }: { workbench: Workbench; modal: ModalSpec } = $props();

  let host: HTMLElement;
  let box: HTMLElement;

  $effect(() => {
    const content = modal.render(host);
    // Focus the first field, else the first control, else the window itself
    // so that Escape works.
    const first =
      host.querySelector<HTMLElement>('input, select, textarea') ??
      host.querySelector<HTMLElement>('button, [tabindex]');
    (first ?? box).focus();
    return () => content.dispose();
  });

  function close() {
    workbench.modals.close();
    workbench.workspace.editorView()?.focus();
  }

  // On the window: the focus may have left the modal (a clicked button that
  // went away), Escape must still close it.
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="backdrop" role="presentation" onpointerdown={close}></div>
<div
  class="modal"
  role="dialog"
  aria-modal="true"
  aria-label={modal.title}
  tabindex="-1"
  bind:this={box}
>
  <header>
    <h2>{modal.title}</h2>
    <button aria-label={t('Close')} title={t('Close (Esc)')} onclick={close}>×</button>
  </header>
  <div class="body" bind:this={host}></div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgb(0 0 0 / 0.35);
    animation: fade 120ms ease-out;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 301;
    display: flex;
    flex-direction: column;
    width: min(820px, calc(100vw - 32px));
    height: min(600px, calc(100vh - 48px));
    transform: translate(-50%, -50%);
    background: var(--ui-bg);
    color: var(--fg);
    border: 1px solid var(--ui-border);
    border-radius: 10px;
    box-shadow: var(--menu-shadow);
    outline: none;
    animation: rise 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  header {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px 10px 18px;
    border-bottom: 1px solid var(--ui-border);
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  header button {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 5px;
    background: none;
    color: var(--ui-fg);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  header button:hover {
    background: var(--ui-hover);
    color: var(--fg);
  }

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 8px));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop,
    .modal {
      animation: none;
    }
  }
</style>
