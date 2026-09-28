# cascades

Un éditeur de texte léger pensé pour la prise de notes, qui reste capable d'ouvrir n'importe quel fichier texte ou code. La simplicité de Notepad++, la personnalisation de Vim.

> Projet en cours de développement (jalon 0.1a). Voir [BRIEF.md](BRIEF.md) pour la vision complète.

## Fonctionnalités actuelles

- Onglets multiples, réorganisables, avec indicateur de modification.
- Ouvrir, enregistrer, enregistrer sous, rouvrir le dernier onglet fermé.
- Détection d'encodage (UTF-8, UTF-8 BOM, UTF-16, Latin-1...) et de fins de ligne (LF, CRLF), conservés à l'enregistrement.
- Coloration syntaxique selon l'extension du fichier.
- Entrée conserve l'indentation exacte de la ligne (les tabulations restent des tabulations).
- Barre d'état : position, mots, caractères, langage, encodage, fin de ligne.
- Tout est une commande, tous les raccourcis sont des bindings remplaçables.
- Configuration par `settings.json` et script `init.js`.

## Raccourcis par défaut

| Action                                     | Raccourci                 |
| ------------------------------------------ | ------------------------- |
| Nouveau / Ouvrir / Enregistrer             | Ctrl+N / Ctrl+O / Ctrl+S  |
| Enregistrer sous                           | Ctrl+Shift+S              |
| Fermer l'onglet / Rouvrir le dernier fermé | Ctrl+W / Ctrl+Shift+T     |
| Onglet suivant / précédent                 | Ctrl+Tab / Ctrl+Shift+Tab |
| Rechercher / Remplacer                     | Ctrl+F / Ctrl+H           |
| Dupliquer la ligne                         | Shift+Alt+Bas             |
| Déplacer la ligne                          | Alt+Haut / Alt+Bas        |
| Supprimer la ligne                         | Ctrl+Shift+K              |
| Commenter                                  | Ctrl+/                    |
| Ajouter l'occurrence suivante              | Ctrl+D                    |

## Configuration

Le dossier de config est :

- Windows : `%APPDATA%\dev.cascades.app\`
- macOS : `~/Library/Application Support/dev.cascades.app/`
- Linux : `~/.config/dev.cascades.app/`

**Mode portable** : placez un fichier vide nommé `portable` à côté de l'exécutable. La config est alors lue dans un dossier `config` au même endroit.

### settings.json

```json
{
  "editor.tabSize": 4,
  "editor.fontSize": 15,
  "[markdown]": { "editor.wordWrap": true }
}
```

| Clé                          | Défaut  | Description                                   |
| ---------------------------- | ------- | --------------------------------------------- |
| `editor.tabSize`             | `4`     | Largeur d'une tabulation                      |
| `editor.insertSpaces`        | `false` | Indenter avec des espaces                     |
| `editor.wordWrap`            | `false` | Retour à la ligne automatique                 |
| `editor.lineNumbers`         | `true`  | Numéros de ligne                              |
| `editor.folding`             | `true`  | Marge de repli                                |
| `editor.highlightActiveLine` | `true`  | Surligner la ligne du curseur                 |
| `editor.fontSize`            | `14`    | Taille de police de l'éditeur (px)            |
| `files.defaultExtension`     | `"txt"` | Extension proposée pour un nouveau fichier    |
| `indentKeep.enabled`         | `true`  | Entrée garde l'indentation exacte de la ligne |

Un bloc `"[langage]"` surcharge les réglages pour un langage (`markdown`, `javascript`, `plaintext`...).

### init.js

`init.js` est un module JavaScript chargé au démarrage comme une extension. Il reçoit le même objet `ctx` que les fonctionnalités internes : commandes, raccourcis, settings, onglets, éditeur (CodeMirror 6), barre d'état. Exemple complet : [docs/examples/init.js](docs/examples/init.js).

```js
export default function (ctx) {
  ctx.commands.register('user.hello', () => ctx.dialogs.alert('Bonjour'));
  ctx.keybindings.register({ key: 'Ctrl+K H', command: 'user.hello' });
}
```

## Architecture

```
src/
├── core/        Noyau sans dépendance UI : commandes, raccourcis, settings, événements, hôte d'extensions
├── api/         API publique des extensions (future API de plugins)
├── app/         Assemblage : workbench, onglets, intégration CodeMirror
├── extensions/  Fonctionnalités internes, écrites uniquement contre src/api
├── platform/    Appels au backend Tauri
└── ui/          Composants Svelte
src-tauri/       Backend Rust : fichiers, encodages, config
```

Chaque fonctionnalité est une extension qui s'active avec `activate(ctx)`. Tout ce qu'elle enregistre via `ctx` est retiré à sa désactivation. Une règle ESLint interdit aux extensions d'importer autre chose que `src/api`.

## Développement

Prérequis : Node 20+, Rust stable, et sous Windows les Visual Studio Build Tools (charge de travail C++). Voir les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/).

```sh
npm install
npm run tauri dev      # lance l'application
npm run tauri build    # construit l'exécutable
```

Vérifications :

```sh
npm run lint && npm run check && npm test
npm run test:e2e       # tests Playwright dans un navigateur (frontend seul)
cd src-tauri && cargo test && cargo clippy && cargo fmt --check
```

`npm run dev` lance le frontend seul dans un navigateur, sans accès aux fichiers.

## Licence

MIT
