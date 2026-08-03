<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Directives Systématiques de Modifications & Release RECIF (Workflow en 2 Étapes)

À chaque fois que vous effectuez des modifications de code ou des correctifs dans l'application :

### ⏸️ Étape 1 : Préparation & Build macOS (Pause pour Validation)
1. **Montée de version** : Incrémentez la version dans `package.json` et `src/utils/constants.ts` (`APP_VERSION`).
2. **Mise à jour des liens du Guide** : Ajustez les URLs de téléchargement dans `src/app/guide/page.tsx` avec le nouveau tag (`vX.Y.Z`).
3. **Build Electron macOS** : Générez uniquement le livrable macOS (`npm run electron:package:mac`).
4. **PAUSE OBLIGATOIRE** : Demandez à l'utilisateur de tester et valider l'application Mac (`dist/mac-arm64/RECIF-MethodoClinique.app`) avant de continuer.

### ▶️ Étape 2 : Finalisation Automatique en Chaîne (Après Validation de l'Utilisateur)
*Règle d'exécution : Dès validation du Mac par l'utilisateur, l'agent enchaîne TOUTES les sous-étapes ci-dessous d'une seule traite sans s'arrêter.*

5. **Builds Windows & Linux** : Générez les livrables Windows (`npx electron-builder build --win --publish never`) et Linux (`npm run electron:package:linux`).
6. **Archive ZIP** : Exécutez `npm run zip` pour actualiser `clinical-methodology-learning.zip`.
7. **Cycle Git Obligatoire** :
   - `git add .`
   - `git commit -m "release: ..."`
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
   - `git push origin <branch> --tags`

