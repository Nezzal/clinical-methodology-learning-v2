import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import recifKb from '@/data/recif-kb.json';
import fs from 'fs';
import path from 'path';

// Interface pour les paragraphes indexés
interface EmbeddedChunk {
  page: number;
  text: string;
  embedding: number[];
}

// Chargement dynamique du fichier d'embeddings
let recifEmbeddings: EmbeddedChunk[] = [];
try {
  const filePath = path.join(process.cwd(), 'src/data/recif-embeddings.json');
  if (fs.existsSync(filePath)) {
    recifEmbeddings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`✅ ${recifEmbeddings.length} embeddings RECIF chargés avec succès.`);
  } else {
    console.log("⚠️ Fichier recif-embeddings.json introuvable. Le RAG fonctionnera en mode dégradé (base de connaissances fixe).");
  }
} catch (error) {
  console.error("❌ Erreur lors du chargement des embeddings RECIF:", error);
}

// Fonction de calcul de similitude cosinus
function getCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages format invalide.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback Mock si la clé API n'est pas configurée
    if (!apiKey) {
      const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      let mockReply = "Bonjour ! Je suis votre tuteur virtuel RECIF.\n\n⚠️ *Note : La clé API `GEMINI_API_KEY` n'est pas configurée dans le fichier `.env.local`.* Pour tester le tuteur connecté avec RAG et recherche vectorielle en temps réel, veuillez ajouter votre clé.\n\nEn attendant, voici une réponse basée sur notre base de connaissances intégrée :\n\n";

      if (lastUserMessage.includes('loi 18-11') || lastUserMessage.includes('reglementation') || lastUserMessage.includes('ethique') || lastUserMessage.includes('ministere') || lastUserMessage.includes('algerie')) {
        mockReply += `**Réglementation Algérienne (Loi n° 18-11 relative à la santé) :**\nEn Algérie, la recherche biomédicale (études cliniques) est encadrée par les articles 377 à 399 de la loi 18-11 :\n- **Autorisation ministérielle :** Toute étude exige l'autorisation écrite du **Ministère de la Santé** sous 3 mois (Art. 381).\n- **Comité d'Éthique :** Avis favorable obligatoire d'un **Comité d'éthique médicale** indépendant (Art. 382 et 383).\n- **Consentement écrit :** Recueil obligatoire par écrit du consentement libre et éclairé du participant (Art. 386).\n- **Sanctions pénales (Art. 438-439) :** Le lancement d'une étude sans autorisation ou sans consentement expose l'investigateur à **2 à 5 ans de prison**.`;
      } else if (lastUserMessage.includes('schema') || lastUserMessage.includes('cohor') || lastUserMessage.includes('cas-temoin') || lastUserMessage.includes('essai')) {
        mockReply += `**Schémas d'étude :**\nSelon le manuel RECIF, vous pouvez choisir entre :\n1. **Essai Clinique Randomisé Contrôlé (ECR) :** Permet de prouver la causalité en réduisant les biais de sélection.\n2. **Étude de Cohorte (prospective/rétrospective) :** Pour suivre des sujets exposés vs non-exposés dans le temps.\n3. **Étude Cas-Témoins (rétrospective) :** Idéale pour les maladies rares en comparant des malades (cas) à des sujets sains (témoins).\n4. **Étude Transversale :** Pour mesurer la prévalence à un instant T.`;
      } else if (lastUserMessage.includes('stat') || lastUserMessage.includes('nombre') || lastUserMessage.includes('sujet') || lastUserMessage.includes('nsn') || lastUserMessage.includes('puissance')) {
        mockReply += `**Calcul du Nombre de Sujets Nécessaires (NSN) :**\nSelon la méthodologie statistique du RECIF, le calcul dépend de :\n- Le **critère de jugement principal** (quantitative ou qualitative).\n- La **différence attendue** cliniquement pertinente.\n- Le **risque d'erreur alpha** (faux positif, généralement fixé à 5%).\n- La **puissance statistique (1 - bêta)** (généralement 80% ou 90%).\n- L'écart-type ou la variabilité des données dans la population.`;
      } else if (lastUserMessage.includes('objectif') || lastUserMessage.includes('critere') || lastUserMessage.includes('jugement')) {
        mockReply += `**Objectifs et Critères de Jugement :**\n- **Objectif Principal :** Répond à une question unique et claire (ex: supériorité d'un nouveau traitement).\n- **Critère de Jugement Principal (Endpoint) :** Mesure quantitative ou qualitative qui permet d'évaluer directement l'objectif principal. Il doit être unique, mesurable et cliniquement pertinent.\n- **Objectifs/Critères Secondaires :** Utilisés pour évaluer d'autres paramètres (tolérance, qualité de vie, analyses de sous-groupes).`;
      } else {
        mockReply += `Je peux vous aider à rédiger votre protocole de recherche clinique en suivant les recommandations du manuel RECIF. Vous pouvez me poser des questions sur :\n1. Les **catégories de recherche** et aspects réglementaires algériens (Loi 18-11).\n2. Les **schémas d'étude** (Cohorte, Cas-Témoins, Essais randomisés).\n3. Les **critères de jugement** et la formulation de la question de recherche.\n4. Le **calcul de taille d'échantillon** et les notions statistiques (erreur alpha, puissance).\n5. Les aspects **éthiques et d'autorisation** en Algérie.`;
      }

      return NextResponse.json({ text: mockReply });
    }

    // Initialisation du client Google GenAI
    const ai = new GoogleGenAI({ apiKey });

    // Récupérer le dernier message de l'utilisateur
    const lastUserMessageObj = messages.filter((m: any) => m.role === 'user').slice(-1)[0];
    const userQuery = lastUserMessageObj ? lastUserMessageObj.content : '';

    let contextString = '';
    let hasRAG = false;

    // Effectuer la recherche vectorielle si le fichier d'embeddings est chargé et la requête est valide
    if (recifEmbeddings.length > 0 && userQuery) {
      try {
        console.log(`🔍 Génération de l'embedding pour la requête : "${userQuery.substring(0, 50)}..."`);
        
        // Appeler l'API Gemini pour générer l'embedding de la question de l'utilisateur (avec tentatives de repli)
        let embedResponse;
        let embedAttempt = 0;
        const maxEmbedAttempts = 3;
        while (embedAttempt < maxEmbedAttempts) {
          try {
            embedResponse = await ai.models.embedContent({
              model: 'gemini-embedding-2',
              contents: userQuery,
              config: {
                outputDimensionality: 768
              }
            });
            break;
          } catch (err: any) {
            embedAttempt++;
            console.warn(`⚠️ Tentative d'embedding ${embedAttempt}/${maxEmbedAttempts} échouée:`, err.message || err);
            if (embedAttempt >= maxEmbedAttempts) throw err;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, embedAttempt) * 1000));
          }
        }

        const queryVector = embedResponse?.embeddings?.[0]?.values;

        if (queryVector) {
          // Calculer les similitudes avec tous les segments
          const scoredChunks = recifEmbeddings.map(chunk => ({
            page: chunk.page,
            text: chunk.text,
            similarity: getCosineSimilarity(queryVector, chunk.embedding)
          }));

          // Trier par pertinence décroissante et prendre les 4 premiers
          const topChunks = scoredChunks
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 4);

          console.log(`🎯 Top 4 segments trouvés (Similitudes max: ${topChunks[0]?.similarity.toFixed(4)}) :`);
          topChunks.forEach((c, idx) => {
            console.log(`   [${idx + 1}] Page ${c.page} (Sim: ${c.similarity.toFixed(4)}) : "${c.text.substring(0, 60)}..."`);
          });

          // Construire la chaîne de contexte avec mentions des pages
          contextString = topChunks
            .map(c => `[Page ${c.page}] : "${c.text}"`)
            .join('\n\n');
          
          hasRAG = true;
        }
      } catch (err) {
        console.error('❌ Échec de la recherche vectorielle (RAG):', err);
      }
    }

    // Définition du prompt système adapté
    let systemInstruction = '';

    if (hasRAG) {
      systemInstruction = `Tu es un tuteur expert en méthodologie de recherche clinique en ligne, spécialisé dans le manuel français "RECIF" (Recherche Clinique et Épidémiologique : Conception, Rédaction, Faisabilité) et la réglementation algérienne (Loi n° 18-11 du 2 juillet 2018 relative à la santé).
Ton but est d'aider les étudiants, chercheurs et cliniciens à concevoir et rédiger leurs protocoles de recherche de manière rigoureuse et conforme.

Pour répondre à la question de l'utilisateur, tu DOIS utiliser en priorité absolue les extraits suivants du manuel RECIF, qui ont été extraits par recherche sémantique vectorielle :

--- EXTRAITS PERTINENTS DU MANUEL RECIF ---
${contextString}
-------------------------------------------

Règles de comportement fondamentales :
1. Analyse chirurgicalement les extraits fournis pour formuler ta réponse.
2. Pour CHAQUE fait important, recommandation ou citation tirée du livre, mentionne obligatoirement la page de manière claire, sous la forme "[Page X]" (par exemple : "Selon le manuel, l'erreur alpha est de 5% [Page 145]").
3. Si les extraits contiennent la réponse, base-toi dessus. Si les extraits ne sont pas suffisants pour répondre complètement, tu peux utiliser tes connaissances générales sur le RECIF, mais indique clairement quand une information ne provient pas directement du livre indexé.
4. Intègre de manière transparente la réglementation algérienne (Loi n° 18-11 relative à la santé) si la question porte sur les aspects éthiques, de consentement ou administratifs. Rappelle que le Ministère de la Santé algérien et un comité d'éthique local sont compétents.
5. Utilise le formatage Markdown pour structurer tes réponses (titres, listes à puces, caractères gras).
6. Réponds en français de manière bienveillante et professionnelle.`;
    } else {
      // Fallback sur la base de connaissances globale statique (recif-kb.json)
      const kbString = JSON.stringify(recifKb, null, 2);
      systemInstruction = `Tu es un tuteur expert en méthodologie de recherche clinique en ligne, spécialisé dans le manuel français "RECIF" (Recherche Clinique et Épidémiologique : Conception, Rédaction, Faisabilité) et la réglementation algérienne (Loi n° 18-11 du 2 juillet 2018 relative à la santé).
Ton but est d'aider les étudiants, chercheurs et cliniciens à concevoir et rédiger leurs protocoles de recherche de manière rigoureuse et conforme.

Voici des extraits synthétiques de la base de connaissances du manuel RECIF et de la réglementation algérienne à utiliser pour guider tes réponses :
${kbString}

Instructions de réponse :
1. Reste toujours rigoureux, professionnel et structuré.
2. Utilise le formatage Markdown.
3. Rappelle que pour les aspects éthiques et d'autorisation, c'est la réglementation algérienne (Loi 18-11) qui prévaut (Comité d'éthique médicale local et autorisation écrite du Ministère de la Santé).
4. Réponds en français.`;
    }

    // Trouver le premier message de l'utilisateur pour démarrer la conversation Gemini avec un rôle 'user'
    const firstUserIdx = messages.findIndex((m: any) => m.role === 'user');
    const conversationMessages = firstUserIdx !== -1 ? messages.slice(firstUserIdx) : messages;

    // Conversion des messages pour l'API Gemini
    const contents = conversationMessages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    let response;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.5, // Plus bas pour plus de fidélité et moins d'hallucinations
          }
        });
        break; // Succès
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée pour generateContent (Chat):`, err.message || err);
        if (attempt >= maxAttempts) throw err;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    const replyText = response?.text || "Désolé, je n'ai pas pu générer de réponse.";
    return NextResponse.json({ text: replyText });

  } catch (error: any) {
    console.error('Erreur API Chat:', error);
    const status = error.status || error.statusCode || 500;
    let userMessage = 'Erreur interne du serveur lors du traitement de la requête.';

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
