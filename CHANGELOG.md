# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Noyau : registre de commandes, résolveur de raccourcis (séquences, conditions `when`), settings en couches (défauts, utilisateur, par langage), registre de menus, bus d'événements, hôte d'extensions.
- API d'extensions (`src/api`), utilisée par toutes les fonctionnalités internes.
- Barre de menus Fichier, Édition, Affichage, alimentée par les extensions via `ctx.menus`, avec le raccourci de chaque commande.
- Onglets : nouveau (bouton +), ouvrir, enregistrer, enregistrer sous, fermer (avec confirmation), rouvrir le dernier fermé, réorganisation par glisser-déposer.
- Barre d'état : position, sélection, mots, caractères, langage, encodage, fin de ligne.
- Cascades : connecteurs entre chaque ligne indentée et sa ligne parente, dessinés en surimpression (le fichier n'est pas modifié), avec 4 styles, une couleur par profondeur, la mise en valeur de la branche active et le repli par cascade. Actives pour `.txt`, `.md` et les fichiers sans extension.
- Listes intelligentes : continuation et sortie de liste avec Entrée, changement de niveau avec Tab et Shift+Tab, renumérotation automatique (annulable en un seul Ctrl+Z), Ctrl+Entrée pour cocher une tâche. Chaque comportement est désactivable.
- Restauration de session : onglets, curseur, scroll et texte non enregistré sont restaurés au démarrage. Fermer la fenêtre ne demande plus de confirmation.
- Sauvegarde automatique optionnelle (`files.autoSave`).
- Détection des modifications externes : rechargement automatique d'un onglet sans modification en cours, sinon un bandeau propose de fusionner (fusion à trois voies, comme git), de garder sa version ou de prendre celle du disque, et avertissement si le fichier est supprimé.
- Conflits : les blocs `<<<<<<<` / `=======` / `>>>>>>>` (issus d'une fusion ou de git) sont colorés, avec les boutons « Garder la mienne », « Garder celle du disque » et « Garder les deux ».
- Repli : chevron plus grand, étiquette « ⋯ N lignes ».
- Onglets : l'onglet glissé se détache et les autres se décalent en douceur.
- Glisser-déposer de fichiers dans la fenêtre pour les ouvrir.
- API : `ctx.banners`, `ctx.configFiles`, `ctx.app.onWillQuit`, `ctx.fs.watch`.
- Palettes claire et sombre qui suivent le thème du système, y compris la coloration syntaxique.
- Entrée conserve l'indentation exacte de la ligne (tabulations comprises).
- Lecture et écriture avec détection d'encodage (UTF-8, UTF-8 BOM, UTF-16, Latin-1 et autres), de fins de ligne et de fichiers binaires.
- Extension `.txt` proposée par défaut à l'enregistrement (réglage `files.defaultExtension`).
- Chargement de `settings.json` et `init.js` depuis le dossier de config, avec mode portable.
- CI GitHub Actions (lint, tests, build Windows, macOS, Linux).

### Corrigé

- La réorganisation des onglets par glisser ne fonctionnait pas dans l'application (le glisser-déposer natif est réservé aux fichiers sous Windows).
- Le pointeur de la souris restait invisible dans les dialogues ouverts après avoir tapé du texte (option Windows « Masquer le pointeur pendant la frappe »).
