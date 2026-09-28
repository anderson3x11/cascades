import type { Workbench } from '../../src/app/workbench';

/** The dev build exposes the workbench on `window.__cascades` (see src/main.ts). */
export type DevWindow = Window & { __cascades: Workbench };
