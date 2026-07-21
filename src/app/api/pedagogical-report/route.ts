import { NextResponse } from 'next/server';
import { callLLM } from '@/utils/llm';
import { loadEnvLocal } from '@/utils/env';
import { verifyUserAuth } from '@/utils/firebase-admin';

async function getAvailableOllamaModel(ollamaUrl: string, requestedModel: string): Promise<string | null> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return null;
    const data = await res.json();
    const models = data.models || [];
    if (models.length === 0) return null;

    const hasRequested = models.some((m: any) => m.name === requestedModel || m.name.split(':')[0] === requestedModel.split(':')[0]);
    if (hasRequested) return requestedModel;

    const chatModels = models.filter((m: any) => {
      const name = m.name.toLowerCase();
      return !name.includes('embed') && !name.includes('minilm');
    });

    if (chatModels.length === 0) return null;

    const gemmaModel = chatModels.find((m: any) => m.name.toLowerCase().includes('gemma'));
    if (gemmaModel) return gemmaModel.name;

    return chatModels[0].name;
  } catch (err) {
    console.warn("⚠️ Impossible de lister les modèles Ollama:", err);
    return null;
  }
}

async function tryOllamaGenerateReport(
  prompt: string,
  ollamaUrl: string,
  ollamaModel: string
): Promise<string | null> {
  try {
    console.log(`🤖 [Rapport Pédagogique] Tentative d'appel à Ollama (${ollamaModel}) sur ${ollamaUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { 
            role: 'system', 
            content: "Tu es un conseiller pédagogique et méthodologique expert en recherche clinique RECIF. Tu dois formuler un rapport de suivi personnalisé, constructif et très détaillé en français sous forme de Markdown, d'au moins 400 mots couvrant les 4 sections demandées, sans préambule ni conclusion de type 'Voici votre rapport', et sans utiliser aucun émoji ou émoticône." 
          },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: {
          temperature: 0.6,
          num_predict: 2500,
          num_ctx: 4096
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ Ollama a retourné un statut d'erreur : ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.message?.content || null;
    if (content && content.trim().length >= 300) {
      return content.trim();
    } else {
      console.warn(`⚠️ Réponse d'Ollama trop courte (${content?.length || 0} car.), bascule vers le secours local complet.`);
      return null;
    }
  } catch (error: any) {
    console.warn('⚠️ Échec de la génération locale de rapport par Ollama:', error.message || error);
    return null;
  }
}

