# Brief projet : Cascade (nom provisoire)

## Vision

Un éditeur de texte open source, léger et rapide, pensé d'abord pour la prise de notes et l'écriture libre (notes, reviews de jeux et de films, listes, brouillons), tout en restant capable d'ouvrir et d'éditer n'importe quel fichier texte ou code.

L'idée résumée : **la simplicité de Notepad++, la customisation de Vim, une interface moderne et agréable**. Il doit être complet pour les utilisateurs avancés, mais utilisable immédiatement par n'importe qui sans configuration.

Principes directeurs :

- **Rapide** : démarrage quasi instantané, fluide même sur de gros fichiers.
- **Le fichier reste du texte brut** : toutes les améliorations visuelles (cascades, rendu) sont de l'affichage, jamais des modifications du contenu.
- **Tout est configurable** : couleurs, polices, raccourcis, comportements, via des fichiers de config lisibles.
- **Extensible dès la conception** : l'architecture interne passe par un système de commandes et d'extensions qui deviendra l'API de plugins publique.

## Stack technique

| Couche | Choix | Raison |
|---|---|---|
| Application desktop | **Tauri 2** (Rust) | Binaire léger, multiplateforme (Windows, macOS, Linux), accès fichiers natif |
| Frontend | **TypeScript + Vite** | Typage strict, build rapide |
| UI | **Svelte 5** (ou Solid si justifié) | Léger, réactif, peu de surcoût runtime |
| Moteur d'édition | **CodeMirror 6** | Modulaire, performant, décorations, mode Vim, nombreux langages |
| Mode Vim | `@replit/codemirror-vim` | Implémentation Vim la plus complète pour CM6 |
| Markdown | `markdown-it` + plugins (tables, tâches, footnotes) | Standard, extensible |
| Sanitization | `DOMPurify` | Sécurité des aperçus HTML/Markdown |
| PDF | `pdf.js` | Visualisation PDF |
| Tests | `vitest` (unitaires), `playwright` (e2e) | |
| Lint/format | `eslint` + `prettier`, `clippy` + `rustfmt` côté Rust | |

Licence : **MIT**.

## Fonctionnalités

### 1. Éditeur de base

- Onglets multiples, réorganisables par glisser-déposer, avec indicateur de modification non sauvegardée.
- Vue scindée (split horizontal et vertical), le même fichier pouvant être ouvert dans deux vues.
- Ouvrir, sauvegarder, sauvegarder sous, fermer, rouvrir le dernier onglet fermé.
- Restauration de session : onglets, position du curseur et scroll restaurés au redémarrage, y compris les onglets non sauvegardés (comme Notepad++).
- Sauvegarde automatique optionnelle.
- Détection des modifications externes d'un fichier ouvert, avec proposition de recharger.
- Détection et conversion d'encodage (UTF-8, UTF-8 BOM, UTF-16, Latin-1...) et de fins de ligne (LF, CRLF).
- Rechercher / remplacer dans le fichier et dans un dossier, avec regex, sensibilité à la casse, mot entier.
- Multi-curseurs, sélection en colonne.
- Numéros de ligne, minimap optionnelle, repli de blocs (folding), retour à la ligne automatique activable.
- Barre d'état : langage, encodage, fin de ligne, position, nombre de mots et de caractères.
- Explorateur de fichiers latéral optionnel (ouvrir un dossier comme espace de travail).
- Glisser-déposer de fichiers dans la fenêtre pour les ouvrir.

### 2. Types de fichiers

Objectif : ouvrir le maximum de formats.

- **Tout fichier texte** s'ouvre en édition, avec coloration syntaxique quand le langage est reconnu (via `@codemirror/language-data` et les modes legacy : Markdown, HTML, CSS, JS/TS, JSON, YAML, TOML, XML, Python, Rust, C/C++, Java, Go, PHP, SQL, Shell, INI, Lua, etc.).
- Détection du langage par extension, puis par contenu (shebang, balises) en repli.
- **Fichiers binaires** : détection automatique, affichage d'un message avec option d'ouverture en vue hexadécimale en lecture seule.
- **Gros fichiers** (> 50 Mo) : mode dégradé performant (coloration désactivée, chargement progressif).

### 3. Aperçus (preview)

