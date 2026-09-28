import { mount } from 'svelte';
import { Workbench } from './app/workbench';
import { builtinExtensions } from './extensions';
import App from './ui/App.svelte';
import './ui/global.css';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

const workbench = new Workbench();
mount(App, { target, props: { workbench } });
void workbench.start(builtinExtensions);
