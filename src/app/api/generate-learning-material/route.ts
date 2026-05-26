import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import recifKb from '@/data/recif-kb.json';

export async function POST(req: Request) {
  try {
    const { type, topic } = await req.json();

    if (!type || !topic) {
      return NextResponse.json({ error: 'Type (quiz/flashcards) et Topic requis.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback Mock si la clé API n'est pas configurée
    if (!apiKey) {
      if (type === 'quiz') {
        const mockQuestions = [
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
        return NextResponse.json({ items: mockQuestions });
      } else {
        const mockCards = [
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
        return NextResponse.json({ items: mockCards });
      }
    }

    // Initialisation du client Google GenAI
    const ai = new GoogleGenAI({ apiKey });

    // Formatage de la base de connaissances pour le prompt système
    const kbString = JSON.stringify(recifKb, null, 2);

    let prompt = "";
    let responseSchema: any = null;

    if (type === 'quiz') {
      prompt = `Génère un questionnaire d'évaluation (QCM) de 5 questions uniques et réalistes sur le sujet suivant : "${topic}".
Les questions doivent être basées sur la méthodologie de recherche clinique du manuel RECIF et la réglementation algérienne (Loi n° 18-11 relative à la santé, Ministère de la Santé, Comité d'éthique).

Pour chaque question, fournis 4 options de réponse (dont une seule est correcte), l'index de la réponse correcte (0 à 3) et une explication méthodologique claire faisant référence aux principes du RECIF ou de la loi algérienne 18-11.

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
      prompt = `Génère 5 flashcards d'apprentissage (recto-verso) sur le sujet suivant : "${topic}".
Chaque flashcard doit contenir une question (ou concept clé à définir) au recto, et une explication claire et concise au verso.
Les explications doivent être basées sur le manuel RECIF et la réglementation algérienne Loi n° 18-11.

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

    let response;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.8,
            responseMimeType: 'application/json',
            responseSchema: responseSchema
          }
        });
        break; // Succès
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée pour generateContent:`, err.message || err);
        if (attempt >= maxAttempts) {
          throw err; // Lancer l'erreur si toutes les tentatives ont échoué
        }
        // Attente exponentielle (2s, 4s...)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    const replyJson = JSON.parse(response?.text || '[]');
    return NextResponse.json({ items: replyJson });

  } catch (error: any) {
    console.error('Erreur API Générateur de matériel pédagogique:', error);
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
