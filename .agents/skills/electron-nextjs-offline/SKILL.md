---
name: electron-nextjs-offline
description: Activates when modifying Next.js standalone builds, Electron main-process packaging, offline resilience, local Ollama fallbacks, or Firebase cache/offline storage.
---

# Guide de Développement Next.js + Electron Offline-First

Ce guide de compétence vous aide à maintenir la résilience hors-ligne et le packaging correct de l'application RECIF.

## 1. Résilience Réseau & Modèles Hybrides

L'application doit basculer de manière transparente entre le Cloud et le local.

### Règle d'or de la connectivité client
Ne supposez jamais qu'une requête d'API en ligne (OpenRouter, Firebase) réussira. Utilisez toujours un bloc `try/catch` avec une stratégie de repli (fallback) :
1. **Priorité 1 :** Si en ligne + clé présente -> interroger le modèle distant (Gemini/OpenRouter).
2. **Priorité 2 :** Si en ligne/hors-ligne + Ollama actif -> interroger le modèle local (`http://127.0.0.1:11434`).
3. **Priorité 3 :** Si 100% hors-ligne + pas d'Ollama -> utiliser la base de connaissances statique locale.

### Persistence Locale (Offline-first)
* Utilisez toujours les méthodes de `@/utils/storage` (qui s'appuient sur le `localStorage`) en complément des appels Firestore.
* Lors d'une modification des données, mettez à jour le `localStorage` immédiatement pour que l'utilisateur ne perde pas sa progression même s'il n'est pas connecté à Internet.
* Utilisez l'événement personnalisé `progress_changed` pour notifier les autres composants des changements de statistiques locales.

---

## 2. Intégration d'Ollama en Local
* Le serveur Ollama par défaut écoute sur `http://127.0.0.1:11434`.
* Toujours valider la disponibilité d'Ollama via un ping léger (ex: `GET http://127.0.0.1:11434/api/tags`) avant de l'appeler pour éviter des timeouts bloquant l'interface utilisateur.

---

## 3. Configuration Electron & Next.js Standalone

Le build Next.js est compilé via `output: 'standalone'` pour être exécuté par le process principal d'Electron (`electron-main.js`).

### Gestion des Chemins (Paths)
* Dans le process principal d'Electron (`electron-main.js`), utilisez des chemins relatifs résolus dynamiquement avec `path.join(__dirname, ...)` ou `app.getAppPath()`.
* **Important :** Ne jamais coder de chemins absolus en dur (hardcoded), car ils diffèrent après le packaging (`electron-builder`).

### Cycle de vie du serveur Next.js dans Electron
1. Démarrer le serveur Next.js en arrière-plan en tant que `child_process` (via le point d'entrée `server.js` généré par le build standalone).
2. Tenter de charger l'URL locale `http://localhost:3001` (ou port configuré).
3. Gérer les échecs de connexion initiaux avec un mécanisme de tentatives répétées (retries) toutes les 200ms jusqu'à ce que le serveur soit prêt.

---

## 4. Persistance Offline Firebase
Pour que Firestore fonctionne de manière fluide hors-ligne :
* Vérifiez que la persistance est activée côté client avec `enableIndexedDbPersistence(db)`.
* Interceptez proprement les erreurs de type `failed-precondition` (si plusieurs onglets sont ouverts) ou `unimplemented` (si le navigateur ne le supporte pas).
