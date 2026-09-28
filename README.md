# cascades

Un éditeur de texte léger pensé pour la prise de notes, qui reste capable d'ouvrir n'importe quel fichier texte ou code. La simplicité de Notepad++, la personnalisation de Vim.

> Projet en cours de développement (jalon 0.2). Voir [BRIEF.md](BRIEF.md) pour la vision complète.

## Fonctionnalités actuelles

- Onglets multiples, réorganisables, avec indicateur de modification.
- Ouvrir, enregistrer, enregistrer sous, rouvrir le dernier onglet fermé.
- **Session restaurée** au redémarrage, comme Notepad++ : onglets, curseur, scroll, et le texte des onglets non enregistrés. Rien n'est perdu en fermant la fenêtre.
- Sauvegarde automatique optionnelle.
- Fichier modifié par un autre programme : rechargé tout seul s'il n'a pas de modifications en cours, sinon un bandeau propose de recharger ou de garder sa version.
- Glisser-déposer des fichiers dans la fenêtre pour les ouvrir.
- Détection d'encodage (UTF-8, UTF-8 BOM, UTF-16, Latin-1...) et de fins de ligne (LF, CRLF), conservés à l'enregistrement.
- Coloration syntaxique selon l'extension du fichier.
- **Cascades** : des connecteurs relient chaque ligne indentée à sa ligne parente, sans rien ajouter au fichier. Chaque ligne parente est repliable.
- Entrée conserve l'indentation exacte de la ligne (les tabulations restent des tabulations).
- **Listes intelligentes** (`-`, `*`, `+`, `1.`, `a)`, `- [ ]`) : Entrée continue la liste, Tab et Shift+Tab changent le niveau, les numéros se mettent à jour tout seuls, Ctrl+Entrée coche une tâche.
- Barre d'état : position, mots, caractères, langage, encodage, fin de ligne.
- **Thèmes** : Clair, Sombre, Haut contraste, Solarized clair et sombre, Nord, Gruvbox, et les vôtres. Par défaut, l'application suit le mode clair ou sombre de Windows.
- Polices réglables (éditeur et interface), zoom au clavier ou avec Ctrl+molette.
- Barre de menus, onglets et barre d'état masquables, **mode zen** plein écran.
- Fusion des modifications externes, avec résolution des conflits dans le texte.
- **Vues scindées** (jusqu'à 4, côte à côte ou empilées) : un fichier différent dans chacune, ou le même fichier cloné dans plusieurs vues, synchronisées, chacune avec son curseur et son historique. Clic droit sur un onglet pour cloner ou déplacer, ou glisser l'onglet vers une autre vue.
- **Quarantaine** : mettre de côté un passage (Leader Q) pour essayer le texte sans lui. Chaque passage devient une carte dans un panneau propre au fichier, gardée entre les sessions, et se replace n'importe où (bouton ou glisser dans le texte). Ctrl+Z et Ctrl+Y suivent.
- **Aperçus** (Ctrl+Shift+V) à côté de l'éditeur ou seuls : Markdown (tables, cases à cocher, notes de bas de page, code coloré, images locales, scroll synchronisé), HTML (isolé, scripts bloqués par défaut), SVG, CSV/TSV en tableau triable, JSON en arbre. Les images s'ouvrent dans un onglet avec zoom.
- Tout est une commande, tous les raccourcis sont des bindings remplaçables.
- Configuration par `settings.json` et script `init.js`.

## Raccourcis par défaut

| Action                                          | Raccourci                                 |
| ----------------------------------------------- | ----------------------------------------- |
| Nouveau / Ouvrir / Enregistrer                  | Ctrl+N / Ctrl+O / Ctrl+S                  |
| Enregistrer sous                                | Ctrl+Shift+S                              |
| Fermer l'onglet / Rouvrir le dernier fermé      | Ctrl+W / Ctrl+Shift+T                     |
| Onglet suivant / précédent                      | Ctrl+Tab / Ctrl+Shift+Tab                 |
| Rechercher / Remplacer                          | Ctrl+F / Ctrl+H                           |
| Dupliquer la ligne                              | Shift+Alt+Bas                             |
| Déplacer la ligne                               | Alt+Haut / Alt+Bas                        |
| Supprimer la ligne                              | Ctrl+Shift+K                              |
| Commenter                                       | Ctrl+/                                    |
| Ajouter l'occurrence suivante                   | Ctrl+D                                    |
| Cocher / décocher une tâche                     | Ctrl+Entrée                               |
| Palette de commandes                            | Ctrl+Shift+P / Leader P                   |
| Ouverture rapide (onglets, fichiers récents)    | Ctrl+P / Leader O                         |
| Choisir le thème                                | Leader T                                  |
| Zoom                                            | Ctrl+= / Ctrl+- / Ctrl+0, Ctrl+molette    |
| Mode zen (Échap pour sortir)                    | Leader Z                                  |
| Afficher / masquer les cascades                 | Leader C                                  |
| Mettre en quarantaine / panneau de quarantaine  | Leader Q / Leader Shift+Q                 |
| Cloner dans la vue suivante                     | Ctrl+\ ou Leader S                        |
| Déplacer vers la vue suivante / précédente      | Ctrl+Alt+→ / Ctrl+Alt+←                   |
| Aller à la vue 1 à 4                            | Ctrl+1 … Ctrl+4                           |
| Vues côte à côte / empilées                     | Leader Shift+S                            |
| Masquer / afficher la cascade du bloc courant   | Leader Shift+C                            |
| Aperçu à côté / seul                            | Ctrl+Shift+V ou Leader V / Leader Shift+V |
| Afficher / masquer menus, onglets, barre d'état | Leader M / Leader Tab / Leader B          |

**Leader** est la touche leader, **Ctrl+Espace** par défaut (réglage `keyboard.leader`) : on l'appuie, puis la touche suivante. Une barre en bas de la fenêtre affiche alors les touches possibles.

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

| Clé                                                    | Défaut                                   | Description                                                                    |
| ------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `editor.tabSize`                                       | `4`                                      | Largeur d'une tabulation                                                       |
| `editor.insertSpaces`                                  | `false`                                  | Indenter avec des espaces                                                      |
| `editor.wordWrap`                                      | `false`                                  | Retour à la ligne automatique                                                  |
| `editor.lineNumbers`                                   | `true`                                   | Numéros de ligne                                                               |
| `editor.folding`                                       | `true`                                   | Marge de repli                                                                 |
| `editor.highlightActiveLine`                           | `true`                                   | Surligner la ligne du curseur                                                  |
| `editor.fontSize`                                      | `14`                                     | Taille de police de l'éditeur (px)                                             |
| `editor.fontFamily`                                    | `"'Cascadia Code', Consolas, monospace"` | Police de l'éditeur                                                            |
| `editor.lineHeight`                                    | `1.6`                                    | Hauteur de ligne                                                               |
| `editor.fontLigatures`                                 | `false`                                  | Ligatures de la police                                                         |
| `workbench.theme`                                      | `"auto"`                                 | Thème, ou `auto` pour suivre le système                                        |
| `workbench.themeLight` / `workbench.themeDark`         | `"light"` / `"dark"`                     | Thèmes utilisés en mode `auto`                                                 |
| `workbench.fontFamily` / `workbench.fontSize`          | police système / `13`                    | Police de l'interface                                                          |
| `workbench.showMenuBar` / `showTabs` / `showStatusBar` | `true`                                   | Afficher chaque barre                                                          |
| `keyboard.leader`                                      | `"Ctrl+Space"`                           | Touche leader des raccourcis `Leader X`                                        |
| `preview.fontFamily` / `preview.fontSize`              | police système / `15`                    | Police des aperçus                                                             |
| `preview.htmlScripts`                                  | `false`                                  | Exécuter les scripts des pages HTML prévisualisées                             |
| `zen.width`                                            | `80`                                     | Largeur du texte en mode zen (caractères)                                      |
| `files.defaultExtension`                               | `"txt"`                                  | Extension proposée pour un nouveau fichier                                     |
| `files.autoSave`                                       | `"off"`                                  | `afterDelay` enregistre les fichiers modifiés automatiquement                  |
| `files.autoSaveDelay`                                  | `1000`                                   | Délai avant l'enregistrement automatique (ms)                                  |
| `session.restore`                                      | `true`                                   | Rouvrir les onglets, y compris non enregistrés, au démarrage                   |
| `cascades.enabled`                                     | `true`                                   | Dessiner les connecteurs de cascade                                            |
| `cascades.languages`                                   | `["plaintext", "markdown"]`              | Langages où les cascades sont actives                                          |
| `cascades.style`                                       | `"arrow"`                                | `arrow`, `rounded`, `curved`, `bullet`, `line`, `dashed`, `dotted` ou `guides` |
| `cascades.lineWidth`                                   | `1.2`                                    | Épaisseur des traits (px)                                                      |
| `cascades.ignoreLists`                                 | `false`                                  | Pas de cascade vers les éléments de liste                                      |
| `cascades.colorByDepth`                                | `true`                                   | Une couleur par niveau de profondeur                                           |
| `cascades.highlight`                                   | `true`                                   | Mettre en valeur la branche de la ligne active                                 |
| `smartLists.languages`                                 | `["plaintext", "markdown"]`              | Langages où les listes intelligentes sont actives                              |
| `smartLists.continue`                                  | `true`                                   | Entrée continue la liste, ou en sort sur une puce vide                         |
| `smartLists.tabIndents`                                | `true`                                   | Tab et Shift+Tab changent le niveau d'une ligne de liste                       |
| `smartLists.renumber`                                  | `true`                                   | Renuméroter les listes numérotées                                              |
| `indentKeep.enabled`                                   | `true`                                   | Entrée garde l'indentation exacte de la ligne                                  |

Un bloc `"[langage]"` surcharge les réglages pour un langage (`markdown`, `javascript`, `plaintext`...).

`settings.json` est rechargé dès qu'on l'enregistre.

### Thèmes

Un thème est un fichier JSON placé dans le sous-dossier `themes` du dossier de config. Il redéfinit les couleurs qu'il veut, les autres viennent de la palette de base de son type :

```json
{
  "name": "Sépia",
  "type": "light",
  "colors": { "bg": "#f4ecd8", "fg": "#433422", "accent": "#a0522d", "syn-keyword": "#8b4513" }
}
```

Le fichier `themes/sepia.json` donne le thème `user.sepia`, à choisir avec Ctrl+Espace T. Il est rechargé à chaque enregistrement. La liste des couleurs disponibles est dans [src/themes/default.css](src/themes/default.css).

### init.js

`init.js` est un module JavaScript chargé au démarrage comme une extension. Il reçoit le même objet `ctx` que les fonctionnalités internes : commandes, raccourcis, settings, onglets, éditeur (CodeMirror 6), barre d'état. Exemple complet : [docs/examples/init.js](docs/examples/init.js).

```js
export default function (ctx) {
  ctx.commands.register('user.hello', () => ctx.dialogs.alert('Bonjour'));
  ctx.keybindings.register({ key: 'Leader H', command: 'user.hello' });
  ctx.menus.registerItem('edit', { command: 'user.hello', title: 'Dire bonjour', group: '9_user' });
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
