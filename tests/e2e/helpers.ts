import type { Workbench } from '../../src/app/workbench';
import type { fakeFs } from '../../src/platform/fake-fs';

/**
 * The dev build exposes the workbench on `window.__cascades`, and the
 * in-memory disk used outside the desktop app on `window.__cascadesFs`
 * (see src/main.ts).
 */
export type DevWindow = Window & { __cascades: Workbench; __cascadesFs: typeof fakeFs };
