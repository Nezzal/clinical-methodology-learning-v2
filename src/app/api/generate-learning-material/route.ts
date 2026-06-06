import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { loadEnvLocal } from '@/utils/env';
import recifKb from '@/data/recif-kb.json';
import glossaryData from '@/data/glossary.json';

function getStaticFallbackMaterial(type: string, topic: string) {
  if (type === 'quiz') {
    return [
      {
        question: `Dans le cadre de : "${topic}", quel est l'enjeu méthodologique principal selon les recommandations du manuel RECIF ?`,
        options: [
          "Garantir la validité interne en contrôlant les biais et facteurs de confusion",
          "Maximiser le nombre de patients sans calcul statistique préalable",
          "Publier les résultats uniquement s'ils confirment l'hypothèse H1",
          "Ignorer les critères d'éligibilité pour accélérer les inclusions"
        ],
        answerIndex: 0,
        explanation: `Pour toute thématique liée à "${topic}", le manuel RECIF insiste sur la rigueur de la validité interne, notamment le contrôle strict des biais et des variables de confusion.`
      },
      {
        question: `Selon la loi algérienne n° 18-11 relative à la santé, comment s'applique l'obligation éthique majeure sur le sujet traité par : "${topic}" ?`,
        options: [
          "Par une simple information verbale donnée au patient",
          "Par le recueil obligatoire par écrit du consentement libre et éclairé du patient",
          "Par une décision unilatérale de l'investigateur principal",
          "Aucune obligation éthique ne s'applique aux études observationnelles"
        ],
        answerIndex: 1,
        explanation: "L'article 386 de la loi 18-11 exige que tout participant à une étude clinique donne son consentement par écrit après avoir été clairement informé."
      },
      {
        question: `Quel schéma d'étude clinique est le plus robuste pour explorer le sujet "${topic}" avec le niveau de preuve le plus élevé ?`,
        options: [
          "Une série de cas descriptifs",
          "Une étude transversale de prévalence",
          "Une étude de cohorte rétrospective",
          "Un essai clinique contrôlé randomisé en double insu"
        ],
        answerIndex: 3,
        explanation: "L'essai clinique randomisé contrôlé en double insu offre le niveau de preuve le plus élevé (grade A) d'après le classement du RECIF et de la HAS."
      },
      {
        question: `Comment définir le critère de jugement principal pour évaluer "${topic}" ?`,
        options: [
          "Il doit être multiple et défini après l'analyse des données",
          "Il doit être subjectif pour s'adapter à chaque patient",
          "Il doit être unique, cliniquement pertinent, mesurable objectivement et défini a priori",
          "Il correspond toujours à la mortalité toutes causes confondues"
        ],
        answerIndex: 2,
        explanation: "Le critère de jugement principal (endpoint) doit être unique, mesurable de manière objective et reproductible, et fixé dans le protocole avant le début de l'étude."
      },
      {
        question: `Si l'on souhaite analyser statistiquement les résultats d'une étude sur "${topic}", quelle est la règle d'or concernant le risque alpha (type I) ?`,
        options: [
          "Il doit être supérieur à 20% pour garantir la significativité",
          "Il est classiquement fixé à 5% (p < 0.05) pour rejeter l'hypothèse nulle H0 à raison",
          "Il n'est calculé que pour les études de petite taille",
          "Il correspond à la probabilité de ne pas détecter une différence réelle"
        ],
        answerIndex: 1,
        explanation: "Le risque d'erreur alpha (rejeter l'hypothèse nulle H0 alors qu'elle est vraie) est traditionnellement fixé à 5% en recherche clinique."
      }
    ];
  } else {
    return [
      {
        question: `Concept clé de : ${topic}`,
        answer: `Rappel méthodologique RECIF : le concept lié à "${topic}" exige de définir clairement les objectifs de l'étude et d'adapter le plan d'analyse en conséquence.`
      },
      {
        question: `Réglementation Algérienne (Loi 18-11) & ${topic}`,
        answer: `Tout protocole portant sur "${topic}" doit être soumis pour avis obligatoire au Comité d'éthique médicale (Art. 382) et requiert l'autorisation du Ministère de la Santé (Art. 381).`
      },
      {
        question: `Biais potentiel à éviter sur ${topic}`,
        answer: `Veiller aux biais de sélection (population non représentative) et aux biais d'information (erreurs de mesure ou disparité de souvenir).`
      },
      {
        question: `Critère de jugement & ${topic}`,
        answer: `Pour évaluer "${topic}", il faut un critère de jugement principal unique, pertinent, mesurable objectivement et fixé a priori.`
      },
      {
        question: `Puissance statistique & ${topic}`,
        answer: `La puissance (1 - bêta) représente la capacité à mettre en évidence une différence sur "${topic}". Elle augmente avec la taille de l'échantillon.`
      }
    ];
  }
}

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

