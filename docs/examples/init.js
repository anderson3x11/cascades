// Example init.js. Copy it into the cascades config folder:
//   Windows: %APPDATA%\dev.cascades.app\init.js
//   macOS:   ~/Library/Application Support/dev.cascades.app/init.js
//   Linux:   ~/.config/dev.cascades.app/init.js
// It receives the same `ctx` as the built-in extensions.

export default function (ctx) {
  ctx.commands.register(
    'user.insertDate',
    () => {
      const view = ctx.editor.view();
      if (!view) return;
      const date = new Date().toISOString().slice(0, 10);
      view.dispatch(view.state.replaceSelection(date));
    },
    { title: 'Insérer la date du jour' },
  );

  ctx.keybindings.register({ key: 'Ctrl+Alt+D', command: 'user.insertDate', when: 'editorFocus' });

  // Show a clock in the status bar.
  const clock = ctx.statusBar.addItem({ id: 'user.clock', alignment: 'right', priority: 100 });
  const tick = () => (clock.text = new Date().toTimeString().slice(0, 5));
  tick();
  const timer = setInterval(tick, 10_000);
  ctx.subscriptions.add({ dispose: () => clearInterval(timer) });
}
