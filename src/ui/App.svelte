<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';

  let host: HTMLElement;

  onMount(() => {
    const view = new EditorView({ doc: '', extensions: [basicSetup], parent: host });
    view.focus();
    return () => view.destroy();
  });
</script>

<main bind:this={host}></main>

<style>
  main {
    height: 100vh;
  }
  main :global(.cm-editor) {
    height: 100%;
  }
</style>