function getStaticFallbackReport(
  questionsAsked: number,
  protocolsGenerated: number,
  quizScore: { correct: number; total: number },
  flashcardsMastered: { mastered: number; total: number },
  preferredProvider: string = 'openrouter'
): string {
  const totalQuiz = quizScore.total || 0;
  const correctQuiz = quizScore.correct || 0;
  const quizPct = totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 100) : 0;

  const fcMastered = flashcardsMastered.mastered || 0;
  const fcTotal = flashcardsMastered.total || 12;
  const fcPct = Math.round((fcMastered / fcTotal) * 100);

  let level = "Débutant";
  let focusArea = "Réglementation et Principes Fondamentaux";
  let recommendation = "Nous vous conseillons de continuer à explorer les concepts de base en lisant la section Réglementation Algérienne (Loi 18-11) et de poser davantage de questions à votre Tuteur virtuel.";

  if (quizPct >= 80 && fcPct >= 80) {
    level = "Avancé / Autonome";
    focusArea = "Raisonnement Statistique et Calculs de Taille d'Échantillon";
    recommendation = "Excellent niveau ! Vous maîtrisez les concepts clés. Nous vous suggérons de vous concentrer sur la partie statistique avancée et la conception de protocoles cliniques complexes selon la réglementation algérienne.";
  } else if (quizPct >= 50 || fcPct >= 50 || protocolsGenerated > 0) {
    level = "Intermédiaire";
    focusArea = "Choix des Critères de Jugement et Éligibilité";
    recommendation = "Niveau intermédiaire solide. Travaillez sur la cohérence logique entre votre objectif principal et votre critère de jugement principal. Entraînez-vous avec d'autres thématiques de protocole.";
  }

  const note = preferredProvider === 'ollama'
    ? `*Note : Ce bilan a été généré via notre algorithme local standard car le service local Ollama est injoignable ou le modèle n'est pas chargé. Veuillez lancer l'application Ollama et charger le modèle \`${process.env.OLLAMA_MODEL || 'gemma4:latest'}\`.*`
    : `*Note : Ce bilan a été généré via notre algorithme local standard (clé API non configurée ou indisponible). Vous pouvez configurer votre clé ou activer Ollama localement pour une analyse personnalisée approfondie.*`;

  return `# REPORTING PÉDAGOGIQUE ET BILAN DE SUIVI
*Plateforme d'Apprentissage de la Méthodologie de Recherche Clinique (Manuel RECIF & Loi n° 18-11)*

${note}

---

## 1. Bilan Général de Progression et Positionnement

Votre engagement dans l'apprentissage de la méthodologie de recherche clinique est remarquable, comme en témoigne le volume d'interactions enregistrées avec le tuteur virtuel (${questionsAsked} questions posées) et le nombre de projets de recherche initiés (${protocolsGenerated} protocoles générés). Cette régularité traduit une démarche active d'assimilation des principes fondateurs de la recherche médicale.

Sur la base de l'ensemble de vos activités (réponses aux quiz, entraînement sur flashcards conceptuelles et création de protocoles d'études), votre niveau global de maîtrise méthodologique est actuellement estimé au rang **${level}**. Vos résultats montrent une compréhension progressive de la structuration des projets d'études observationnelles et interventionnelles.

L'analyse de vos parcours de révision indique que vous êtes en phase de consolidation des acquis théoriques. Pour poursuivre votre progression vers l'autonomie complète, il convient de renforcer l'harmonisation entre la question scientifique initiale (framework PICOT/FINE), la rigueur éthique et la justification statistique de la taille de votre échantillon.

---

## 2. Synthèse Détaillée des Compétences Méthodologiques

### 2.1 Schémas d'Étude & Définition de la Population (FINE & PICOT)
* **Formulation de l'hypothèse :** Vous démontrez une bonne capacité à définir le cadre de recherche. Assurez-vous de vérifier systématiquement les 5 critères FINE (Faisable, Intéressant, Novateur, Éthique, Pertinent).
* **Définition PICOT :** La population cible, l'intervention/exposition, le comparateur et le critère de jugement principal doivent toujours s'articuler avec une précision temporelle explicite.
* **Sélection du schéma d'étude :** ${protocolsGenerated > 0 ? 'Vos choix de schémas (cohortes, cas-témoins ou transversales) démontrent une assimilation concrète de la typologie des études observationnelles.' : 'Prenez le temps d\'explorer les différences fondamentales entre études descriptives et étiologiques dans le Manuel RECIF.'}

### 2.2 Réglementation (Loi n° 18-11 relative à la santé) & Éthique
* **Conformité Réglementaire :** Toute recherche sur l'être humain en Algérie doit se conformer strictement aux dispositions des Articles 388 et suivants de la Loi n° 18-11.
* **Considérations Éthiques :** La soumission préalable au Comité d'Éthique de la Recherche (CER) et le recueil du consentement éclairé écrit de chaque participant constituent des préalables indérogeables avant tout début de recueil de données.
* **Protection des Données :** L'anonymisation des cahiers d'observation (CRF) et la confidentialité des informations médicales doivent être garanties tout au long de la conduite du projet.

### 2.3 Calcul du Nombre de Sujets Nécessaires (NSN) & Biais de Recherche
* **Statistique Inférentielle :** Le calcul du NSN repose sur la fixation explicite du risque alpha (généralement 5%), de la puissance 1-béta (généralement 80% ou 90%) et de la taille d'effet cliniquement pertinente.
* **Maîtrise des Biais :** ${quizPct >= 50 ? 'Vos scores aux quiz confirmant une assimilation en cours des biais de sélection, de classement et de confusion.' : 'Révisez les fiches flashcards sur les biais pour apprendre à anticiper les facteurs de confusion au stade du protocole.'}
* **Ajustement & Analyse :** L'anticipation des perdus de vue (majoration usuelle de 10% à 20% du NSN) doit être systématiquement intégrée au chapitre statistique de votre protocole.

---

## 3. Analyse des Acquis (Forces) et des Axes d'Amélioration

### 3.1 Points Forts Identifiés
* **Proactivité & Rigueur :** Assiduité soutenue sur la plateforme avec ${questionsAsked} question(s) méthodologique(s) soumise(s) au tuteur virtuel.
* **Structure de Protocole :** Capacité à utiliser le générateur pour formaliser la logique globale d'une recherche.
* **Assimilation du Vocabulaire :** Validation de ${fcMastered}/${fcTotal} flashcard(s) conceptuelle(s) (${fcPct}% de maîtrise).

### 3.2 Axes de Progrès Prioritaires
* **Orientation statistique :** Approfondir la justification du choix du critère de jugement principal (unique, mesurable, cliniquement pertinent).
* **Rdaction STROBE :** Veiller à ce que la section Méthodes du manuscrit réponde point par point aux 22 critères de la grille internationale STROBE.
* **Standardisation du CRF :** Harmoniser les variables recueillies avec les objectifs secondaires pour éviter les données superflues.

---

## 4. Focus Méthodologique Personnalisé (RECIF & STROBE)

L'analyse de vos activités récentes montre un intérêt particulier pour les sujets liés à : **${focusArea}**.

Pour garantir la valeur scientifique et la publiabilité de vos futurs travaux, nous vous recommandons d'accorder une attention méthodique aux points suivants :
1. **Adéquation de l'objectif principal :** L'objectif principal doit répondre à une seule question claire et être directement traduit par le critère de jugement principal.
2. **Rapprochement épidémiologique :** Dans une étude observationnelle, l'identification précise des facteurs de confusion dès la conception du protocole permet de prévoir les stratifications ou régressions multivariées nécessaires lors de l'analyse des données.
3. **Respect du standard STROBE :** Lors de la rédaction de l'article final, la description du flux des participants (flowchart STROBE) est exigée par tous les journaux médicaux à comité de lecture.

---

## 5. Plan d'Action Opérationnel et Recommandations Pédagogiques

Pour consolider vos connaissances et passer au niveau supérieur, voici votre programme de travail recommandé :

1. **Étape 1 - Révision Théorique (Manuel RECIF) :**
   Consultez le chapitre dédié aux biais et à la réglementation algérienne (Loi 18-11) dans la section Guide de la plateforme.

2. **Étape 2 - Entraînement sur Quiz & Flashcards :**
   Révisez quotidiennement vos cartes mémoire jusqu'à atteindre un taux d'assimilation de 85% sur l'ensemble du paquet.

3. **Étape 3 - Conception Pratique de Protocole :**
   Rédigez un nouveau protocole sur le Générateur en veillant à compléter minutieusement les 23 paramètres requis, notamment la taille d'échantillon et l'analyse statistique.

4. **Étape 4 - Rédaction Scientifique STROBE :**
   Utilisez le module Rédacteur STROBE pour transformer votre projet de protocole en manuscrit prêt pour la soumission.

---
*Ce bilan pédagogique est un outil personnalisé d'accompagnement de la plateforme Methodo&Clinique Édu (RECIF).*
`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => { reject(new Error('TIMEOUT_EXCEEDED')); }, timeoutMs);
  });
  try { return await Promise.race([promise, timeoutPromise]); } finally { clearTimeout(timeoutId); }
}

