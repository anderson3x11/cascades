# Feuille de route après la 0.3

Proposition du 29/09/2026, validée (réponses aux questions en fin de fichier). Elle regroupe ce qui reste du brief, les notes prises pendant les tests de la 0.3 et quelques idées en plus. Comme pour les jalons précédents, chaque jalon est découpé en étapes testables une par une, et rien n'est codé avant validation du plan détaillé.

## 0.4a : édition de texte

Les outils du quotidien d'un bloc-notes, dans l'esprit de Notepad++. Tout passe par des commandes, donc tout est remappable et visible dans la palette.

**Casse du texte sélectionné** (menu Édition > Casse)

- MAJUSCULES, minuscules
- Majuscule À Chaque Mot
- Majuscule en début de phrase
- Raccourcis proposés : Ctrl+Shift+U (majuscules) et Ctrl+U (minuscules), comme Notepad++ ; les deux autres par la palette ou un raccourci Leader.

**Sélection rapide**

- Sélectionner la ligne (Ctrl+L) ; chaque nouvel appui ajoute la ligne suivante.
- Retirer la dernière ligne ajoutée (Ctrl+Shift+L, à valider).
- Sélectionner le paragraphe (le bloc entre deux lignes vides, ou la cascade entière).

**Se déplacer**

- Haut et bas du fichier : Ctrl+Début et Ctrl+Fin existent déjà ; à ajouter au menu et à la page Raccourcis pour qu'on les trouve.
- Aller à la ligne (Ctrl+G).
- Signets : poser un signet sur une ligne, aller au suivant ou au précédent, liste des signets du fichier.

**Recherche dans le fichier** (Ctrl+F)

- Panneau traduit en français et plus visible, compteur « 3 sur 12 », toutes les occurrences surlignées.

**Lignes modifiées depuis le dernier enregistrement**

- Une barre de couleur dans la marge, comme Notepad++ : vert pour une ligne ajoutée, orange pour une ligne modifiée, un repère pour les lignes supprimées. Elle disparaît à l'enregistrement.

**Outils sur les lignes** (menu Édition > Lignes)

