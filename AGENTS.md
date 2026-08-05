<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Directives Systématiques de Modifications, Déploiement Web & Release RECIF (Workflow Agilité & Sécurité)

À chaque fois que vous effectuez des modifications de code ou des correctifs dans l'application :

### 🚀 Étape 1 : Développement Local & Validation Développeur
1. **Validation Dev & Localhost** : Tester et valider les modifications localement sur `http://localhost:3001` ou via `npm run electron:dev`.
2. **Montée de version** : Incrémenter la version dans `package.json` et `src/utils/constants.ts` (`APP_VERSION`).
3. **Mise à jour des liens du Guide** : Ajuster les URLs de téléchargement dans `src/app/guide/page.tsx` avec le nouveau tag (`vX.Y.Z`).

### 🌐 Étape 2 : Déploiement Web / Vercel & Validation PWA / Mobile
4. **Git Commit & Push Web** :
   - `git add .`
   - `git commit -m "feat/fix: ..."`
   - `git push origin <branch>` (déploie automatiquement l'application sur Vercel pour l'accès Web et Smartphone/PWA).
5. **PAUSE & SIGNAL SONORE (Validation Web/Mobile)** : Émettre une notification sonore système (`afplay /System/Library/Sounds/Glass.aiff` ou `say "Déploiement Web prêt"`) et demander à l'utilisateur de tester/valider l'application Web / PWA Mobile.

### 📦 Étape 3 : Packaging Desktop & Release Globale (Après Validation Web)
*Dès réception de la validation de la version Web/Mobile par l'utilisateur, exécuter d'une seule traite :*
6. **Builds Desktop Natifs (Mac, Windows, Linux)** :
   - Mac : `npm run electron:package:mac`
   - Windows : `npx electron-builder build --win --publish never`
   - Linux : `npm run electron:package:linux`
7. **Archive ZIP** : Exécuter `npm run zip` pour actualiser `clinical-methodology-learning.zip`.
8. **Tag Release & Push Tags** :
   - `git add .`
   - `git commit -m "release: vX.Y.Z"` (si nécessaire)
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
   - `git push origin <branch> --tags`