Aperçu côte à côte ou en plein écran, basculable avec un raccourci, synchronisé au scroll quand c'est pertinent.

| Format | Aperçu |
|---|---|
| Markdown | Rendu complet (tables, cases à cocher, blocs de code colorés, footnotes, images locales) |
| HTML | Rendu dans une iframe sandboxée, rafraîchi en direct |
| SVG | Rendu de l'image |
| Images (png, jpg, gif, webp, bmp, ico) | Visionneuse avec zoom |
| PDF | Visionneuse pdf.js |
| CSV / TSV | Tableau triable |
| JSON | Arbre repliable |

L'aperçu doit être un **système de "viewers" enregistrables** : chaque viewer déclare les extensions qu'il gère. Les plugins pourront en ajouter.

### 4. Les cascades (fonctionnalité signature)

L'utilisateur écrit souvent ses notes ainsi : une ligne, puis Entrée, puis plusieurs tabulations pour écrire une idée qui découle de la ligne au-dessus, formant une "cascade".

L'éditeur doit **dessiner des connecteurs visuels** reliant chaque ligne indentée à sa ligne parente.

Contenu réel du fichier (tabs) :

```
Elden Ring
	Combat exigeant
		Surtout les boss du DLC
		Parades très satisfaisantes
	Direction artistique folle
Hollow Knight
	Ambiance incroyable
```

Rendu visuel attendu :

```
Elden Ring
 └──> Combat exigeant
 │     ├──> Surtout les boss du DLC
 │     └──> Parades très satisfaisantes
 └──> Direction artistique folle
Hollow Knight
 └──> Ambiance incroyable
```

Spécification :

- **Parent** d'une ligne = la ligne non vide la plus proche au-dessus ayant une indentation strictement inférieure.
- Un trait vertical part sous le premier caractère du parent et descend jusqu'au dernier enfant direct. Chaque enfant reçoit une branche horizontale terminée par une flèche, dessinée dans l'espace de son indentation.
- Les lignes vides n'interrompent pas une cascade.
- Tabs et espaces sont gérés (largeur de tab configurable, défaut 4).
- Les connecteurs sont des **décorations CodeMirror** (widgets/overlay) : aucun caractère n'est ajouté au fichier, la copie de texte ne contient que les tabs.
- Couleur des connecteurs configurable par thème, avec option de couleur différente par niveau de profondeur.
- Style configurable : flèche, trait simple, pointillés, arrondi.
- Survol ou curseur sur une ligne : sa branche et son parent sont mis en surbrillance.
- Chaque ligne parente devient repliable (folding basé sur la cascade).
- Activée par défaut pour les fichiers `.txt`, `.md` et les fichiers sans extension, désactivable par langage et globalement.
- Doit rester fluide sur des fichiers de plusieurs milliers de lignes (calcul limité au viewport + marge, mise à jour incrémentale).

### 5. Édition intelligente

Comportements contextuels, chacun désactivable individuellement :

