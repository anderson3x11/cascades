# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Noyau : registre de commandes, résolveur de raccourcis (séquences, conditions `when`), settings en couches (défauts, utilisateur, par langage), registre de menus, bus d'événements, hôte d'extensions.
- API d'extensions (`src/api`), utilisée par toutes les fonctionnalités internes.
- Barre de menus Fichier, Édition, Affichage, alimentée par les extensions via `ctx.menus`, avec le raccourci de chaque commande.
- Onglets : nouveau (bouton +), ouvrir, enregistrer, enregistrer sous, fermer (avec confirmation), rouvrir le dernier fermé, réorganisation par glisser-déposer.
- Barre d'état : position, sélection, mots, caractères, langage, encodage, fin de ligne.
- Palettes claire et sombre qui suivent le thème du système, y compris la coloration syntaxique.
- Entrée conserve l'indentation exacte de la ligne (tabulations comprises).
- Lecture et écriture avec détection d'encodage (UTF-8, UTF-8 BOM, UTF-16, Latin-1 et autres), de fins de ligne et de fichiers binaires.
- Extension `.txt` proposée par défaut à l'enregistrement (réglage `files.defaultExtension`).
- Chargement de `settings.json` et `init.js` depuis le dossier de config, avec mode portable.
- CI GitHub Actions (lint, tests, build Windows, macOS, Linux).

### Corrigé

- Le pointeur de la souris restait invisible dans les dialogues ouverts après avoir tapé du texte (option Windows « Masquer le pointeur pendant la frappe »).
