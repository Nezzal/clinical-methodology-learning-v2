---
name: electron-nextjs-offline
description: À utiliser lors de la modification de code Next.js/Electron lié à la connectivité, au build standalone, ou aux requêtes API (Firebase, Ollama, OpenRouter).
---

# Next.js + Electron Offline-First

Ce skill contient des directives d'architecture et de codage pour garantir la résilience hors-ligne (Offline-First) de la plateforme hybride Next.js enveloppée dans Electron, exploitant à la fois Firebase (Cloud), OpenRouter (IA Cloud), Ollama (IA Locale) et une base de connaissances locale (RAG vectoriel embarqué).

---

## 📡 1. Gestion Hybride du Moteur d'IA (Régime de Résilience)

L'application s'adapte dynamiquement selon 3 modes de connectivité réseau. Le code doit toujours prévoir ces trois scénarios :

1.  **Mode Cloud (En ligne)** :
    *   Connexion internet disponible + Clé `OPENROUTER_API_KEY` configurée.
    *   L'application interroge OpenRouter (Qwen / GLM) avec RAG vectoriel complet.
2.  **Mode IA Locale (Hors-ligne / Ollama)** :
    *   Pas d'internet ou pas de clé API Cloud, mais **Ollama** est actif en tâche de fond sur `http://127.0.0.1:11434`.
    *   L'application doit détecter les modèles locaux disponibles (`/api/ollama-tags`) et interroger le modèle local sélectionné (ex. `gemma4:latest` ou `qwen2.5`) avec RAG local.
3.  **Mode Zéro Configuration (100% Hors-ligne / Embarqué)** :
    *   Ni internet, ni Ollama disponible.
    *   Le tuteur ne doit pas crasher. Il doit automatiquement basculer sur les réponses de la base de connaissances embarquée (fiches méthodologiques statiques, glossaire expert RECIF, Loi 18-11).

---

## 💾 2. Résilience Firebase & Gestion des Erreurs Réseau

Firebase Auth et Firestore sont par nature des outils Cloud qui peuvent échouer en cas d'absence de réseau ou de mauvaise configuration locale :
*   **Mode Invité Local (Guest Mode)** : L'application doit permettre aux utilisateurs de sauter l'étape de connexion Firebase si aucun réseau n'est détecté, et de travailler en mode invité avec sauvegarde locale (`localStorage`).
*   **Captation des Erreurs d'Initialisation** : L'initialisation du SDK Firebase Client ou Firebase Admin ne doit jamais lever d'exceptions fatales bloquant le chargement des pages. Les appels Firestore doivent être enveloppés dans des blocs `try/catch` avec repli sur `localStorage`.

---

## 📦 3. Packaging Standalone & Chemins Relatifs (Electron)

Le build Next.js s'exécute en mode `standalone` pour être enveloppé dans Electron :
*   **Copie des Assets** : Le script de build `electron:build` (`npm run build && node scripts/copy-standalone-assets.js`) doit toujours regrouper et copier les fichiers statiques de `.next/static` et du dossier `public/` dans le dossier standalone final pour qu'ils soient correctement chargés localement par Electron.
*   **Accès aux Fichiers** : Utilisez des chemins d'accès robustes pour lire les fichiers locaux (ex. bases de connaissances, embeddings, fichiers de configuration). Privilégiez `path.join(process.cwd(), ...)` pour éviter les résolutions de chemins erronées à l'intérieur de l'archive ASAR d'Electron.

---

## 🛠️ 4. Directives pour l'Agent Antigravity

Lorsque vous intervenez sur du code lié aux appels API ou au cycle de vie d'une discussion :
1.  **Tester la Connectivité** : Avant d'exécuter des requêtes réseau distantes sur le client, utilisez des vérifications de type `navigator.onLine` ou captez proprement les rejets de `fetch`.
2.  **Fallback de Données** : Assurez-vous que chaque composant dynamique (statistiques, historique des chats, profils) dispose d'une alternative de rendu locale (`localStorage` ou valeurs par défaut) utilisable immédiatement en mode hors-ligne.
3.  **Messages d'Erreur Conviviaux** : Présentez toujours des messages d'erreur clairs et didactiques à l'utilisateur (ex. "Moteur d'IA locale Ollama non détecté, basculement automatique sur la base de connaissances intégrée").
