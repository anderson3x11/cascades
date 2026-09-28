# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Noyau : registre de commandes, résolveur de raccourcis (séquences, conditions `when`), settings en couches (défauts, utilisateur, par langage), registre de menus, bus d'événements, hôte d'extensions.
- API d'extensions (`src/api`), utilisée par toutes les fonctionnalités internes.
- Barre de menus Fichier, Édition, Affichage, alimentée par les extensions via `ctx.menus`, avec le raccourci de chaque commande.
- Onglets : nouveau (bouton +), ouvrir, enregistrer, enregistrer sous, fermer (avec confirmation), rouvrir le dernier fermé, réorganisation par glisser-déposer.
- Barre d'état : position, sélection, mots, caractères, langage, encodage, fin de ligne.
- Cascades : connecteurs entre chaque ligne indentée et sa ligne parente, dessinés en surimpression (le fichier n'est pas modifié), avec 8 styles (flèches, coins arrondis, courbes, points, traits, tirets, pointillés, guides verticaux) choisis avec un aperçu en direct, une épaisseur réglable, une couleur par profondeur, la mise en valeur de la branche active et le repli par cascade. Actives pour `.txt`, `.md` et les fichiers sans extension, désactivables d'un raccourci (Leader C).
- Listes intelligentes : continuation et sortie de liste avec Entrée, changement de niveau avec Tab et Shift+Tab, renumérotation automatique (annulable en un seul Ctrl+Z), Ctrl+Entrée pour cocher une tâche. Chaque comportement est désactivable.
- Restauration de session : onglets, curseur, scroll et texte non enregistré sont restaurés au démarrage. Fermer la fenêtre ne demande plus de confirmation.
- Sauvegarde automatique optionnelle (`files.autoSave`).
- Détection des modifications externes : rechargement automatique d'un onglet sans modification en cours, sinon un bandeau propose de fusionner (fusion à trois voies, comme git), de garder sa version ou de prendre celle du disque, et avertissement si le fichier est supprimé.
- Conflits : les blocs `<<<<<<<` / `=======` / `>>>>>>>` (issus d'une fusion ou de git) sont colorés, avec les boutons « Garder la mienne », « Garder celle du disque » et « Garder les deux ».
- Repli : chevron plus grand, étiquette « ⋯ N lignes ».
- Onglets : l'onglet glissé se détache et les autres se décalent en douceur.
- Glisser-déposer de fichiers dans la fenêtre pour les ouvrir.
- API : `ctx.banners`, `ctx.configFiles`, `ctx.app.onWillQuit`, `ctx.fs.watch`.
- Moteur de thèmes : 7 thèmes fournis (Clair, Sombre, Haut contraste, Solarized clair et sombre, Nord, Gruvbox), thèmes utilisateur en JSON rechargés à chaud, sélecteur avec aperçu en direct (Leader T).
- Sélecteur rapide avec recherche floue, palette de commandes (Ctrl+Shift+P) et ouverture rapide des onglets et fichiers récents (Ctrl+P).
- Touche leader configurable (Ctrl+Espace par défaut), avec une barre qui affiche les touches possibles, comme which-key dans Neovim.
- Réglages de police de l'éditeur et de l'interface, zoom (Ctrl+= / Ctrl+- / Ctrl+0, Ctrl+molette) mémorisé.
- Barre de menus, onglets et barre d'état masquables ; mode zen plein écran (Leader Z).
- Retrait suspendu : une ligne indentée qui passe à la ligne reste alignée sous son texte.
- `settings.json` rechargé à chaud, et réglages modifiables depuis l'interface.
- `settings.json` accepte les commentaires, gardés quand un réglage est modifié depuis l'interface ; erreurs affichées dans un bandeau.
- `keybindings.json` au format VS Code : ajout, remplacement et retrait (`-commande`) de raccourcis, rechargé à chaud.
- Raccourcis Ctrl+Alt+lettre reconnus même quand Windows les traite comme AltGr (Ctrl+Alt+N qui donnait « ñ »).
- Aide à l'édition de `settings.json` et `keybindings.json` : complétion des réglages, valeurs et commandes, erreurs soulignées, description au survol. Un fichier encore vide reçoit un mode d'emploi en commentaire à l'ouverture.
- Fenêtre Préférences (Ctrl+,) : tous les réglages avec recherche, un contrôle par type, portée globale ou par langage, retour à la valeur par défaut. API `ctx.modals` et `ctx.settings.inspect`.
- Page Raccourcis des Préférences : toutes les commandes et leurs raccourcis, recherche, changement en tapant la nouvelle combinaison (Leader compris), ajout, retrait, retour aux défauts, conflits signalés ; écrit dans `keybindings.json`. API `ctx.keybindings.list`, `capture`, `format` et `onDidChange`.
- Explorateur à gauche : un ou plusieurs dossiers (Ajouter un dossier…, Ctrl+Shift+O), retirés de la liste d'un clic droit, arbre mis à jour tout seul, créer, renommer (F2, les onglets suivent), mettre à la corbeille (Suppr, avec confirmation), noms masqués par `explorer.exclude`, dossiers gardés d'une session à l'autre, Ctrl+B pour le panneau. Le menu du navigateur (Retour, Actualiser, Inspecter) n'apparaît plus au clic droit hors des zones de texte. API : panneaux à gauche (`side: 'left'`), `ctx.contextMenu`, `ctx.fs.listDir`, `createFile`, `createDir`, `rename`, `trash`, `watchDir`, `ctx.dialogs.pickFolder`.
- Commentaires grisés dans les fichiers JSON, et Ctrl+/ les commente avec `//`. Ctrl+: commente aussi, pour les claviers AZERTY.
- Aperçus (Ctrl+Shift+V), à côté de l'éditeur ou seuls, chargés à la demande : Markdown (tables, cases à cocher, notes, code coloré aux couleurs du thème, images locales, liens ouverts dans le navigateur, scroll synchronisé), HTML dans une iframe isolée (scripts bloqués par défaut), SVG, CSV/TSV en tableau triable, JSON en arbre repliable.
- Visionneuse d'images avec zoom, dans un onglet dédié.
- API : `ctx.viewers` pour ajouter des aperçus, `ctx.editor.highlightCode`, `ctx.fs.fileUrl`, `ctx.app.openExternal`.
- Vues scindées : jusqu'à 4 vues côte à côte ou empilées, chacune avec ses onglets. Un fichier peut être cloné dans plusieurs vues (même texte, curseur et historique propres à chaque vue). Déplacement d'onglets par menu contextuel, raccourcis ou glisser-déposer entre vues ; la session retient les vues et les clones.
- API : `TabInfo.groupId` / `documentId`, `workspace.groups`, `clone`, `moveToGroup`, `focusGroup`, orientation.
- Cascades bloc par bloc : un bouton au survol de chaque ligne racine (ou Leader Shift+C) masque ou réaffiche la cascade de ce bloc, mémorisé par fichier ; réglage `cascades.ignoreLists` pour ne jamais en dessiner vers les listes.
- Quarantaine : mettre de côté des passages d'un fichier (Leader Q) dans un panneau latéral propre au fichier, gardé entre les sessions (jamais écrit dans le fichier). Chaque passage est une carte, à réinsérer au curseur ou à glisser n'importe où dans le texte ; Ctrl+Z et Ctrl+Y gardent fichier et quarantaine synchronisés.
- API : `ctx.panels` pour les panneaux latéraux.
- Palettes claire et sombre qui suivent le thème du système, y compris la coloration syntaxique.
- Entrée conserve l'indentation exacte de la ligne (tabulations comprises).
- Lecture et écriture avec détection d'encodage (UTF-8, UTF-8 BOM, UTF-16, Latin-1 et autres), de fins de ligne et de fichiers binaires.
- Extension `.txt` proposée par défaut à l'enregistrement (réglage `files.defaultExtension`).
- Chargement de `settings.json` et `init.js` depuis le dossier de config, avec mode portable.
- CI GitHub Actions (lint, tests, build Windows, macOS, Linux).

### Corrigé

- Les raccourcis avec un chiffre (Ctrl+0...) ne marchaient pas sur un clavier AZERTY.
- La réorganisation des onglets par glisser ne fonctionnait pas dans l'application (le glisser-déposer natif est réservé aux fichiers sous Windows).
- Le pointeur de la souris restait invisible dans les dialogues ouverts après avoir tapé du texte (option Windows « Masquer le pointeur pendant la frappe »).
