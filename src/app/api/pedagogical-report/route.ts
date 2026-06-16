import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { loadEnvLocal } from '@/utils/env';
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
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 secondes de timeout (la génération locale sur CPU/GPU peut être longue)

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { 
            role: 'system', 
            content: "Tu es un conseiller pédagogique et méthodologique expert en recherche clinique RECIF. Tu dois formuler un rapport de suivi personnalisé et constructif en français sous forme de Markdown, sans préambule ni conclusion de type 'Voici votre rapport', et sans utiliser aucun émoji ou émoticône." 
          },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: {
          temperature: 0.6
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
    return data.message?.content || null;
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
  preferredProvider: string = 'gemini'
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
    ? `⚠️ *Note : Ce bilan a été généré via notre algorithme local standard car le service local Ollama est injoignable ou le modèle n'est pas chargé. Veuillez lancer l'application Ollama et charger le modèle \`${process.env.OLLAMA_MODEL || 'gemma4:latest'}\`.*`
    : `⚠️ *Note : Ce bilan a été généré via notre algorithme local standard (clé API non configurée ou indisponible). Vous pouvez configurer votre clé ou activer Ollama localement pour une analyse personnalisée approfondie.*`;

  return `# REPORTING PÉDAGOGIQUE ET BILAN DE SUIVI
*Plateforme d'Apprentissage de la Méthodologie de Recherche Clinique*

${note}

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
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('TIMEOUT_EXCEEDED'));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request) {
  loadEnvLocal();
  let questionsAsked = 0;
  let protocolsGenerated = 0;
  let quizScore = { correct: 0, total: 0 };
  let flashcardsMastered = { mastered: 0, total: 0 };
  let recentQuestions: string[] = [];
  let recentProtocols: string[] = [];
  let preferredProvider = 'gemini';
  let headerOllamaModel: string | null = null;

  try {
    const data = await req.json();
    questionsAsked = data.questionsAsked ?? 0;
    protocolsGenerated = data.protocolsGenerated ?? 0;
    quizScore = data.quizScore ?? { correct: 0, total: 0 };
    flashcardsMastered = data.flashcardsMastered ?? { mastered: 0, total: 0 };
    recentQuestions = data.recentQuestions ?? [];
    recentProtocols = data.recentProtocols ?? [];

    const requestHeaders = new Headers(req.headers);
    preferredProvider = requestHeaders.get('x-ai-provider') || 'gemini';
    headerOllamaModel = requestHeaders.get('x-ollama-model');
    const apiKey = preferredProvider === 'ollama' ? null : process.env.GEMINI_API_KEY;

    // Calculs de base
    const totalQuiz = quizScore.total || 0;
    const correctQuiz = quizScore.correct || 0;
    const quizPct = totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 100) : 0;

    const fcMastered = flashcardsMastered.mastered || 0;
    const fcTotal = flashcardsMastered.total || 12; // Valeur par défaut
    const fcPct = Math.round((fcMastered / fcTotal) * 100);

    // Fallback si la clé API n'est pas configurée
    if (!apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

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
3. Le style doit être constructif, haut de gamme, et rédigé entièrement en français.
4. IMPORTANT : N'utilise absolument aucun émoji ni émoticône dans le rapport (aucun symbole graphique comme 🔬, 🧠, ✅, 🛡️, etc., ni dans les titres ni dans le texte).`;

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateReport(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Ce bilan a été généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ report: formattedOllamaReply });
        }
      }

      // Repli ultime sur mock statique
      const mockReport = getStaticFallbackReport(questionsAsked, protocolsGenerated, quizScore, flashcardsMastered, preferredProvider);
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
3. Le style doit être constructif, haut de gamme, et rédigé entièrement en français.
4. IMPORTANT : N'utilise absolument aucun émoji ni émoticône dans le rapport (aucun symbole graphique comme 🔬, 🧠, ✅, 🛡️, etc., ni dans les titres ni dans le texte).`;

    const checkIsOffline = (err: any) => {
      const errMsg = err.message?.toLowerCase() || '';
      const errCode = err.code || '';
      return errMsg.includes('fetch failed') || 
             errMsg.includes('getaddrinfo') || 
             errMsg.includes('enotfound') || 
             errMsg.includes('eai_again') || 
             errMsg.includes('connect timed out') ||
             errCode === 'ENOTFOUND' || 
             errCode === 'EAI_AGAIN';
    };

    const checkIsQuotaOrRateLimit = (err: any) => {
      const status = err.status || err.statusCode;
      const errMsg = err.message?.toLowerCase() || '';
      return status === 429 || 
             errMsg.includes('quota') || 
             errMsg.includes('rate limit') || 
             errMsg.includes('resource_exhausted') ||
             errMsg.includes('exceeded your current quota');
    };

    const getRetryDelay = (err: any): number => {
      let delay = 6;
      try {
        const errMsg = err.message || '';
        let errObj: any = null;
        const jsonStartIndex = errMsg.indexOf('{');
        if (jsonStartIndex !== -1) {
          const jsonStr = errMsg.substring(jsonStartIndex);
          errObj = JSON.parse(jsonStr);
        }
        if (errObj) {
          const details = errObj.error?.details || errObj.details || [];
          const retryInfo = details.find((d: any) => d['@type']?.includes('RetryInfo') || d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          if (retryInfo && retryInfo.retryDelay) {
            const parsed = parseFloat(retryInfo.retryDelay.replace('s', ''));
            if (!isNaN(parsed)) return Math.ceil(parsed) + 1;
          }
        }
      } catch (e) {}
      try {
        const match = err.message?.match(/Please retry in ([0-9.]+)\s*s/i);
        if (match) {
          const parsed = parseFloat(match[1]);
          if (!isNaN(parsed)) return Math.ceil(parsed) + 1;
        }
      } catch (e) {}
      return delay;
    };

    let response;
    let attempt = 0;
    const maxAttempts = 3;
    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash'
    ];

    while (attempt < maxAttempts) {
      const currentModel = modelsToTry[attempt % modelsToTry.length];
      try {
        console.log(`🤖 [Pedagogical Report API] Appel à ${currentModel} (Tentative ${attempt + 1}/${maxAttempts})...`);
        response = await withTimeout(
          ai.models.generateContent({
            model: currentModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              temperature: 0.6,
            }
          }),
          90000 // 90 secondes de timeout pour les analyses approfondies
        );
        console.log(`✅ [Pedagogical Report API] Réponse obtenue avec succès via le modèle ${currentModel}`);
        break; // Succès
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée avec le modèle ${currentModel} :`, err.message || err);
        
        if (checkIsOffline(err) || attempt >= maxAttempts) {
          throw err;
        }

        let waitTime = Math.pow(2, attempt) * 2000;
        if (checkIsQuotaOrRateLimit(err)) {
          const delaySeconds = getRetryDelay(err);
          console.log(`⏳ [Pedagogical Report API] Quota dépassé pour ${currentModel}. Attente de ${delaySeconds}s avant la tentative suivante...`);
          waitTime = delaySeconds * 1000;
        } else if (err.message === 'TIMEOUT_EXCEEDED') {
          console.log(`⏳ [Pedagogical Report API] Timeout dépassé pour ${currentModel}. Attente de 3s avant la tentative suivante...`);
          waitTime = 3000;
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    const reportText = response?.text || "Erreur lors de la génération du rapport par l'IA.";
    return NextResponse.json({ report: reportText });

  } catch (error: any) {
    console.error('Erreur API Rapport Pédagogique, bascule vers le secours local:', error);
    
    // 1. Tenter d'utiliser Ollama en secours local
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
   - Analyse des acquis (forces) et des lacunes potentielles (sur la base de son score au quiz et des questions qu'il pose)
   - Focus méthodologique spécifique lié à ses centres d'intérêt ou ses questions récentes
   - Plan d'action personnalisé et recommandations concrètes pour s'améliorer (étapes de lecture dans le RECIF, exercices ciblés).
3. Le style doit être constructif, haut de gamme, et rédigé entièrement en français.
4. IMPORTANT : N'utilise absolument aucun émoji ni émoticône dans le rapport (aucun symbole graphique comme 🔬, 🧠, ✅, 🛡️, etc., ni dans les titres ni dans le texte).`;

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateReport(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Impossible de joindre le service Google Cloud. Bilan généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ report: formattedOllamaReply });
        }
      }
    } catch (ollamaErr) {
      console.warn("⚠️ Échec du secours Ollama pour le rapport pédagogique:", ollamaErr);
    }

    // 2. Repli ultime sur mock statique
    try {
      const mockReport = getStaticFallbackReport(questionsAsked, protocolsGenerated, quizScore, flashcardsMastered, preferredProvider);
      return NextResponse.json({ report: mockReport });
    } catch (fallbackErr) {
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
}
