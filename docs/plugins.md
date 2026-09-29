# Writing a plugin

A plugin adds commands, shortcuts, menus, panels, status bar items or editor behavior to Cascades. It uses the same API as the built-in features: everything Cascades does itself, a plugin can do too.

## A first plugin

A plugin is a folder in the `plugins` folder of the config folder (Preferences > Extensions > Open the plugins folder). It holds two files.

`plugins/hello/manifest.json`:

```json
{
  "id": "hello",
  "name": "Hello",
  "version": "1.0.0",
  "author": "You",
  "description": "Says hello."
}
```

`plugins/hello/main.js`:

```js
export default function (ctx) {
  ctx.commands.register('hello.say', () => ctx.dialogs.alert('Hello'), {
    title: 'Say hello',
    category: 'Plugins',
  });
  ctx.keybindings.register({ key: 'Leader H', command: 'hello.say' });
}
```

Then in Preferences > Extensions, click Reload and turn the plugin on. The command is in the command palette (Ctrl+Shift+P) and on Ctrl+Space H.

## The manifest

| Field         | Required | Meaning                                                                |
| ------------- | -------- | ---------------------------------------------------------------------- |
| `id`          | yes      | Lower case words joined by dashes (`word-count`), unique among plugins |
| `name`        | yes      | Shown in the Extensions page                                           |
| `version`     | yes      | Your version number, `1.0.0` style                                     |
| `author`      | no       | Shown under the name                                                   |
| `description` | no       | One sentence                                                           |
| `permissions` | no       | What the plugin needs beyond the editor, see below. Default: none      |
| `main`        | no       | The module to load, in the plugin folder. Default: `main.js`           |

## The module

`main.js` is an ES module. Its default export is either a function, called with `ctx` when the plugin is turned on, or an object:

```js
export default {
  activate(ctx) {
    // Register everything here.
  },
  deactivate() {
    // Optional: stop timers or anything not registered through ctx.
  },
};
```

Everything registered through `ctx` (commands, shortcuts, menus, settings, status bar items, panels, event listeners…) is removed when the plugin is turned off. A plugin can be turned on and off without restarting.

The module is loaded from its text, so it cannot `import` other files of its folder. Write it as one file, or bundle it into one (esbuild, Rollup).

## The API

`ctx` is described with its types in [src/api/index.ts](../src/api/index.ts). The main parts:

| Part                       | For                                                                   |
| -------------------------- | --------------------------------------------------------------------- |
| `ctx.commands`             | Register and run commands (`file.save`, `editor.duplicateLine`…)      |
| `ctx.keybindings`          | Shortcuts, `Leader X` included                                        |
| `ctx.menus`                | Items in the File, Edit, Text, Go and View menus                      |
| `ctx.settings`             | Your own settings, shown in Preferences, and reading the others       |
| `ctx.workspace`            | Tabs: open, close, read their text, listen to changes                 |
| `ctx.editor`               | The CodeMirror 6 view of the active tab, and editor extensions        |
| `ctx.events`               | `editor.didUpdate`, `workspace.didOpen`, `workspace.didChangeActive`… |
| `ctx.statusBar`            | Items in the status bar                                               |
| `ctx.panels`, `ctx.modals` | Side panels and windows with your own HTML                            |
| `ctx.quickPick`            | A list to choose from, like the command palette                       |
| `ctx.banners`              | A message above the editor                                            |
| `ctx.dialogs`              | Message boxes and file pickers                                        |
| `ctx.viewers`              | Previews and viewers for file types                                   |
| `ctx.themes`               | Color themes                                                          |
| `ctx.i18n`                 | Translations, see below                                               |
| `ctx.fs`                   | Files of the computer (needs the `files` permission)                  |

## Permissions and trust

Plugins run inside Cascades, with the same rights as the app. Only turn on plugins you trust, as you would for any program you install.

The manifest says what a plugin needs beyond the editor. Cascades shows it when the plugin is turned on, and holds the plugin to it:

| Permission | Gives                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| `files`    | `ctx.fs`: reading, writing, listing and watching any file. Without it, these functions fail |

## Translations

Write the texts of your plugin in English, and give translations with `ctx.i18n`:

```js
const { t } = ctx.i18n;
ctx.i18n.addTranslations('fr', { 'Say hello': 'Dire bonjour', 'Hello, {name}': 'Bonjour, {name}' });
ctx.commands.register('hello.say', run, { title: t('Say hello') });
t('Hello, {name}', { name: 'Ana' });
```

`ctx.i18n.language()` gives the language of the interface (`en`, `fr`).

## Examples

- [writing-time](plugins/examples/writing-time): minutes spent writing, in the status bar.
- [note-template](plugins/examples/note-template): a list of ready-made notes to insert (Leader N).

To try one, copy its folder into the plugins folder, click Reload, and turn it on.
