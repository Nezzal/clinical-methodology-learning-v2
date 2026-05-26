import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      questionsAsked = 0,
      protocolsGenerated = 0,
      quizScore = { correct: 0, total: 0 },
      flashcardsMastered = { mastered: 0, total: 0 },
      recentQuestions = [],
      recentProtocols = [],
    } = data;

    const apiKey = process.env.GEMINI_API_KEY;

    // Calculs de base
    const totalQuiz = quizScore.total || 0;
    const correctQuiz = quizScore.correct || 0;
    const quizPct = totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 100) : 0;

    const fcMastered = flashcardsMastered.mastered || 0;
    const fcTotal = flashcardsMastered.total || 12; // Valeur par défaut
    const fcPct = Math.round((fcMastered / fcTotal) * 100);

    // Fallback Mock si la clé API n'est pas configurée
    if (!apiKey) {
      // Détermination du niveau
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

      const mockReport = `# REPORTING PÉDAGOGIQUE ET BILAN DE SUIVI
*Plateforme d'Apprentissage de la Méthodologie de Recherche Clinique*

⚠️ *Note : Ce bilan a été généré via notre algorithme local standard (clé API non configurée). Configurez votre clé pour obtenir une analyse personnalisée approfondie par l'IA.*

---

## 1. INDICATEURS DE PROGRESSION
* **Niveau global estimé :** ${level}
* **Interactions avec le Tuteur :** ${questionsAsked} question(s) posée(s)
* **Protocoles rédigés :** ${protocolsGenerated} protocole(s) généré(s)
* **Score global aux Quiz :** ${correctQuiz}/${totalQuiz} (${quizPct}%)
* **Flashcards acquises :** ${fcMastered}/${fcTotal} (${fcPct}%)

---

## 2. SYNTHÈSE DES COMPÉTENCES ACQUISES
* **Méthodologie réglementaire (Loi n° 18-11 relative à la santé) :** ${quizPct >= 50 ? 'Maîtrise en cours de consolidation. Vous distinguez les types d\'études réglementées par la Loi 18-11.' : 'Concepts réglementaires encore fragiles, à travailler.'}
* **Conception de protocole (Recommandations RECIF) :** Vous avez créé ${protocolsGenerated} structure(s) de protocole. ${protocolsGenerated > 0 ? 'La structure d\'un protocole type commence à être bien intégrée.' : 'Commencez par générer un premier protocole sur un sujet simple.'}
* **Vocabulaire scientifique et conceptuel :** ${fcPct >= 50 ? 'Bonne assimilation des notions de base (biais, insu, randomisation).' : 'Révisez vos flashcards pour automatiser le vocabulaire de recherche clinique.'}

---

## 3. AXE DE TRAVAIL PRIORITAIRE : ${focusArea.toUpperCase()}
D'après votre parcours, l'axe principal sur lequel orienter vos efforts concerne : **${focusArea}**.
Il est crucial d'harmoniser la rigueur réglementaire avec la cohérence de vos objectifs scientifiques.

---

## 4. PLAN D'ACTION ET RECOMMANDATIONS PÉDAGOGIQUES
1. **Pratique Tuteur :** Posez des questions ciblées sur la validité interne, la validité externe et les biais méthodologiques.
2. **Entraînement Quiz :** Tentez de refaire les quiz pour atteindre un score minimal de 80% sur toutes les catégories.
3. **Approfondissement :** ${recommendation}
`;

      return NextResponse.json({ report: mockReport });
    }

    // Initialisation du client Google GenAI
    const ai = new GoogleGenAI({ apiKey });

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
   - Analyse des acquis (forces) et des lacunes potentielles (sur la base de son score au quiz et des questions qu'il pose)
   - Focus méthodologique spécifique lié à ses centres d'intérêt ou ses questions récentes
   - Plan d'action personnalisé et recommandations concrètes pour s'améliorer (étapes de lecture dans le RECIF, exercices ciblés).
3. Le style doit être constructif, haut de gamme, et rédigé entièrement en français.`;

    let response;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.6,
          }
        });
        break; // Succès
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée pour generateContent (Report):`, err.message || err);
        if (attempt >= maxAttempts) throw err;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    const reportText = response?.text || "Erreur lors de la génération du rapport par l'IA.";
    return NextResponse.json({ report: reportText });

  } catch (error: any) {
    console.error('Erreur API Rapport Pédagogique:', error);
    const status = error.status || error.statusCode || 500;
    let userMessage = 'Erreur interne du serveur lors de la génération du rapport.';

    if (status === 429) {
      userMessage = 'Limite de requêtes d\'IA atteinte (Rate Limit). Veuillez patienter une minute avant de réessayer.';
    } else if (status === 503 || status === 504) {
      userMessage = 'Le service d\'IA est temporairement surchargé. Veuillez réessayer dans quelques instants.';
    } else if (error.message) {
      userMessage = `Erreur : ${error.message}`;
    }

    return NextResponse.json({ error: userMessage }, { status });
  }
}
