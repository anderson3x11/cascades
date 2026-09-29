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
- Explorateur à gauche : un ou plusieurs dossiers (Ajouter un dossier…, Ctrl+Shift+O), retirés de la liste d'un clic droit, petites icônes par type de fichier, arbre mis à jour tout seul, créer, renommer (F2, les onglets suivent), mettre à la corbeille (Suppr, avec confirmation), noms masqués par `explorer.exclude`, dossiers gardés d'une session à l'autre, Ctrl+B pour le panneau. Le menu du navigateur (Retour, Actualiser, Inspecter) n'apparaît plus au clic droit hors des zones de texte. API : panneaux à gauche (`side: 'left'`), `ctx.contextMenu`, `ctx.fs.listDir`, `createFile`, `createDir`, `rename`, `trash`, `watchDir`, `ctx.dialogs.pickFolder`.
- Recherche des sélecteurs plus stricte : les lettres tapées doivent se suivre ou commencer des mots (« notes » ne trouve plus « u**n**qu**o**ted-expression »), « sd » trouve toujours « Solarized dark ».
- Ctrl+P cherche aussi dans les fichiers des dossiers ouverts ; les fichiers récents hors de ces dossiers sont marqués « récent », listés côté Rust en respectant `.gitignore` et `explorer.exclude` ; les résultats s'ajoutent sans attendre et la liste affiche les 200 meilleurs. API `ctx.fs.listFiles` et option `more` du sélecteur rapide.
- Rechercher et remplacer dans les fichiers (Ctrl+Shift+F), dans un onglet Rechercher du panneau de gauche : casse, mot entier, expression régulière (`$1` dans le remplacement), résultats au fil de l'eau côté Rust, aperçu du remplacement, confirmation, encodages conservés, fichiers modifiés non enregistrés laissés de côté. API `ctx.fs.searchFiles` et `replaceInFiles`.
- Visionneuse PDF (pdf.js, chargée à la première ouverture) : pages dessinées au fil du défilement, texte sélectionnable, zoom (boutons, Ctrl+molette, ajuster à la largeur), numéro de page. API `ctx.fs.readBinary`.
- Vue hexadécimale en lecture seule pour les fichiers binaires (adresse, octets, caractères), lue par morceaux et dessinée seulement à l'écran ; ces fichiers reviennent aussi avec la session. API `ctx.fs.fileSize`, option `binary` des visionneuses.
- Barre d'état des PDF, images et vues hexadécimales : le type de vue et la taille du fichier, au lieu de la position et des mots.
- Paires automatiques : ( [ { " ' se ferment en tapant (pas l'apostrophe dans un mot) ; en Markdown, `**` au deuxième astérisque, `` ` `` et les blocs ` ``` `. Un de ces caractères, ou `*`, `_`, `` ` ``, `~`, tapé sur une sélection l'entoure, dans tous les fichiers. Retour arrière juste après une parenthèse ouverte efface la paire. Réglage `autoPairs.enabled`, par langage si besoin.
- Liens : Ctrl+clic ouvre une adresse web dans le navigateur ou un lien Markdown vers un fichier (relatif au fichier courant) dans un onglet ; le lien se souligne quand Ctrl est enfoncé ; adresses soulignées dans les fichiers texte. En Markdown, coller une adresse sur du texte sélectionné donne `[texte](adresse)`. Réglages `links.ctrlClick` et `links.pasteAsMarkdown`.
- Insérer la date (Ctrl+;, Édition > Insérer la date), au format réglable `insertDate.format` : `DD/MM/YYYY` par défaut, `dddd D MMMM YYYY` pour « mardi 29 septembre 2026 », heures avec `HH:mm`, texte fixe entre crochets.
- Tableaux Markdown : Tab et Shift+Tab passent d'une cellule à l'autre (la cellule est sélectionnée) en alignant les colonnes selon `:--`, `:-:`, `--:` ; Tab après la dernière cellule ajoute une ligne. Commandes Édition > Aligner le tableau et Insérer un tableau. Réglage `markdownTables.enabled`.
- Menu Texte : MAJUSCULES (Ctrl+Shift+U), minuscules (Ctrl+U), Majuscule À Chaque Mot (Leader U), Majuscule en début de phrase (Leader Shift+U), sur la sélection ou le mot sous le curseur ; trier les lignes (A à Z, Z à A, accents et casse ignorés), supprimer les lignes en double (les lignes vides restent), supprimer les espaces en fin de ligne, joindre les lignes.
- Sélection rapide : Ctrl+L sélectionne la ligne puis ajoute la suivante à chaque appui, Ctrl+Shift+L retire la dernière, Leader L sélectionne la cascade (puis le paragraphe).
- Menu Aller : aller à la ligne (Ctrl+G), début et fin du fichier (Ctrl+Début, Ctrl+Fin), signets (Ctrl+F2 pour poser ou retirer, F2 et Shift+F2 pour passer de l'un à l'autre, liste des signets), marqués d'un point dans la marge.
- Recherche dans le fichier (Ctrl+F) : panneau en haut de l'éditeur, en français, avec un compteur « 3 sur 12 ». Les textes propres à CodeMirror (aller à la ligne, repli…) sont aussi traduits.
- Lignes modifiées depuis le dernier enregistrement, marquées dans la marge comme dans Notepad++ : vert pour une ligne ajoutée, orange pour une ligne modifiée, rouge là où des lignes ont été supprimées ; les marques disparaissent à l'enregistrement. Couleurs de thème `change-added`, `change-modified`, `change-deleted`. Réglage `changeMarkers.enabled`.
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
