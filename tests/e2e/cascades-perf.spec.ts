import { expect, test, type Page } from '@playwright/test';
import type { DevWindow } from './helpers';

/** 10 000 lines of nested notes, up to 5 levels deep. */
function bigNotes(): string {
  const lines: string[] = [];
  for (let i = 0; lines.length < 10_000; i++) {
    lines.push(`Sujet ${i}`);
    for (let j = 0; j < 4; j++) {
      lines.push(`\tIdée ${j} du sujet ${i}`);
      for (let k = 0; k < 3; k++) lines.push(`\t\tDétail ${k}`, `\t\t\tPrécision`, '');
    }
  }
  return lines.slice(0, 10_000).join('\n');
}

/** Average time in ms to apply one keystroke and lay out the editor. */
async function keystrokeCost(page: Page, cascades: boolean): Promise<number> {
  await page.goto('/');
  return await page.evaluate(
    async ([text, cascades]) => {
      const wb = (window as unknown as DevWindow).__cascades;
      wb.settings.setUserSettings({ 'cascades.enabled': cascades });
      wb.workspace.open({ path: 'C:/perf/notes.txt', text });
      const view = wb.workspace.editorView();
      if (!view) throw new Error('no editor view');
      // Runs CodeMirror's measure phase (layers included) synchronously. Not in the public types.
      const measure = () => (view as unknown as { measure(): void }).measure();
      await new Promise((r) => setTimeout(r, 300));
      // Put the cursor in the middle of the document.
      const line = view.state.doc.line(5000);
      view.dispatch({ selection: { anchor: line.to }, scrollIntoView: true });
      measure();
      const runs = 200;
      const start = performance.now();
      for (let i = 0; i < runs; i++) {
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: i % 20 === 19 ? '\n\t\t' : 'x' },
          selection: { anchor: pos + (i % 20 === 19 ? 3 : 1) },
        });
        measure();
      }
      return (performance.now() - start) / runs;
    },
    [bigNotes(), cascades] as const,
  );
}

test('typing stays fluid in a 10 000 line file with cascades', async ({ page }) => {
  const without = await keystrokeCost(page, false);
  const withCascades = await keystrokeCost(page, true);
  console.log(
    `keystroke: ${without.toFixed(2)} ms without cascades, ${withCascades.toFixed(2)} ms with`,
  );
  // One frame is 16 ms; keep a wide margin for slow CI machines.
  expect(withCascades).toBeLessThan(12);
});
