import type { CascadesExtension, ExtensionContext } from '../api';

type UserExport =
  | ((ctx: ExtensionContext) => void | Promise<void>)
  | Pick<CascadesExtension, 'activate' | 'deactivate'>;

/**
 * Turns the source of the user's init.js into an extension. The file is an ES
 * module whose default export is either `function (ctx) {}` or
 * `{ activate(ctx) {}, deactivate() {} }`.
 */
export async function loadUserScript(source: string): Promise<CascadesExtension> {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    const module = (await import(/* @vite-ignore */ url)) as { default?: UserExport };
    const exported = module.default;
    if (typeof exported === 'function') {
      return { id: 'user.init', activate: exported };
    }
    if (exported && typeof exported.activate === 'function') {
      return { id: 'user.init', activate: exported.activate, deactivate: exported.deactivate };
    }
    throw new Error('init.js must export default a function or an object with activate()');
  } finally {
    URL.revokeObjectURL(url);
  }
}