- Trier les lignes (A à Z, Z à A, sans tenir compte des accents ni de la casse).
- Supprimer les lignes en double.
- Supprimer les espaces en fin de ligne (aussi possible automatiquement à l'enregistrement, réglage).
- Joindre les lignes sélectionnées.

**Écriture**

- Correcteur orthographique en interrupteur : F7 l'active ou le désactive (désactivé par défaut, choix retenu) ; fautes soulignées, suggestions au clic droit.
- Page d'accueil quand aucun fichier n'est ouvert : fichiers récents, dossiers, raccourcis de base, « Nouveau fichier ».

## 0.4b : fichiers et performances (fin du brief)

- **Encodage** : cliquer sur l'encodage dans la barre d'état pour « Rouvrir avec un autre encodage » (un fichier Latin-1 mal deviné) ou « Convertir en… » (UTF-8, UTF-8 BOM, UTF-16, Latin-1).
- **Fins de ligne** : cliquer sur LF ou CRLF pour convertir.
- **Langage** : détection par le contenu quand l'extension ne dit rien (`#!/bin/bash`, `<?xml`, `<!doctype html>`), et choix manuel en cliquant sur le langage dans la barre d'état.
- **Gros fichiers** (plus de 50 Mo) : mode allégé sans coloration ni cascades, lecture progressive, bandeau qui l'explique.
- **Mesures** : temps de démarrage (objectif moins d'une seconde) et taille installée (objectif moins de 20 Mo), puis optimisations si besoin.
- Minimap : non prévue, sauf demande (peu utile pour des notes).

## 0.5 : langues et identité

- **Traduction** : réunir tous les textes de l'interface dans des fichiers de langue (français, anglais), réglage de langue, langue du système par défaut. Anglais complet à 100 %, les autres langues ensuite par contribution.
- **Logo** : icône de l'app, favicon du site, image pour le README. Je peux proposer plusieurs pistes en SVG autour du motif des cascades (branches, flèches, chute d'eau stylisée).
- **Documentation** : README en anglais et en français, avec des captures et un GIF des cascades.

## 1.0 : plugins et publication

**Plugins** (fin de l'architecture prévue dans le brief)

- Un plugin est un dossier avec un `manifest.json` (nom, version, auteur, permissions) et un module JS, dans le dossier de config.
- Page « Extensions » dans les Préférences : liste, activer, désactiver, ouvrir le dossier.
- Permissions déclarées (fichiers, réseau) demandées à l'activation.
- Documentation de l'API dans `docs/`, générée en partie depuis les types de `src/api`.
- 2 plugins d'exemple, par exemple « Compteur de temps d'écriture » et « Insérer un modèle de note ».

**Publication**

- Passe macOS et Linux : Cmd à la place de Ctrl, chemins, corbeille, menus natifs.
- Installeurs Windows, macOS et Linux construits par la CI GitHub Actions à chaque version.
- **Mises à jour intégrées** : l'app vérifie les nouvelles versions publiées sur GitHub, propose « Mettre à jour », télécharge et redémarre. Les versions sont signées avec notre clé. Sur Windows, un certificat de signature (payant) évite l'avertissement « Windows a protégé votre ordinateur » ; on peut commencer sans.

**Open source et site**

- Les deux dépôts (app et site) sont créés sur GitHub. Reste pour l'app : licence MIT, CONTRIBUTING, modèles d'issues, étiquettes « bon premier ticket ».
- Le dépôt du site, hébergé gratuitement sur GitHub Pages :
  - page d'accueil avec présentation, captures et bouton de téléchargement (le bon installeur selon le système) ;
  - wiki des raccourcis, commandes et réglages, **généré depuis l'app** pour rester toujours à jour ;
  - guide des cascades, de la configuration (`settings.json`, `keybindings.json`, thèmes) et des plugins ;
  - notes de version.

## Décisions (30/09/2026)

1. Raccourcis de casse et de sélection : validés tels quels.
2. Correcteur orthographique : en interrupteur avec un raccourci (F7), dès la 0.4a.
3. Objectif de mots et comparaison de fichiers : abandonnés.
4. Ordre : 0.4a puis 0.4b.
5. Logo : à voir en 0.5.

## 1.1 : refonte du design (inspirée de Word-Smith)

Décidé le 09/10/2026 après la vidéo de Word-Smith : refonte complète, l'interface s'efface derrière le texte. Fonctionnalités retenues : marqueurs invisibles et choix de police. Le thème suit toujours le système.

**1.1a Fondations visuelles**

- L'interface prend le fond de l'éditeur : plus de bandeaux gris ni de bordures, texte de l'interface en gris discret, un seul accent (violet), curseur coloré, popovers arrondis avec une ombre douce.
- Palette claire légèrement chaude, palette sombre adoucie.
- Nouveaux thèmes : Catppuccin (Latte et Mocha), Rosé Pine, Dracula, Tokyo Night, Everforest, One Light.

**1.1b Barre de titre unique**

- Les onglets montent dans la barre de titre : bouton menu à gauche, onglets, zone de déplacement, boutons réduire / agrandir / fermer à droite. Double-clic pour agrandir.
- Windows d'abord ; macOS garde ses feux tricolores (barre en overlay), Linux sans décorations. À vérifier par la CI et par toi sur Windows (menu Snap au survol de « agrandir »).

**1.1c Menus**

- Plus de barre de menu par défaut. Le bouton menu ouvre un popover avec Fichier, Édition, Texte, Aller, Affichage en sous-menus, au clavier aussi.
- Alt affiche la barre classique le temps d'un choix. Le réglage `workbench.showMenuBar` la remet en permanence.

**1.1d Barre d'état à popovers**

- À gauche le nom du fichier, au centre des boutons icône + mot qui ouvrent un popover au-dessus : **Affichage** (zen, retour à la ligne, numéros de ligne, cascades, marqueurs), **Police**, **Thème** (aperçu au survol). À droite, en discret : mots, position, langage, encodage, fin de ligne.
- Les extensions et plugins peuvent ajouter leurs propres popovers (`ctx.statusBar`).

**1.1e Marqueurs et polices**

- Marqueurs : espaces, tabulations, fins de ligne, chacun activable (popover Affichage et réglages).
- Polices : les polices déjà installées parmi une liste connue (Cascadia, Consolas, JetBrains Mono, Georgia…). Aperçu au survol, clic pour choisir. Embarquer des polices libres (OFL) reste possible plus tard : il faut les télécharger, donc ton accord.

État (09/10/2026) : 1.1a à 1.1e faits, à tester dans l'app (surtout la barre de titre et les boutons de fenêtre sur Windows).