async function tryOllamaGenerateMaterial(
  prompt: string,
  ollamaUrl: string,
  ollamaModel: string
): Promise<any[] | null> {
  try {
    console.log(`🤖 [Matériel Pédagogique] Tentative d'appel à Ollama (${ollamaModel}) sur ${ollamaUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 secondes de timeout (la génération locale de QCM/Flashcards prend du temps)

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
            content: "Tu es un tuteur expert en méthodologie de recherche clinique RECIF. Tu dois formuler tes réponses uniquement sous la forme d'un tableau JSON d'objets, sans aucune phrase de présentation ou de conclusion." 
          },
          { role: 'user', content: prompt }
        ],
        format: 'json',
        stream: false,
        options: {
          temperature: 0.7
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
    const text = data.message?.content || '';
    
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed.items || null);
  } catch (error: any) {
    console.warn('⚠️ Échec de la génération locale de matériel par Ollama:', error.message || error);
    return null;
  }
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
  let type = '';
  let topic = '';
  try {
    const body = await req.json();
    type = body.type;
    topic = body.topic;

    if (!type || !topic) {
      return NextResponse.json({ error: 'Type (quiz/flashcards) et Topic requis.' }, { status: 400 });
    }

    const requestHeaders = new Headers(req.headers);
    const preferredProvider = requestHeaders.get('x-ai-provider') || 'gemini';
    const apiKey = preferredProvider === 'ollama' ? null : process.env.GEMINI_API_KEY;

    // Fallback si la clé API n'est pas configurée
    if (!apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:latest';

      const prompt = type === 'quiz' ? 
        `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère un questionnaire d'évaluation (QCM) de 3 questions uniques, réalistes et spécifiquement adaptées au sujet suivant : "${topic}".
Les questions ne doivent pas être génériques ou répétitives, mais doivent prendre la forme de scénarios cliniques ou de dilemmes pratiques de recherche concrets liés au sujet.

Structure des 3 questions :
- Question 1 : Choix du schéma d'étude ou critère de jugement principal le plus adapté et pertinent pour étudier "${topic}".
- Question 2 : Identification ou contrôle d'un biais méthodologique spécifique (sélection, mesure, confusion) inhérent à l'étude de "${topic}".
- Question 3 : Aspect réglementaire (loi algérienne 18-11 relative à la santé, consentement, comité d'éthique) appliqué à une recherche sur "${topic}".

Tu DOIS retourner UNIQUEMENT un tableau JSON contenant exactement 3 objets avec la structure suivante :
[
  {
    "question": "Texte de la question...",
    "options": ["Choix 0", "Choix 1", "Choix 2", "Choix 3"],
    "answerIndex": 0,
    "explanation": "Explication..."
  }
]` : 
        `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère 3 flashcards d'apprentissage (recto-verso) uniques et stimulantes spécifiquement adaptées au sujet suivant : "${topic}".
Chaque flashcard doit interroger un enjeu méthodologique ou réglementaire concret lié à ce sujet.

Structure des 3 flashcards :
- Flashcard 1 : Définition d'un concept clé méthodologique RECIF appliqué à l'étude de "${topic}".
- Flashcard 2 : Un biais majeur à éviter spécifiquement lors d'une recherche sur "${topic}".
- Flashcard 3 : Une obligation réglementaire éthique (Loi algérienne 18-11) liée à un projet sur "${topic}".

Tu DOIS retourner UNIQUEMENT un tableau JSON contenant exactement 3 objets avec la structure suivante :
[
  {
    "question": "La question ou concept au recto...",
    "answer": "La réponse ou définition au verso..."
  }
]`;

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateMaterial(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply && Array.isArray(ollamaReply) && ollamaReply.length > 0) {
          return NextResponse.json({ items: ollamaReply });
        }
      }

      // Repli ultime sur mock statique
      const mockItems = getStaticFallbackMaterial(type, topic);
      return NextResponse.json({ items: mockItems });
    }

    // Initialisation du client Google GenAI
    const ai = new GoogleGenAI({ apiKey });

    // Formatage de la base de connaissances pour le prompt système
    const kbString = JSON.stringify(recifKb, null, 2);

    let prompt = "";
    let responseSchema: any = null;

    if (type === 'quiz') {
      prompt = `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère un questionnaire d'évaluation (QCM) de 5 questions uniques, réalistes et intimement liées au sujet médical ou méthodologique suivant : "${topic}".
Les questions ne doivent pas être génériques (éviter les simples "remplacements de mots" dans un patron fixe), mais doivent s'apparenter à de petits cas cliniques ou scénarios pratiques de recherche clinique.

Répartition thématique des 5 questions (à respecter impérativement) :
1. **Objectif & Critère de jugement** : Choix ou formulation du critère de jugement principal (endpoint) le plus pertinent et mesurable objectivement pour évaluer "${topic}".
2. **Schéma d'étude** : Sélection du design de l'étude (essai randomisé, cohorte, cas-témoins, transversale) le plus adapté aux contraintes éthiques et scientifiques de l'étude de "${topic}".
3. **Biais de recherche** : Scénario décrivant un biais potentiel spécifique (biais de sélection, de mesure, d'attrition, de confusion) inhérent à "${topic}" et comment le minimiser.
4. **Dimensionnement & Statistique** : Aspect statistique lié à "${topic}" (choix de la puissance, ajustement sur variables de confusion, calcul du NSN ou test statistique).
5. **Réglementation & Éthique (Algérie)** : Mise en situation éthique ou administrative régie par la Loi algérienne n° 18-11 relative à la santé (consentement écrit, comité d'éthique médicale locale, pénalités) dans le cadre de "${topic}".

Pour chaque question, fournis 4 options de réponse réalistes (dont une seule est correcte), l'index de la réponse correcte (0 à 3) et une explication méthodologique claire faisant référence aux principes du RECIF ou de la loi algérienne 18-11.

Base de connaissances RECIF & Loi algérienne :
${kbString}

Renvoie un tableau JSON contenant exactement 5 objets.`;

      responseSchema = {
        type: Type.ARRAY,
        description: "Liste des questions de quiz générées",
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "La question posée" },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "Les 4 choix possibles (exactement 4)" 
            },
            answerIndex: { type: Type.INTEGER, description: "L'index de la bonne réponse (0, 1, 2 ou 3)" },
            explanation: { type: Type.STRING, description: "L'explication détaillée de la réponse" }
          },
          required: ["question", "options", "answerIndex", "explanation"]
        }
      };

    } else {
      prompt = `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère 5 flashcards d'apprentissage (recto-verso) uniques, structurées et stimulantes spécifiquement adaptées au sujet suivant : "${topic}".
Les flashcards ne doivent pas être répétitives et doivent forcer la réflexion de l'étudiant sur des situations concrètes liées à "${topic}".

Répartition thématique des 5 flashcards :
1. **Concept & Schéma** : Un concept clé de méthodologie RECIF (ex: randomisation, insu, critère PICOT) appliqué à l'étude de "${topic}".
2. **Biais méthodologique** : Un biais spécifique redoutable à éviter lors de la conception d'un protocole sur "${topic}".
3. **Dimensionnement** : Un paramètre d'estimation ou de calcul statistique (NSN, erreur alpha, puissance) adapté au sujet "${topic}".
4. **Réglementation éthique** : Une obligation légale ou administrative spécifique (Loi algérienne n° 18-11 relative à la santé) à respecter pour étudier "${topic}".
5. **Hypothèse de recherche** : La manière de structurer l'hypothèse clinique principale ou l'objectif sur "${topic}".

Base de connaissances :
${kbString}

Renvoie un tableau JSON contenant exactement 5 objets.`;

      responseSchema = {
        type: Type.ARRAY,
        description: "Liste des flashcards générées",
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "Le concept ou la question figurant au recto de la carte" },
            answer: { type: Type.STRING, description: "La définition ou la réponse figurant au verso de la carte" }
          },
          required: ["question", "answer"]
        }
      };
    }

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

    let response;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              temperature: 0.8,
              responseMimeType: 'application/json',
              responseSchema: responseSchema
            }
          }),
          60000 // 60 secondes de timeout
        );
        break; // Succès
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée pour generateContent:`, err.message || err);
        if (checkIsOffline(err) || checkIsQuotaOrRateLimit(err) || err.message === 'TIMEOUT_EXCEEDED' || attempt >= maxAttempts) {
          throw err; // Lancer l'erreur immédiatement sans attendre si hors-ligne/quota dépassé/timeout
        }
        // Attente exponentielle (2s, 4s...)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    const replyJson = JSON.parse(response?.text || '[]');
    return NextResponse.json({ items: replyJson });

  } catch (error: any) {
    console.error('Erreur API Générateur de matériel pédagogique, bascule vers le secours local:', error);
    
    // 1. Tenter d'utiliser Ollama en secours local
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:latest';

      const prompt = type === 'quiz' ? 
        `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère un questionnaire d'évaluation (QCM) de 3 questions uniques, réalistes et spécifiquement adaptées au sujet suivant : "${topic}".
Les questions ne doivent pas être génériques ou répétitives, mais doivent prendre la forme de scénarios cliniques ou de dilemmes pratiques de recherche concrets liés au sujet.

Structure des 3 questions :
- Question 1 : Choix du schéma d'étude ou critère de jugement principal le plus adapté et pertinent pour étudier "${topic}".
- Question 2 : Identification ou contrôle d'un biais méthodologique spécifique (sélection, mesure, confusion) inhérent à l'étude de "${topic}".
- Question 3 : Aspect réglementaire (loi algérienne 18-11 relative à la santé, consentement, comité d'éthique) appliqué à une recherche sur "${topic}".

Tu DOIS retourner UNIQUEMENT un tableau JSON contenant exactement 3 objets avec la structure suivante :
[
  {
    "question": "Texte de la question...",
    "options": ["Choix 0", "Choix 1", "Choix 2", "Choix 3"],
    "answerIndex": 0,
    "explanation": "Explication..."
  }
]` : 
        `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère 3 flashcards d'apprentissage (recto-verso) uniques et stimulantes spécifiquement adaptées au sujet suivant : "${topic}".
Chaque flashcard doit interroger un enjeu méthodologique ou réglementaire concret lié à ce sujet.

Structure des 3 flashcards :
- Flashcard 1 : Définition d'un concept clé méthodologique RECIF appliqué à l'étude de "${topic}".
- Flashcard 2 : Un biais majeur à éviter spécifiquement lors d'une recherche sur "${topic}".
- Flashcard 3 : Une obligation réglementaire éthique (Loi algérienne 18-11) liée à un projet sur "${topic}".

Tu DOIS retourner UNIQUEMENT un tableau JSON contenant exactement 3 objets avec la structure suivante :
[
  {
    "question": "La question ou concept au recto...",
    "answer": "La réponse ou définition au verso..."
  }
]`;

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateMaterial(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply && Array.isArray(ollamaReply) && ollamaReply.length > 0) {
          return NextResponse.json({ items: ollamaReply });
        }
      }
    } catch (ollamaErr) {
      console.warn("⚠️ Échec du secours Ollama pour le matériel:", ollamaErr);
    }

    // 2. Repli ultime sur mock statique
    try {
      const mockItems = getStaticFallbackMaterial(type, topic);
      return NextResponse.json({ items: mockItems });
    } catch (fallbackErr) {
      const status = error.status || error.statusCode || 500;
      let userMessage = 'Erreur lors de la génération du contenu pédagogique.';
      
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