export async function POST(req: Request) {
  loadEnvLocal();

  // Validation de sécurité (vérification de l'authentification et de la non-suspension)
  const authCheck = await verifyUserAuth(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }
  let questionsAsked = 0;
  let protocolsGenerated = 0;
  let quizScore = { correct: 0, total: 0 };
  let flashcardsMastered = { mastered: 0, total: 0 };
  let recentQuestions: string[] = [];
  let recentProtocols: string[] = [];
  let preferredProvider = 'openrouter';
  let headerOllamaModel: string | null = null;
  let synthetic = false;

  try {
    const data = await req.json();
    questionsAsked = data.questionsAsked ?? 0;
    protocolsGenerated = data.protocolsGenerated ?? 0;
    quizScore = data.quizScore ?? { correct: 0, total: 0 };
    flashcardsMastered = data.flashcardsMastered ?? { mastered: 0, total: 0 };
    recentQuestions = data.recentQuestions ?? [];
    recentProtocols = data.recentProtocols ?? [];
    synthetic = data.synthetic === true;

    const requestHeaders = new Headers(req.headers);
    preferredProvider = requestHeaders.get('x-ai-provider') || 'openrouter';
    headerOllamaModel = requestHeaders.get('x-ollama-model');
    const apiKey = preferredProvider === 'ollama' ? null : process.env.OPENROUTER_API_KEY;

    const totalQuiz = quizScore.total || 0;
    const correctQuiz = quizScore.correct || 0;
    const quizPct = totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 100) : 0;

    const fcMastered = flashcardsMastered.mastered || 0;
    const fcTotal = flashcardsMastered.total || 12;
    const fcPct = Math.round((fcMastered / fcTotal) * 100);

    const prompt = synthetic
      ? `Tu es un conseiller pédagogique et méthodologique expert en recherche clinique RECIF. Tu dois rédiger un bilan synthétique et très concis (sous forme de fiches à puces, maximum 15 lignes en tout) pour un superviseur qui souhaite évaluer rapidement la progression d'un étudiant.
      
Voici les statistiques d'activité de l'étudiant :
- Questions posées au tuteur virtuel : ${questionsAsked}
- Protocoles générés : ${protocolsGenerated}
- Score aux quiz : ${correctQuiz}/${totalQuiz} (${quizPct}%)
- Flashcards maîtrisées : ${fcMastered}/${fcTotal} (${fcPct}%)
- Dernières questions posées : ${recentQuestions.length > 0 ? recentQuestions.join(', ') : 'Aucune'}
- Protocoles initiés : ${recentProtocols.length > 0 ? recentProtocols.join(', ') : 'Aucun'}

Rédige le bilan synthétique en Markdown en le divisant en 3 sections courtes :
1. **Niveau estimé & Résumé de progression** (1 paragraphe court)
2. **Forces & Lacunes constatées** (2-3 puces courtes)
3. **Recommandations prioritaires pour le superviseur** (2-3 recommandations concrètes d'actions)

IMPORTANT : N'utilise absolument aucun émoji ni émoticône dans le rapport.`
      : `Tu es un conseiller pédagogique et méthodologique expert en recherche clinique (manuel RECIF & Loi n° 18-11). Tu dois rédiger un rapport de suivi et bilan de compétences personnalisé, complet, très détaillé et formel d'au moins 4 pages (au moins 1200 mots) pour l'apprenant.

Voici les statistiques d'activité de l'utilisateur :
- Questions posées au tuteur virtuel : ${questionsAsked}
- Protocoles générés : ${protocolsGenerated}
- Score aux quiz : ${correctQuiz}/${totalQuiz} (${quizPct}%)
- Flashcards maîtrisées : ${fcMastered}/${fcTotal} (${fcPct}%)
- Dernières questions posées : ${recentQuestions.length > 0 ? recentQuestions.join(', ') : 'Aucune'}
- Protocoles initiés : ${recentProtocols.length > 0 ? recentProtocols.join(', ') : 'Aucun'}

Tu DOIS impérativement suivre la structure Markdown exacte ci-dessous et rédiger 2 à 3 paragraphes complets sous CHAQUE sous-titre pour produire un rapport très riche de 4 pages :

# REPORTING PÉDAGOGIQUE ET BILAN DE SUIVI

## 1. Bilan Général de Progression et Positionnement
Rédige 2 paragraphes détaillés sur l'engagement global, le volume d'interactions (${questionsAsked}), le niveau estimé (${quizPct >= 80 ? 'Avancé' : quizPct >= 50 ? 'Intermédiaire' : 'Débutant'}) et la dynamique d'apprentissage.

## 2. Synthèse Détaillée des Compétences Méthodologiques
### 2.1 Schémas d'Étude & Définition de la Population (FINE & PICOT)
Rédige un bilan approfondi sur l'assimilation du cadre PICOT/FINE et des études observationnelles.
### 2.2 Réglementation (Loi n° 18-11 relative à la santé) & Éthique
Analyse la maîtrise des articles 388/391 de la Loi 18-11, du consentement éclairé et du passage en comité d'éthique.
### 2.3 Calcul du Nombre de Sujets Nécessaires (NSN) & Biais de Recherche
Détaille les connaissances en statistique (risque alpha, puissance, calcul NSN) et la gestion des biais.

## 3. Analyse des Acquis (Forces) et des Axes d'Amélioration
Développe sous forme de listes à puces commentées :
- **Points forts identifiés :** (3 à 4 points développés)
- **Axes de progrès prioritaires :** (3 à 4 points développés)

## 4. Focus Méthodologique Personnalisé (RECIF & STROBE)
Développe une analyse sur mesure liée à ses questions récentes et ses protocoles.

## 5. Plan d'Action Opérationnel et Recommandations Pédagogiques
Fournis un plan de travail détaillé en 4 étapes concrètes (Manuel RECIF, Quiz, Protocole, Grille STROBE).

IMPORTANT : N'utilise absolument aucun émoji ni émoticône dans le rapport.`;

    if (!apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateReport(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Ce bilan a été généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ report: formattedOllamaReply });
        }
      }

      const mockReport = getStaticFallbackReport(questionsAsked, protocolsGenerated, quizScore, flashcardsMastered, preferredProvider);
      return NextResponse.json({ report: mockReport });
    }

    // --- APPEL OPENROUTER (QWEN-PLUS pour le rapport) ---
    console.log(`🤖 [Pedagogical Report API] Appel à OpenRouter (QWEN-PLUS)...`);
    const reportText = await withTimeout(
      callLLM(
        "Tu es un conseiller pédagogique expert en recherche clinique RECIF. Tu rédiges des rapports de suivi en français, sans aucun émoji ni émoticône.",
        prompt,
        {
          provider: "qwen-plus",
          temperature: 0.6,
          maxTokens: 4096
        }
      ),
      120000
    );
    console.log(`✅ [Pedagogical Report API] Réponse obtenue avec succès via OpenRouter`);

    return NextResponse.json({ report: reportText });

  } catch (error: any) {
    console.error('Erreur API Rapport Pédagogique, bascule vers le secours local:', error);
    
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

      const totalQuiz = quizScore.total || 0;
      const correctQuiz = quizScore.correct || 0;
      const quizPct = totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 100) : 0;

      const fcMastered = flashcardsMastered.mastered || 0;
      const fcTotal = flashcardsMastered.total || 12;
      const fcPct = Math.round((fcMastered / fcTotal) * 100);

      const prompt = `Tu es un conseiller pédagogique et méthodologique expert en recherche clinique. Tu dois rédiger un bilan de compétences personnalisé et un rapport de suivi pour un utilisateur étudiant la méthodologie de recherche clinique (manuel RECIF).

Voici les statistiques d'activité de l'utilisateur :
- Questions posées au tuteur virtuel : ${questionsAsked}
- Protocoles générés : ${protocolsGenerated}
- Score aux quiz : ${correctQuiz}/${totalQuiz} (${quizPct}%)
- Flashcards maîtrisées : ${fcMastered}/${fcTotal} (${fcPct}%)
- Dernières questions posées : ${recentQuestions.length > 0 ? recentQuestions.join(', ') : 'Aucune'}
- Protocoles initiés : ${recentProtocols.length > 0 ? recentProtocols.join(', ') : 'Aucun'}

Instructions pour le rapport :
1. Rédige un rapport formel et encourageant en Markdown, destiné à l'étudiant.
2. Divise le rapport en sections claires :
   - Bilan général de progression
   - Analyse des acquis (forces) et des lacunes potentielles
   - Focus méthodologique spécifique lié à ses centres d'intérêt ou ses questions récentes
   - Plan d'action personnalisé et recommandations concrètes
3. Le style doit être constructif, haut de gamme, et rédigé entièrement en français.
4. IMPORTANT : N'utilise absolument aucun émoji ni émoticône dans le rapport.`;

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateReport(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Impossible de joindre le service d'IA externe. Bilan généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ report: formattedOllamaReply });
        }
      }
    } catch (ollamaErr) {
      console.warn("⚠️ Échec du secours Ollama pour le rapport pédagogique:", ollamaErr);
    }

    try {
      const mockReport = getStaticFallbackReport(questionsAsked, protocolsGenerated, quizScore, flashcardsMastered, preferredProvider);
      return NextResponse.json({ report: mockReport });
    } catch (fallbackErr) {
      const status = error.status || error.statusCode || 500;
      let userMessage = 'Erreur interne du serveur lors de la génération du rapport.';
      if (status === 429) userMessage = 'Limite de requêtes d\'IA atteinte (Rate Limit). Veuillez patienter une minute avant de réessayer.';
      else if (status === 503 || status === 504) userMessage = 'Le service d\'IA est temporairement surchargé. Veuillez réessayer dans quelques instants.';
      else if (error.message) userMessage = `Erreur : ${error.message}`;
      return NextResponse.json({ error: userMessage }, { status });
    }
  }
}