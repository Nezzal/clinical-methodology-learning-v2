---
name: security-packaging-recif
description: À activer lors des modifications de scripts de build (npm run build, zip, electron:package) ou de la gestion des clés secrètes.
---

# Garde-Fou Sécurité & Packaging RECIF

Ce skill sert de garde-fou de sécurité pour empêcher la fuite accidentelle de clés de production sensibles (clés API OpenRouter, configurations SMTP, clés privées de Firebase Admin SDK) lors de la génération des builds, de l'archivage de distribution (ZIP) ou du packaging de l'application de bureau Electron.

---

## 🔒 1. Gestion des Variables d'Environnement

*   **Zéro Clé en Clair dans le Code** : Toutes les clés d'accès (APIs, Firebase, Mailer) doivent exclusivement transiter par des variables d'environnement lues via `process.env`.
*   **Fichier `.env.local`** : Ce fichier contient les vrais secrets de production. Il est personnel à la machine locale de développement. **Il ne doit sous aucun prétexte être commité sur Git ou inclus dans un package de distribution.**
*   **Gabarit `.env.example`** : Chaque fois qu'une nouvelle variable d'environnement est requise par l'application :
    1.  Ajoutez-la dans `.env.example` avec une valeur fictive de démonstration (`PLACEHOLDER`).
    2.  Documentez son utilité dans le README.md si nécessaire.

---

## 📦 2. Archive ZIP de Distribution Sécurisée

Le script `"zip"` de `package.json` utilise la commande système `zip -r` pour générer une archive minimale et sécurisée :
```bash
npm run zip
```
*   **Règle d'Exclusion Stricte** : La commande doit toujours exclure explicitement les dossiers de build, les environnements virtuels et les fichiers contenant des clés secrètes :
    ```bash
    -x "node_modules/*" ".next/*" ".git/*" ".env*" "clinical-methodology-learning.zip" "dist/*" "out/*" ".venv/*"
    ```
*   **Vérification de Modification** : Si vous êtes amené à modifier le script `"zip"` dans `package.json`, veillez à ce que l'option `-x ".env*"` (avec l'astérisque) soit conservée afin de bloquer l'archivage de `.env`, `.env.local`, `.env.production`, etc.

---

## 💻 3. Packaging Electron (Fichiers ASAR)

Lorsque l'application est packagée sous forme d'exécutable (`.exe` ou `.app`) via `electron-builder` :
*   **Configuration de l'ASAR** : La section `build` de `package.json` spécifie les fichiers inclus dans l'exécutable final.
*   **Exclusion des Secrets** : Vérifiez que les fichiers `.env` ou `.env.local` ne figurent **jamais** dans le tableau `"files"` ou dans la configuration globale d'export d'Electron. L'application Electron doit s'appuyer sur des variables injectées au runtime ou sur un mode hors-ligne sans clés distantes.

---

## 🛠️ 4. Directives pour l'Agent Antigravity

Avant d'exécuter des modifications sur `package.json`, `next.config.js`, ou les fichiers de build dans `scripts/` :
1.  **Scanner les Secrets** : Assurez-vous qu'aucun jeton d'API en clair n'est introduit dans le code source de l'application.
2.  **Audit de Gitignore** : Vérifiez que `.gitignore` contient bien les exceptions et les blocages appropriés (par exemple `.env*` ignoré, sauf `!.env.example`).
3.  **Vérification post-build** : Après modification des scripts de build, exécutez un test de compilation (`npm run build`) pour confirmer que les variables d'environnement sont correctement détectées et sécurisées.

---

## 🚀 5. Procédure Automatique Système : Modifications & Release en 2 Étapes (Validation Mac)

Lors de chaque modification de code, correctif de bug ou évolution de fonctionnalité :

### ⏸️ Étape 1 : Préparation & Build macOS (Pause pour Validation)
1. **Incrémentation de Version** : Monter systématiquement la version dans `package.json` et dans `src/utils/constants.ts` (ex: `2.0.3`).
2. **Mise à jour des liens du Guide** : Adapter les URLs de téléchargement direct de la page Guide ([`src/app/guide/page.tsx`](file:///Users/mac/Sites/clinical-methodology-learning-v2/src/app/guide/page.tsx)) avec le nouveau tag de release (`vX.Y.Z`).
3. **Build macOS uniquement** : Générer le paquet macOS via `npm run electron:package:mac`.
4. **PAUSE OBLIGATOIRE** : S'arrêter et demander à l'utilisateur de tester et valider l'application Mac ([`dist/mac-arm64/RECIF-MethodoClinique.app`](file:///Users/mac/Sites/clinical-methodology-learning-v2/dist/mac-arm64)).

### ▶️ Étape 2 : Finalisation de la Release (Après Validation de l'Utilisateur)
5. **Builds Windows & Linux** :
   - Windows : `npx electron-builder build --win --publish never`
   - Linux : `npm run electron:package:linux`
6. **Archive de Distribution ZIP** : Exécuter `npm run zip` pour renouveler `clinical-methodology-learning.zip`.
7. **Cycle Git Complet** :
   - Stager les fichiers modifiés (`git add .`).
   - Commiter avec un message explicite (`git commit -m "release: ..."`).
   - Créer le tag Git (`git tag -a vX.Y.Z -m "Release vX.Y.Z"`).
   - Pousser la branche et les tags vers GitHub (`git push origin <branch> --tags`).

