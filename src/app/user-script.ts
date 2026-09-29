import type { CascadesExtension, ExtensionContext } from '../api';
import { t } from '../core/i18n/i18n';

type UserExport =
  | ((ctx: ExtensionContext) => void | Promise<void>)
  | Pick<CascadesExtension, 'activate' | 'deactivate'>;

/**
 * Turns the source of a user module (init.js, a plugin's main.js) into an
 * extension with the given id. The module's default export is either
 * `function (ctx) {}` or `{ activate(ctx) {}, deactivate() {} }`.
 */
export async function loadUserScript(
  source: string,
  id = 'user.init',
  file = 'init.js',
): Promise<CascadesExtension> {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    const module = (await import(/* @vite-ignore */ url)) as { default?: UserExport };
    const exported = module.default;
    if (typeof exported === 'function') {
      return { id, activate: exported };
    }
    if (exported && typeof exported.activate === 'function') {
      return { id, activate: exported.activate, deactivate: exported.deactivate };
    }
    throw new Error(
      t('{file} must export default a function or an object with activate()', { file }),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
