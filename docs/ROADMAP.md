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
