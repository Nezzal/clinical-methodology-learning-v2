# Plateforme de Formation en Méthodologie de Recherche Clinique (RECIF)

Cette application est un tuteur virtuel et un outil d'accompagnement à la rédaction de protocoles cliniques basé sur le manuel de référence français **RECIF** (Recherche Clinique et Épidémiologique : Conception, Rédaction, Faisabilité) et la réglementation algérienne (**Loi n° 18-11** relative à la santé).

---

## 📡 Les 3 Modes de Fonctionnement (Résilience Hors-ligne)

L'application a été conçue pour fonctionner dans toutes les conditions, y compris dans les hôpitaux ou laboratoires sans connexion internet. Elle s'adapte automatiquement selon 3 modes :

### 1. Mode "Zéro Configuration" (100% Hors-ligne - Aucun prérequis)
* **Pour qui** : Les utilisateurs qui veulent lancer l'application immédiatement sans rien installer d'autre.
* **Fonctionnement** : En l'absence de clé API Gemini ou d'Ollama actif, l'application utilise sa base de connaissances intégrée (Glossaire expert, Loi 18-11, extraits ciblés du livre). Le tuteur répond instantanément par des fiches méthodologiques et des extraits précis.

### 2. Mode "IA Locale Avancée" (100% Hors-ligne - Avec Ollama)
* **Pour qui** : Les utilisateurs voulant une IA locale intelligente capable de reformuler et de synthétiser les extraits du livre sans internet.
* **Fonctionnement** : Nécessite l'installation d'Ollama sur la machine (voir section ci-dessous). L'application détecte automatiquement le modèle de chat disponible (comme `gemma4:latest`, `qwen2.5` ou `mistral`) et l'interroge en local.

### 3. Mode "IA Connectée Cloud" (En ligne - Avec clé API Gemini)
* **Pour qui** : Les utilisateurs disposant d'une connexion internet et voulant la puissance maximale de l'IA (Gemini 2.5 Flash) avec RAG vectoriel en temps réel.
* **Fonctionnement** : Il suffit de renseigner la variable `GEMINI_API_KEY` dans le fichier `.env.local`.

---

## 🛠️ Installation & Lancement

### Prérequis
- [Node.js](https://nodejs.org/) (Version 18 ou supérieure) installé sur la machine.

### Étape 1 : Extraire l'application
Dézippez le dossier de l'application sur la machine cible.

### Étape 2 : Lancer l'application
1. Ouvrez un terminal dans le dossier de l'application.
2. Démarrez le serveur local :
   ```bash
   npm run dev
   ```
3. Ouvrez votre navigateur sur : [http://localhost:3001](http://localhost:3001)

---

## 🤖 Guide d'installation d'Ollama (Pour le Mode IA Locale)

Si un utilisateur souhaite bénéficier de la reformulation par IA sans internet, voici la procédure rapide à lui transmettre :

1. **Télécharger Ollama** : Allez sur [ollama.com](https://ollama.com/) et installez l'application (disponible pour Mac, Windows et Linux).
2. **Télécharger un modèle** : Ouvrez un terminal sur votre ordinateur et tapez la commande suivante pour récupérer le modèle Gemma 4 (ou tout autre modèle de chat comme `qwen2.5:7b` ou `mistral`) :
   ```bash
   ollama run gemma4:latest
   ```
3. **C'est tout !** L'application Next.js détectera automatiquement Ollama en tâche de fond sur `http://127.0.0.1:11434` et l'utilisera pour alimenter le tuteur virtuel hors-ligne.

---

## 📦 Distribution et Déploiement

### Option A : Archive ZIP (Recommandé pour un usage local simple)
Vous pouvez compresser le dossier complet de l'application (en excluant les dossiers `.next` et `node_modules` pour réduire la taille à moins de 5 Mo) et le fournir à vos collègues. Ils n'auront qu'à exécuter `npm install` puis `npm run dev` pour la lancer.

### Option B : Application de bureau (Format .exe / .app)
Si vous souhaitez packager l'application pour qu'elle s'exécute comme un double-clic traditionnel sans passer par la ligne de commande, vous pouvez l'envelopper avec **Electron** ou **Tauri**.
*(Note : Il est déconseillé de packager les 5 Go du modèle d'IA dans l'exécutable pour éviter un fichier trop lourd. Il est préférable de laisser l'utilisateur installer Ollama séparément).*
