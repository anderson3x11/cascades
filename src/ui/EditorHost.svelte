<script lang="ts">
  import { onMount } from 'svelte';
  import type { Workbench } from '../app/workbench';

  let { workbench, zen = false }: { workbench: Workbench; zen?: boolean } = $props();
  let host: HTMLElement;

  onMount(() => {
    const attached = workbench.attachEditor(host);
    return () => attached.dispose();
  });
</script>

<main bind:this={host} class:zen></main>

<style>
  main {
    flex: 1;
    min-height: 0;
  }
  main :global(.cm-editor) {
    height: 100%;
  }
  main :global(.cm-editor.cm-focused) {
    outline: none;
  }

  /* Zen: text in a centered column, no gutters. */
  main.zen :global(.cm-gutters) {
    display: none;
  }
  /* No scrollbar in zen; the wheel and keyboard still scroll. */
  main.zen :global(.cm-scroller) {
    scrollbar-width: none;
  }
  main.zen :global(.cm-scroller::-webkit-scrollbar) {
    display: none;
  }
  main.zen :global(.cm-content) {
    box-sizing: border-box;
    max-width: var(--zen-width, 80ch);
    margin: 0 auto;
    padding-top: 10vh;
    padding-bottom: 30vh;
  }
</style>
