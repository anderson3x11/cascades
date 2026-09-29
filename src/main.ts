import { mount } from 'svelte';
import { Workbench } from './app/workbench';
import { builtinExtensions } from './extensions';
import { fakeFs } from './platform/fake-fs';
import App from './ui/App.svelte';
import './ui/global.css';

// Base palette right away, before the themes extension picks the exact theme.
document.documentElement.dataset.themeType = window.matchMedia('(prefers-color-scheme: dark)')
  .matches
  ? 'dark'
  : 'light';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

const workbench = new Workbench();
await workbench.prepare();
mount(App, { target, props: { workbench } });
void workbench.start(builtinExtensions);

// Handle for e2e tests and debugging in the dev build only.
if (import.meta.env.DEV) Object.assign(window, { __cascades: workbench, __cascadesFs: fakeFs });
