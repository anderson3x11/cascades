<script lang="ts">
  import { onMount } from 'svelte';
  import type { Workbench } from '../app/workbench';

  let { workbench }: { workbench: Workbench } = $props();
  let host: HTMLElement;

  onMount(() => {
    const attached = workbench.attachEditor(host);
    return () => attached.dispose();
  });
</script>

<main bind:this={host}></main>

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
</style>
