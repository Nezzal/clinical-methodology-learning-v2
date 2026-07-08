---
name: clinical-protocol-auditor
description: Audite et valide des protocoles cliniques selon les exigences méthodologiques du guide RECIF et de la réglementation algérienne (Loi 18-11 relative à la santé).
---

# Auditeur de Protocoles Cliniques (RECIF & Loi 18-11)

Ce skill permet à l'agent de structurer, d'évaluer et de rédiger des fonctionnalités ou du contenu en stricte conformité avec le guide de méthodologie clinique français **RECIF** (Recherche Clinique et Épidémiologique : Conception, Rédaction, Faisabilité) et les contraintes réglementaires de la **Loi algérienne n° 18-11 relative à la santé**.

---

## 📌 1. Structure Méthodologique Obligatoire (Normes RECIF)

Chaque fois que vous concevez ou auditez un protocole clinique, vérifiez la présence et la qualité des sections méthodologiques clés suivantes :

1. **Rationnel Scientifique (Justification)** : Clarifier l'état de l'art et pourquoi cette étude est nécessaire.
2. **Objectif Principal & Secondaires** : Un seul objectif principal, mesurable et précis. Les objectifs secondaires en découlent directement.
3. **Schéma d'Étude (Design)** :
   *   *Essai contrôlé randomisé* (Gold standard, interventionnel).
   *   *Étude de cohorte* (Observationnel, prospectif ou rétrospectif).
   *   *Étude cas-témoins* (Observationnel, rétrospectif).
   *   *Étude transversale* (Description à un instant $T$).
4. **Critères d'Éligibilité** :
   *   *Critères d'Inclusion* : Définition stricte de la population cible (âge, pathologie, etc.).
   *   *Critères de Non-inclusion* : Contre-indications, impossibilité d'assurer le suivi, refus de participer.
5. **Critères de Jugement (Critères d'évaluation)** :
   *   *Critère principal (critère de jugement principal)* : Unique, objectif, directement relié à l'objectif principal.
   *   *Critères secondaires* : Liés aux objectifs secondaires (tolérance, critères secondaires d'efficacité).
6. **Nombre de Sujets Nécessaires (NSN)** :
   *   Calcul statistique justifié basé sur : le risque de première espèce $\alpha$ (généralement 5%), la puissance $1-\beta$ (généralement 80% ou 90%), et la différence clinique minimale attendue.
7. **Méthode d'Analyse Statistique** : Tests statistiques envisagés (Student, Chi-2, modèle de Cox, ANOVA) selon le type de variables (quantitatives, qualitatives).

---

## 🇩🇿 2. Exigences Réglementaires Algériennes (Loi n° 18-11)

Toute étude menée en Algérie doit être auditée sous le prisme de la Loi 18-11 relative à la santé, notamment les sections sur la recherche clinique :

*   **Comité d'Éthique Obligatoire** : Aucun protocole ne peut débuter sans l'avis favorable d'un Comité d'Éthique indépendant agréé par le Ministère de la Santé.
*   **Autorisation Ministérielle** : La conduite des essais cliniques (notamment interventionnels) nécessite l'accord formel du Ministère de la Santé algérien.
*   **Consentement Éclairé Exprès** :
    *   Le participant (ou son représentant légal) doit recevoir une note d'information claire en langue compréhensible (Arabe/Français).
    *   Le consentement doit être **libre, éclairé, exprès et écrit** (signé et daté).
*   **Assurance Promoteur** : Obligation pour le promoteur de l'étude de souscrire une assurance de responsabilité civile couvrant tous les risques pour les participants.
*   **Protection des Populations Vulnérables** :
    *   Recherches interdites sur les mineurs, femmes enceintes ou allaitantes, personnes privées de liberté, sauf s'il y a un bénéfice direct attendu pour leur santé ET que la recherche ne peut être menée sur d'autres populations.

---

## 🛠️ 3. Directives pour l'Agent Antigravity

Lorsque l'utilisateur vous confie une tâche d'ingénierie, de développement ou de rédaction sur le générateur de protocole, appliquez ces restaurations :

1.  **Champs Requis** : Assurez-vous que l'application Next.js (`/app/protocole`) dispose toujours de champs de saisie pour le consentement éclairé, la saisine du comité d'éthique algérien, et la description de la population vulnérable.
2.  **Validation des Saisies** : Proposez des alertes ou des conseils interactifs à l'utilisateur si les sections réglementaires clés (Consentement, Comité d'Éthique) sont laissées vides dans le générateur.
3.  **Citations Précises** : Pour les réponses générées par l'IA dans l'application, formatez les citations réglementaires sous la forme `[Loi 18-11, Art. X]` pour renforcer la crédibilité juridique.