- **Continuation de listes** : Entrée sur une ligne `- item`, `* item`, `+ item`, `1. item`, `a) item`, `- [ ] tâche` crée une nouvelle puce du même type et au même niveau. Les listes numérotées s'incrémentent.
- **Sortie de liste** : Entrée sur une puce vide supprime la puce et sort de la liste (ou remonte d'un niveau si indentée).
- **Tab / Shift+Tab** sur une ligne de liste change son niveau d'indentation, où que soit le curseur.
- **Renumérotation automatique** des listes numérotées après insertion, suppression ou déplacement.
- **Conservation de l'indentation** : Entrée garde l'indentation de la ligne courante (indispensable pour les cascades).
- **Cases à cocher** : raccourci pour cocher/décocher `[ ]` / `[x]`.
- **Paires automatiques** : parenthèses, crochets, accolades, guillemets, `**`, `_`, backticks en Markdown. Taper le caractère fermant saute par-dessus s'il existe déjà.
- **Entourer la sélection** : taper `(`, `"`, `*` avec une sélection l'entoure au lieu de la remplacer.
- **Liens cliquables** avec Ctrl+clic.
- **Collage intelligent** : coller une URL sur du texte sélectionné en Markdown crée un lien `[texte](url)`.
- **Insertion de date/heure** avec format configurable.
- **Déplacer / dupliquer des lignes** (Alt+flèches, Shift+Alt+flèches).
- **Tableaux Markdown** : alignement automatique des colonnes, Tab pour passer à la cellule suivante.

### 6. Personnalisation

- **Thèmes** : fichiers JSON dans le dossier de config, basés sur des variables CSS (couleurs de l'interface, de l'éditeur, de la coloration syntaxique, des cascades). Rechargement à chaud. Fournir au moins : clair, sombre, un thème haut contraste, et 2 ou 3 thèmes populaires réinterprétés (style Solarized, Nord, Gruvbox).
- **Polices** : police de l'éditeur, de l'interface et de l'aperçu séparément, taille, hauteur de ligne, ligatures on/off.
- **Interface** : chaque élément (onglets, barre d'état, explorateur, minimap, numéros de ligne) peut être masqué. Mode zen / sans distraction (plein écran, texte centré, largeur de colonne limitée).
- **Paramètres** : un fichier `settings.json` éditable directement dans l'éditeur (avec autocomplétion via JSON Schema) **et** une interface graphique de paramètres pour ceux qui ne veulent pas toucher au JSON. Les deux restent synchronisés.
- Paramètres surchargeables par langage (ex. retour à la ligne actif pour Markdown uniquement).
- Emplacement de la config : dossier standard de l'OS, avec option de mode portable (config à côté de l'exécutable).

### 7. Raccourcis clavier

- **Toute action de l'application est une commande** identifiée (ex. `editor.duplicateLine`, `view.togglePreview`). Les raccourcis, menus, palette et plugins appellent tous ces commandes.
- Raccourcis remappables via `keybindings.json`, avec support des séquences (ex. `Ctrl+K Ctrl+S`) et des conditions (ex. seulement quand l'aperçu est ouvert).
- **Palette de commandes** (Ctrl+Shift+P) avec recherche floue, affichant le raccourci associé à chaque commande.
- **Ouverture rapide** de fichier (Ctrl+P) avec recherche floue dans l'espace de travail et les fichiers récents.
- **Mode Vim** activable (normal, insertion, visuel, commandes `:w`, `:q`, etc.) avec un indicateur de mode dans la barre d'état.
- Page d'aide listant tous les raccourcis actifs.

Raccourcis par défaut (à compléter, conventions proches de VS Code et Notepad++) :

| Action | Raccourci |
|---|---|
| Palette de commandes | Ctrl+Shift+P |
| Ouverture rapide | Ctrl+P |
| Nouveau / Ouvrir / Sauvegarder | Ctrl+N / Ctrl+O / Ctrl+S |
| Fermer l'onglet / Rouvrir le dernier fermé | Ctrl+W / Ctrl+Shift+T |
| Onglet suivant / précédent | Ctrl+Tab / Ctrl+Shift+Tab |
| Basculer l'aperçu | Ctrl+Shift+V |
| Split vertical | Ctrl+\ |
| Rechercher / Remplacer | Ctrl+F / Ctrl+H |
| Rechercher dans les fichiers | Ctrl+Shift+F |
| Dupliquer la ligne | Shift+Alt+Bas |
| Déplacer la ligne | Alt+Haut / Alt+Bas |
| Supprimer la ligne | Ctrl+Shift+K |
| Commenter | Ctrl+/ |
| Multi-curseur ajouter occurrence suivante | Ctrl+D |
| Cocher / décocher une tâche | Ctrl+Entrée |
| Insérer la date | Ctrl+Shift+; |
| Mode zen | Ctrl+K Z |
| Zoom | Ctrl+= / Ctrl+- / Ctrl+0 |

### 8. Système de plugins (préparé en v0, public en v1)

L'architecture doit être pensée pour les plugins dès le départ, même si l'API publique n'est ouverte qu'en v1.

- **Les fonctionnalités internes sont elles-mêmes des extensions** (cascades, listes intelligentes, viewers, thèmes) qui s'enregistrent via la même API. C'est la meilleure garantie que l'API sera suffisante.
- Un plugin = un dossier avec un `manifest.json` (nom, version, auteur, permissions, points d'entrée) et un module JS/TS.
- Points d'extension prévus : commandes, raccourcis, extensions CodeMirror, viewers d'aperçu, thèmes, langages, panneaux latéraux, éléments de barre d'état, hooks d'événements (ouverture, sauvegarde, changement d'onglet).
- Permissions déclarées (accès fichiers, réseau) et isolation raisonnable ; pas d'accès direct aux API Tauri sans permission.
- Plus tard : gestionnaire de plugins dans l'interface et registre communautaire.

## Architecture proposée

```
cascade/
├── src-tauri/              # Backend Rust (fichiers, encodages, watcher, config, session)
│   └── src/
│       ├── commands/       # Commandes Tauri exposées au frontend
│       ├── fs/             # Lecture/écriture, détection encodage et binaire
│       ├── watcher/        # Surveillance des modifications externes
│       └── config/         # Chemins de config, mode portable
├── src/                    # Frontend
│   ├── core/
│   │   ├── commands/       # Registre de commandes
│   │   ├── keybindings/    # Résolution des raccourcis
│   │   ├── settings/       # Chargement, validation (JSON Schema), réactivité
│   │   ├── extensions/     # Registre d'extensions (futur API plugins)
│   │   └── session/        # Onglets, état, restauration
│   ├── editor/
│   │   ├── cascade/        # Détection des parents + décorations
│   │   ├── smart-lists/    # Continuation, renumérotation, cases
│   │   ├── smart-edit/     # Paires, entourage, collage intelligent
│   │   └── languages/      # Détection du langage
│   ├── viewers/            # Markdown, HTML, image, PDF, CSV, JSON, hex
│   ├── themes/             # Thèmes par défaut + moteur de thèmes
│   ├── ui/                 # Composants (onglets, palette, barre d'état, settings)
│   └── main.ts
├── docs/                   # Doc utilisateur et doc de l'API plugins
├── tests/
└── README.md
```

## Consignes pour Claude Code

- Travailler **jalon par jalon** (voir roadmap). À la fin de chaque jalon : l'application compile, se lance et les tests passent.
- Avant de coder un jalon, proposer un court plan et le faire valider.
- TypeScript en mode `strict`, pas de `any` sans justification.
- Chaque fonctionnalité d'édition intelligente et la logique des cascades doivent avoir des **tests unitaires** (ces logiques sont des fonctions pures sur le texte, faciles à tester).
- Ne jamais modifier le contenu du fichier pour un effet visuel.
- Performance : tester l'ouverture d'un fichier de 10 000 lignes avec cascades actives, la saisie doit rester fluide.
- Sécurité : tout HTML rendu passe par DOMPurify ou une iframe sandboxée sans accès aux API Tauri.
- Commits petits et descriptifs (convention Conventional Commits).
- Tenir à jour le `README.md` (installation, build, fonctionnalités) et un `CHANGELOG.md`.
- Mettre en place la CI GitHub Actions (lint, tests, build des trois OS) dès le jalon 1.

## Roadmap

**Jalon 0.1 : fondations et cœur de l'éditeur**
Squelette Tauri + Vite + Svelte + CodeMirror, onglets, ouvrir/sauvegarder, restauration de session, registre de commandes, raccourcis de base, barre d'état, encodages et fins de ligne, conservation de l'indentation, cascades, listes intelligentes, CI.

**Jalon 0.2 : aperçus et apparence**
Système de viewers (Markdown, HTML, images, SVG, CSV, JSON), split view, moteur de thèmes et thèmes par défaut, réglages de polices, mode zen.

**Jalon 0.3 : puissance et configuration**
Palette de commandes, ouverture rapide, `keybindings.json`, `settings.json` avec schéma, interface de paramètres, mode Vim, recherche dans les fichiers, explorateur latéral, PDF, vue hex, reste de l'édition intelligente.

**Jalon 1.0 : plugins et publication**
API de plugins publique et documentée, chargement de plugins depuis le dossier de config, 2 plugins d'exemple, installeurs pour Windows, macOS et Linux, site/README de présentation.

## Critères de réussite

- Un nouvel utilisateur peut prendre des notes immédiatement sans rien configurer.
- Un utilisateur avancé peut tout remapper et tout thémer via des fichiers texte.
- Les cascades rendent les notes en arborescence nettement plus lisibles qu'avec Notepad++.
- L'application démarre en moins d'une seconde et pèse moins de 20 Mo installée.
