# Contributing to Cascades

Thanks for helping! Bug reports, ideas, translations, plugins and code are all welcome.

## Reporting a bug or asking for a feature

Open an [issue](https://github.com/anderson3x11/cascades/issues/new/choose) with the matching form. For a bug, say what you did, what you expected and what happened, with your system and the version of Cascades (File > Check for updates… shows it).

## Setting up

You need Node 20+, stable Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) of your system.

```sh
npm install
npm run tauri dev      # the app, reloaded as you edit
npm run dev            # the interface alone in a browser, on an in-memory disk
```

## Before sending a pull request

```sh
npm run lint && npm run format:check && npm run check && npm test
npm run test:e2e
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

The CI runs the same checks on Windows, macOS and Linux.

- **One change per pull request**, with tests for new behavior: unit tests next to the code (`*.test.ts`), end-to-end tests in `tests/e2e`.
- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(explorer): …`, `fix(spellcheck): …`, `docs: …`.
- **Update [CHANGELOG.md](CHANGELOG.md)** under Unreleased for anything a user would notice.

## How the code is organized

Every feature is an extension in `src/extensions`, written only against the API in `src/api` (a lint rule enforces it). If an extension needs something the API does not offer, add it to the API rather than importing app internals. The README has a map of the folders.

## Interface text and translations

Interface text is written in English in the code, through `t()`:

```ts
import { t } from '../../api';
t('Save as…');
t('{count} files', { count });
```

Each language has a catalog in `src/locales` (`fr.json` maps the English text to French). A test fails when a text has no French translation, so add it to `fr.json` with your change.

To add a language: copy `fr.json` to the new language code (`de.json`), translate the values, register it next to `fr` in `src/app/workbench.ts` and `UI_LANGUAGES` in `src/core/i18n/i18n.ts`.

## Plugins

Plugins do not need to live in this repository. [docs/plugins.md](docs/plugins.md) explains how to write one.

## License

By contributing, you agree that your work is released under the [MIT license](LICENSE).
