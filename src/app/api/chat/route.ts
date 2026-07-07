import { NextResponse } from 'next/server';
import { callLLMChat } from '@/utils/llm';
import { loadEnvLocal } from '@/utils/env';
import { verifyUserAuth } from '@/utils/firebase-admin';
import recifKb from '@/data/recif-kb.json';
import glossaryData from '@/data/glossary.json';
import fs from 'fs';
import path from 'path';

class EmbeddingPipeline {
  static task = 'feature-extraction' as const;
  static model = 'Xenova/multilingual-e5-base';
  static instance: any = null;
  static unavailable = false;

  static async getInstance() {
    if (this.unavailable) throw new Error("skip");
    if (this.instance === null) {
      if (process.env.VERCEL === '1') {
        throw new Error("Recherche sémantique locale désactivée sur Vercel (production).");
      }
      const modelPath = path.join(process.cwd(), 'node_modules/@xenova/transformers/models/Xenova/multilingual-e5-base/tokenizer.json');
      if (!fs.existsSync(modelPath)) {
        this.unavailable = true;
        throw new Error("skip");
      }
      try {
        const { pipeline, env } = await import('@xenova/transformers');
        env.allowRemoteModels = false;
        this.instance = await pipeline(this.task, this.model);
      } catch (err) {
        this.unavailable = true;
        throw err;
      }
    }
    return this.instance;
  }
}

async function getLocalQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    const extractor = await EmbeddingPipeline.getInstance();
    const textToEmbed = `query: ${query}`;
    const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch {
    return null;
  }
}

interface EmbeddedChunk {
  doc?: string;
  page: number;
  text: string;
  embedding: number[];
}

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

function getSnippet(text: string, keywords: string[], maxLen = 450): string {
  const textLower = text.toLowerCase();
  let firstPos = -1;
  keywords.forEach(keyword => {
    const pos = textLower.indexOf(keyword);
    if (pos !== -1 && (firstPos === -1 || pos < firstPos)) {
      firstPos = pos;
    }
  });
  if (firstPos === -1) {
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }
  const start = Math.max(0, firstPos - 80);
  const end = Math.min(text.length, start + maxLen);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function generateDynamicQuestions(subject: string): string {
  const capitalized = subject.charAt(0).toUpperCase() + subject.slice(1);
  return `💡 **Exemples de questions de recherche (Critères FINE & PICOT) sur : "${capitalized}"**

1. **Essai Clinique Randomisé Contrôlé (ECR) :**
   * **Question :** L'ajout d'une nouvelle prise en charge thérapeutique ou éducative par rapport à la prise en charge standard permet-il d'améliorer significativement le critère principal après 6 mois de suivi chez les patients atteints de **${subject}** ?
   * **Critère (O) :** Évaluation objective (ex: taux biologique, score de contrôle).
   
2. **Étude de Cohorte (prospective) :**
   * **Question :** Est-ce que l'exposition à un facteur de risque spécifique double l'incidence des complications de long terme chez les sujets suivis pour **${subject}** ?
   * **Facteur (I) :** Présence ou absence d'un biomarqueur ou comportement à risque.

3. **Étude Cas-Témoins (rétrospective) :**
   * **Question :** Quels sont les antécédents ou expositions environnementales associés à la survenue d'un **${subject}** précoce ou sévère chez les patients admis en service de soins ?
   * **Comparaison :** Cas (sévère/précoce) vs Témoins (indemnes/légers).`;
}

function generateDynamicProtocol(subject: string): string {
  const capitalized = subject.charAt(0).toUpperCase() + subject.slice(1);
  return `📝 **Trame de Protocole RECIF (Mode Hors-ligne) sur : "${capitalized}"**

*Rubriques clés à rédiger pour structurer votre étude :*

* **Titre :** Évaluation de [Intervention] chez les patients atteints de **${subject}**.
* **Objectif Principal :** Démontrer l'impact de l'intervention sur le critère d'évaluation principal chez les sujets ayant un **${subject}**.
* **Schéma préconisé :** Essai contrôlé randomisé ou cohorte prospective selon les ressources.
* **Critère de Jugement Principal :** Critère clinique unique et objectivement mesurable.
* **Inclusion :** Patients diagnostiqués de **${subject}**, âge >= 18 ans, consentement signé.
* **Éthique (Loi 18-11) :** Avis favorable du Comité d'éthique médicale obligatoire avant tout lancement.`;
}

function searchOfflineChunks(queryText: string, chunks: EmbeddedChunk[]): { doc?: string; page: number; text: string; score: number }[] {
  const cleanQuery = queryText.toLowerCase().replace(/[''']/g, ' ');
  const rawWords = cleanQuery.split(/[^a-z0-9àâäéèêëîïôöùûüç]+/);
  const stopWords = new Set([
    'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'est', 'sont', 
    'pour', 'dans', 'sur', 'par', 'avec', 'qui', 'que', 'comment', 'pourquoi', 
    'quelles', 'quels', 'quelle', 'quel', 'est-ce', 'ce', 'ces', 'cette', 'je', 
    'tu', 'il', 'nous', 'vous', 'ils', 'elles', 'se', 'sa', 'son', 'ses', 'a', 'au', 'aux',
    'qu', 'es', 'un', 'une', 'est', 'ont', 'aux', 'pas', 'plus', 'avec', 'sans', 'dans'
  ]);
  const keywords = rawWords.filter(w => w.length > 2 && !stopWords.has(w));
  if (keywords.length === 0) return [];
  const scored = chunks.map(chunk => {
    const chunkLower = chunk.text.toLowerCase();
    const chunkWords = chunkLower.split(/[^a-z0-9àâäéèêëîïôöùûüç]+/);
    let score = 0;
    let uniqueMatches = 0;
    keywords.forEach(keyword => {
      let count = 0;
      for (const word of chunkWords) {
        if (word === keyword) count++;
      }
      if (count > 0) {
        uniqueMatches++;
        score += count * (keyword.length * 5);
      }
    });
    if (uniqueMatches > 1) score *= (1 + (uniqueMatches - 1) * 1.5);
    keywords.forEach((keyword, idx) => {
      if (idx < keywords.length - 1) {
        const nextKeyword = keywords[idx + 1];
        if (chunkLower.includes(`${keyword} ${nextKeyword}`)) score += 50;
      }
    });
    return { doc: chunk.doc, page: chunk.page, text: chunk.text, score };
  });
  return scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score);
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

async function tryOllamaChat(messages: any[], systemInstruction: string, ollamaUrl: string, ollamaModel: string): Promise<string | null> {
  try {
    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...messages.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    ];
    console.log(`🤖 Tentative d'appel à Ollama (${ollamaModel}) sur ${ollamaUrl}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 150000);
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, messages: formattedMessages, stream: false, options: { temperature: 0.5 } }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return data.message?.content || null;
  } catch (error: any) {
    if (error.name === 'AbortError') console.warn('⚠️ Requête vers Ollama abandonnée (Timeout).');
    else console.warn('⚠️ Échec de la connexion à Ollama:', error.message || error);
    return null;
  }
}

async function getLocalContextForLLM(queryText: string): Promise<{ context: string; source: string }> {
  let context = '';
  let source = '';
  const queryLower = queryText.toLowerCase();

  const glossaryKeys: { [key: string]: keyof typeof glossaryData } = {
    'selection': 'biais_de_selection', 'séléction': 'biais_de_selection', 'confusion': 'biais_de_confusion',
    'mesure': 'biais_de_mesure', 'observation': 'biais_de_mesure', 'information': 'biais_de_mesure',
    'alpha': 'erreur_alpha', 'première espèce': 'erreur_alpha', 'premiere espece': 'erreur_alpha',
    'beta': 'erreur_beta', 'bêta': 'erreur_beta', 'deuxième espèce': 'erreur_beta', 'deuxieme espece': 'erreur_beta',
    'nsn': 'nsn', 'sujets nécessaires': 'nsn', 'sujets necessaires': 'nsn', 'sujet necessaire': 'nsn',
    "taille d'échantillon": 'nsn', "taille d'echantillon": 'nsn', 'puissance': 'puissance_statistique',
    'randomisation': 'randomisation', 'randomise': 'randomisation', 'aveugle': 'insu', 'insu': 'insu',
    'double insu': 'insu', 'cohorte': 'cohorte', 'cas-témoin': 'cas_temoins', 'cas-temoin': 'cas_temoins',
    'cas témoin': 'cas_temoins', 'cas temoin': 'cas_temoins', 'transversale': 'transversale', 'transversal': 'transversale',
    'jugement': 'critere_jugement', 'critère principal': 'critere_jugement', 'critere principal': 'critere_jugement',
    'essai': 'essai_clinique', 'interventionnel': 'essai_clinique'
  };

  let matchedGlossaryKey: keyof typeof glossaryData | null = null;
  for (const keyword in glossaryKeys) {
    if (queryLower.includes(keyword)) { matchedGlossaryKey = glossaryKeys[keyword]; break; }
  }

  if (matchedGlossaryKey) {
    const entry = glossaryData[matchedGlossaryKey];
    context += `[Glossaire RECIF] Concept : ${entry.title}\nDéfinition : ${entry.definition}\nDétails :\n${entry.details.join('\n')}\n\n`;
    source = `Glossaire (${entry.title})`;
  }

  const isReqRegulation = queryLower.includes('loi 18-11') || queryLower.includes('reglementation') || queryLower.includes('algerie') || queryLower.includes('minist') || queryLower.includes('penal') || queryLower.includes('amende') || queryLower.includes('prison') || queryLower.includes('sanction') || queryLower.includes('autorisation') || queryLower.includes('ethique');
  if (isReqRegulation) {
    context += `[Réglementation Algérienne - Loi n° 18-11 relative à la santé]\nObligations principales :\n${recifKb.algerian_regulation.key_requirements.map((r: string) => `- ${r}`).join('\n')}\nComité éthique : ${recifKb.algerian_regulation.ethics_committee}\nAutorisation ministérielle : ${recifKb.algerian_regulation.ethics_committee}\nPénalités :\n- Étude sans autorisation: ${recifKb.algerian_regulation.penalties.unauthorized_study}\n- Sans consentement écrit: ${recifKb.algerian_regulation.penalties.no_consent}\n\n`;
    source = source ? `${source} + Réglementation` : 'Réglementation Algérienne';
  }

  let matchedChunks: { page: number; text: string; similarity: number; doc?: string }[] = [];
  let usedSemanticSearch = false;

  if (recifEmbeddings && recifEmbeddings.length > 0) {
    const queryVector = await getLocalQueryEmbedding(queryText);
    if (queryVector) {
      const scoredChunks = recifEmbeddings.map(chunk => ({ page: chunk.page, text: chunk.text, doc: chunk.doc, similarity: getCosineSimilarity(queryVector, chunk.embedding) }));
      matchedChunks = scoredChunks.sort((a, b) => b.similarity - a.similarity).slice(0, 4);
      usedSemanticSearch = true;
    } else {
      const kwMatches = searchOfflineChunks(queryText, recifEmbeddings);
      matchedChunks = kwMatches.slice(0, 4).map(c => ({ page: c.page, text: c.text, doc: c.doc, similarity: c.score }));
    }
  }

  if (matchedChunks.length > 0) {
    context += `[Extraits pertinents des documents de référence]\n`;
    const topPassages = matchedChunks.slice(0, 3);
    topPassages.forEach((chunk) => {
      const docName = chunk.doc || "Manuel RECIF";
      context += `Document: ${docName}, Page ${chunk.page} : "${chunk.text}"\n\n`;
    });
    source = source ? `${source} + Extraits du manuel (${usedSemanticSearch ? 'sémantique' : 'mots-clés'})` : `Extraits de référence (${usedSemanticSearch ? 'sémantique' : 'mots-clés'})`;
  }

  if (!context) {
    context = `[Présentation Générale du manuel RECIF]\nLe RECIF est le manuel officiel de méthodologie de recherche clinique (Conception, Rédaction, Faisabilité). Il traite des schémas d'études (Essais randomisés, Cohortes, Cas-témoins, Transversales), du calcul de taille d'échantillon (NSN), des biais (sélection, mesure, confusion), de la déontologie et de la rédaction du protocole.`;
    source = 'Présentation générale';
  }

  return { context, source };
}

function buildOfflineResponse(queryText: string, notePrefix: string): string {
  let reply = notePrefix + "\n\n";
  const queryLower = queryText.toLowerCase();

  const glossaryKeys: { [key: string]: keyof typeof glossaryData } = {
    'selection': 'biais_de_selection', 'séléction': 'biais_de_selection', 'confusion': 'biais_de_confusion',
    'mesure': 'biais_de_mesure', 'observation': 'biais_de_mesure', 'information': 'biais_de_mesure',
    'alpha': 'erreur_alpha', 'première espèce': 'erreur_alpha', 'premiere espece': 'erreur_alpha',
    'beta': 'erreur_beta', 'bêta': 'erreur_beta', 'deuxième espèce': 'erreur_beta', 'deuxieme espece': 'erreur_beta',
    'nsn': 'nsn', 'sujets nécessaires': 'nsn', 'sujets necessaires': 'nsn', 'sujet necessaire': 'nsn',
    'taille d’échantillon': 'nsn', "taille d'echantillon": 'nsn', 'puissance': 'puissance_statistique',
    'randomisation': 'randomisation', 'randomise': 'randomisation', 'aveugle': 'insu', 'insu': 'insu',
    'double insu': 'insu', 'cohorte': 'cohorte', 'cas-témoin': 'cas_temoins', 'cas-temoin': 'cas_temoins',
    'cas témoin': 'cas_temoins', 'cas temoin': 'cas_temoins', 'transversale': 'transversale', 'transversal': 'transversale',
    'jugement': 'critere_jugement', 'critère principal': 'critere_jugement', 'critere principal': 'critere_jugement',
    'essai': 'essai_clinique', 'interventionnel': 'essai_clinique'
  };

  let matchedGlossaryKey: keyof typeof glossaryData | null = null;
  for (const keyword in glossaryKeys) {
    if (queryLower.includes(keyword)) { matchedGlossaryKey = glossaryKeys[keyword]; break; }
  }

  if (matchedGlossaryKey) {
    const entry = glossaryData[matchedGlossaryKey];
    reply += `📖 **Définition & Explications du Manuel RECIF sur : "${entry.title}"**\n\n${entry.definition}\n\n`;
    entry.details.forEach(line => { reply += `${line}\n`; });
    return reply;
  }
  
  const isQuestionRequest = queryLower.includes('propose') || queryLower.includes('donne') || queryLower.includes('suggere') || queryLower.includes('exemple') || queryLower.includes('trouve') || queryLower.includes('creer') || queryLower.includes('cree') || queryLower.includes('invente') || queryLower.includes('formule');
  const isProtocolRequest = queryLower.includes('protocole') && (queryLower.includes('gener') || queryLower.includes('exemp') || queryLower.includes('redig') || queryLower.includes('ecret'));
  const commonSubjects = ['diabete', 'diabète', 'hypertension', 'cancer', 'asthme', 'cardiopathie', 'insuffisance', 'corona', 'obesite', 'obésité', 'grossesse', 'covid', 'tuberculose', 'hepatite', 'hépatite'];
  let detectedSubject = '';
  for (const sub of commonSubjects) { if (queryLower.includes(sub)) { detectedSubject = sub; break; } }
  if (!detectedSubject && isQuestionRequest) {
    const words = queryLower.split(/\s+/);
    const indexSur = words.lastIndexOf('sur');
    if (indexSur !== -1 && indexSur < words.length - 1) detectedSubject = words.slice(indexSur + 1).join(' ');
  }

  if (isQuestionRequest && detectedSubject) return reply + generateDynamicQuestions(detectedSubject);
  if (isProtocolRequest && detectedSubject) return reply + generateDynamicProtocol(detectedSubject);

  const isReqRegulation = queryLower.includes('loi 18-11') || queryLower.includes('reglementation') || queryLower.includes('algerie') || queryLower.includes('minist') || queryLower.includes('penal') || queryLower.includes('amende') || queryLower.includes('prison') || queryLower.includes('sanction') || queryLower.includes('autorisation') || queryLower.includes('ethique');
  if (isReqRegulation) {
    reply += `🛡️ **Réglementation Algérienne (Loi n° 18-11 relative à la santé) :**\nSelon la loi algérienne en vigueur, toute recherche clinique est encadrée par des obligations strictes :\n`;
    recifKb.algerian_regulation.key_requirements.forEach(req => { reply += `- ${req}\n`; });
    reply += `\n**Organes décisionnels :**\n- **${recifKb.algerian_regulation.ethics_committee}**\n- **${recifKb.algerian_regulation.ministry_authorization}**\n\n**Sanctions pénales en cas de non-respect :**\n- *Étude sans autorisation :* ${recifKb.algerian_regulation.penalties.unauthorized_study}\n- *Étude sans consentement écrit :* ${recifKb.algerian_regulation.penalties.no_consent}\n\n`;
    return reply;
  }
  
  let matchedChunks: any[] = [];
  if (recifEmbeddings && recifEmbeddings.length > 0) matchedChunks = searchOfflineChunks(queryText, recifEmbeddings);
  const cleanQuery = queryText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ');
  const rawWords = cleanQuery.split(/\s+/);
  const stopWords = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'est', 'sont', 'pour', 'dans', 'sur', 'par', 'avec', 'qui', 'que', 'comment', 'pourquoi', 'quelles', 'quels', 'quelle', 'quel', 'est-ce', 'ce', 'ces', 'cette', 'je', 'tu', 'il', 'nous', 'vous', 'ils', 'elles', 'se', 'sa', 'son', 'ses', 'a', 'au', 'aux']);
  const keywords = rawWords.filter(w => w.length > 1 && !stopWords.has(w));
  
  if (matchedChunks.length > 0) {
    reply += `📖 **Extraits ciblés des documents de référence (Recherche locale) :**\n\n`;
    const topPassages = matchedChunks.slice(0, 2);
    topPassages.forEach((chunk) => {
      const snippet = getSnippet(chunk.text, keywords, 450);
      const docName = chunk.doc || "Manuel RECIF";
      reply += `*${docName}, Page ${chunk.page} :*\n> "${snippet}"\n\n`;
    });
  } else {
    reply += `💡 **Synthèse Méthodologique Générale :**\n\n`;
    if (queryLower.includes('schema') || queryLower.includes('cohor') || queryLower.includes('cas-temoin') || queryLower.includes('essai')) {
      reply += `**Schémas d'étude principaux :**\n1. **Essai Clinique Randomisé Contrôlé (ECR) :** Permet de prouver la causalité en réduisant les biais de sélection.\n2. **Étude de Cohorte (prospective/rétrospective) :** Pour suivre des sujets exposés vs non-exposés dans le temps.\n3. **Étude Cas-Témoins (rétrospective) :** Idéale pour les maladies rares en comparant des malades (cas) à des sujets sains (témoins).\n4. **Étude Transversale :** Pour mesurer la prévalence à un instant T.\n\n`;
    } else if (queryLower.includes('stat') || queryLower.includes('nombre') || queryLower.includes('sujet') || queryLower.includes('nsn') || queryLower.includes('puissance')) {
      reply += `**Calcul du Nombre de Sujets Nécessaires (NSN) :**\nSelon la méthodologie statistique du RECIF, le calcul du NSN dépend de :\n- Le type de critère de jugement principal (quantitatif ou qualitatif).\n- La différence attendue cliniquement pertinente (effet attendu).\n- Le risque d'erreur alpha (généralement 5%).\n- La puissance statistique désirée (1 - bêta, généralement 80% ou 90%).\n- La variabilité attendue du critère (écart-type).\n\n`;
    } else if (queryLower.includes('objectif') || queryLower.includes('critere') || queryLower.includes('jugement')) {
      reply += `**Objectifs & Critère de Jugement :**\n- **Objectif Principal :** Répond à une question unique et claire (ex: supériorité d'un nouveau traitement).\n- **Critère de Jugement Principal (Endpoint) :** Mesure quantitative ou qualitative qui permet d'évaluer directement l'objectif principal. Il doit être unique, mesurable et cliniquement pertinent.\n- **Objectifs/Critères Secondaires :** Évaluent d'autres paramètres (tolérance, qualité de vie).\n\n`;
    } else if (queryLower.includes('fine') || queryLower.includes('question') || queryLower.includes('hypoth')) {
      reply += `**Critères FINE pour une bonne question de recherche :**\n- **Faisable :** ${recifKb.fine_criteria.faisable}\n- **Intéressante :** ${recifKb.fine_criteria.interessante}\n- **Nouvelle :** ${recifKb.fine_criteria.nouvelle}\n- **Éthique :** ${recifKb.fine_criteria.ethique}\n\n`;
    } else {
      reply += `Je peux vous aider à concevoir votre protocole de recherche clinique en suivant les recommandations du manuel RECIF. Vous pouvez me poser des questions sur :\n1. Les **catégories de recherche** et aspects réglementaires algériens (Loi 18-11).\n2. Les **schémas d'étude** (Cohorte, Cas-Témoins, Essais randomisés).\n3. Les **critères de jugement** et la formulation de la question de recherche.\n4. Le **calcul de taille d'échantillon** et les notions statistiques (erreur alpha, puissance).\n5. Les aspects **éthiques et d'autorisation** en Algérie.\n\n`;
    }
  }
  return reply;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutMs); });
  try { return await Promise.race([promise, timeoutPromise]); } finally { clearTimeout(timeoutId); }
}

function getSystemInstruction(mode: string, context: string, hasRAG: boolean): string {
  const isProtocol = mode === 'protocol';
  const isStrobe = mode === 'strobe';
  
  let basePrompt = '';
  if (isProtocol) {
    basePrompt = `Tu es un tuteur expert en méthodologie de recherche clinique en ligne, spécialisé dans l'accompagnement pas-à-pas pour la création d'un protocole selon le manuel RECIF, la loi algérienne 18-11 relative à la santé, et la Ligne Directrice pour la Conduite des Études Cliniques en Algérie (Version 2, 28/12/2025).
Ton but est de guider l'étudiant de manière itérative, une seule étape après l'autre, pour concevoir et valider son protocole.
Les 5 étapes de ton accompagnement sont :
1. Identité & Règles (Titre complet de l'étude, Acronyme, méthodologie: interventionnel/observationnel, type de bénéfice attendu: direct/sans bénéfice direct).
2. Objectifs & Schéma (Question de recherche principale, Justification, Objectifs secondaires, Hypothèse de recherche nulle H0 et alternative H1, Schéma d'étude préconisé/Design, Description de l'intervention).
3. Critères & Population (Population cible, Inclusion, Exclusion, Critère de jugement principal et secondaires, Biais de recherche et facteurs de confusion).
4. Logistique, Budget & Calendrier (Récolte des données, Personnel et rôles, Budget et Financement, Calendrier prévisionnel).
5. Éthique & Références (Considérations éthiques supplémentaires comme CPP/consentement écrit/anonymat, Références bibliographiques, Annexes prévues).

Règles de comportement fondamentales pour le mode Accompagnement Projet :
- Ne pose pas toutes les questions en même temps. Sois concis. Guide l'utilisateur étape par étape. Valide une étape avec lui avant de passer à la suivante.
- Dès que TOUS les points requis sont abordés et validés par l'étudiant, ou s'il te demande explicitement de finaliser la synthèse pour l'envoyer au générateur, tu DOIS générer un bloc de synthèse finale contenant exactement le format XML suivant.
- ATTENTION : Tu dois générer ce bloc exact à la toute fin de ton message. Remplis les champs avec les données méthodologiques réelles convenues ensemble dans la discussion (laisse les chaînes vides "" si non spécifié) :

<params_synthese>
{
  "title": "Titre complet de l'étude",
  "acronym": "Acronyme de l'étude (ou '')",
  "methodology": "interventional" ou "observational",
  "benefitType": "bid" ou "sbid",
  "question": "La question de recherche principale",
  "design": "Le schéma de l'étude (ex: Essai Clinique Randomisé Contrôlé (ECR))",
  "intervention": "Description de l'intervention ou de l'exposition",
  "population": "La population cible étudiée",
  "inclusion": "Les critères d'inclusion principaux (séparés par des retours à la ligne)",
  "exclusion": "Les critères d'exclusion principaux (séparés par des retours à la ligne)",
  "primaryEndpoint": "Le critère de jugement principal",
  "secondaryEndpoints": "Les critères de jugement secondaires",
  "objectives": "Les objectifs secondaires de l'étude",
  "bias": "Les biais de recherche et contrôles",
  "justification": "Justification scientifique de l'étude",
  "hypothesis": "Hypothèse(s) de recherche (H0 et H1)",
  "logistics": "Logistique et récolte de données",
  "personnel": "Personnel et rôles",
  "budget": "Budget et financement",
  "calendar": "Calendrier prévisionnel",
  "ethics": "Considérations éthiques (ex: CPP, consentement, Loi 18-11)",
  "references": "Références clés",
  "annexes": "Annexes prévues"
}
</params_synthese>`;
  } else if (isStrobe) {
    basePrompt = `Tu es un tuteur expert en méthodologie de recherche clinique en ligne, spécialisé dans l'accompagnement pas-à-pas pour la rédaction d'un article scientifique selon les critères de la grille d'évaluation STROBE (Strengthening the Reporting of Observational Studies in Epidemiology).
Ton but est de guider l'étudiant de manière itérative, une seule étape après l'autre, pour structurer et valider les informations requises pour rédiger son article scientifique (études observationnelles : cohortes, cas-témoins et transversales).

Les 6 grandes sections de ton accompagnement sont :
1. Titre & Résumé (Titre indiquant le schéma de l'étude, résumé structuré - Critères 1-2).
2. Introduction (Contexte/justification, objectifs spécifiques et hypothèses - Critères 3-4).
3. Méthodes (Schéma de l'étude, cadre/dates/lieux, participants et critères d'éligibilité, variables étudiées, sources de données, méthodes de mesure, biais, taille de l'étude, variables quantitatives, méthodes statistiques - Critères 5-12).
4. Résultats (Flux de participants, caractéristiques descriptives, données sur les variables d'exposition, critères d'évaluation principaux, autres analyses secondaires - Critères 13-17).
5. Discussion (Résultats clés, limites de l'étude, interprétation globale prudente, généralisabilité - Critères 18-21).
6. Financement (Sources de financement et rôle des financeurs - Critère 22).

Règles de comportement fondamentales pour le mode Accompagnement STROBE :
- Ne pose pas toutes les questions en même temps. Sois concis. Guide l'utilisateur étape par étape. Valide une étape avec lui avant de passer à la suivante.
- Dès que TOUS les points requis sont abordés et validés par l'étudiant, ou s'il te demande explicitement de finaliser la synthèse pour l'envoyer au générateur d'articles, tu DOIS générer un bloc de synthèse finale contenant exactement le format XML suivant.
- ATTENTION : Tu dois générer ce bloc exact à la toute fin de ton message. Remplis les champs avec les données méthodologiques réelles convenues ensemble dans la discussion (laisse les chaînes vides "" si non spécifié) :

<params_strobe>
{
  "title": "Titre complet de l'article",
  "studyType": "cohort" ou "case-control" ou "cross-sectional",
  "abstract": "Résumé structuré de l'article",
  "rationale": "Contexte scientifique et justification",
  "objectives": "Objectifs spécifiques et hypothèses",
  "design": "Schéma de l'étude",
  "setting": "Cadre de l'étude (dates, lieux, recrutement)",
  "participants": "Sélection des participants et critères d'éligibilité",
  "variables": "Variables étudiées",
  "dataSources": "Sources des données et méthodes de mesure",
  "bias": "Biais et contrôles",
  "studySize": "Taille de l'étude (comment l'échantillon a été calculé)",
  "quantitativeVariables": "Traitement des variables quantitatives dans les analyses",
  "statisticalMethods": "Méthodes statistiques utilisées",
  "participantsFlow": "Flux de participants (diagramme de flux)",
  "descriptiveData": "Données descriptives des participants",
  "outcomeData": "Mesures de résumé / critères de jugement principaux",
  "mainResults": "Résultats principaux et précision (IC)",
  "otherAnalyses": "Analyses secondaires (sous-groupes, sensibilité)",
  "keyResults": "Résultats clés en lien avec les objectifs",
  "limitations": "Limites de l'étude (biais, imprécisions)",
  "interpretation": "Interprétation globale prudente",
  "generalisability": "Généralisabilité des résultats",
  "funding": "Sources de financement"
}
</params_strobe>`;
  } else {
    basePrompt = `Tu es un tuteur expert en méthodologie de recherche clinique en ligne, spécialisé dans le manuel français "RECIF" (Recherche Clinique et Épidémiologique : Conception, Rédaction, Faisabilité), la réglementation algérienne (Loi n° 18-11 du 2 juillet 2018 relative à la santé) et la Ligne Directrice pour la Conduite des Études Cliniques en Algérie (Version 02 du 28/12/2025).
Ton but est d'aider les étudiants, chercheurs et cliniciens à concevoir et rédiger leurs protocoles de recherche de manière rigoureuse et conforme aux normes internationales et algériennes.`;
  }

  const ragPrompt = hasRAG 
    ? `\n\nPour répondre à la question de l'utilisateur, tu DOIS utiliser en priorité absolue les extraits suivants de tes documents de référence officiels, qui ont été extraits par recherche sémantique vectorielle :
\n--- EXTRAITS PERTINENTS DES DOCUMENTS DE RÉFÉRENCE ---\n${context}\n-------------------------------------------\n
Règles d'utilisation du contexte :
1. Analyse chirurgicalement les extraits fournis pour formuler ta réponse.
2. Pour CHAQUE fait important, recommandation ou citation tirée d'un document, mentionne obligatoirement sa source et la page de manière claire, sous la forme "[Document: Nom, Page X]" (par exemple : "Selon la Ligne Directrice [Document: Ligne Directrice..., Page 12]").
3. Si les extraits ne sont pas suffisants pour répondre complètement, tu peux utiliser tes connaissances générales sur le RECIF ou sur la réglementation algérienne, mais indique clairement quand une information ne provient pas directement des documents de référence fournis.`
    : `\n\nVoici des extraits de la base de connaissances à utiliser pour guider tes réponses :\n${context}`;

  const footerPrompt = `\n\nInstructions de réponse communes :
1. Reste toujours rigoureux, professionnel, structuré et bienveillant.
2. Rédige ta réponse entièrement en français, claire et structurée en Markdown.
3. Intègre de manière transparente les références de la réglementation algérienne (Loi n° 18-11 relative à la santé, Lignes Directrices pour la conduite des études cliniques en Algérie) si la question porte sur les aspects éthiques, de consentement, réglementaires ou administratifs. Rappelle que le Ministère de la Santé algérien et un comité d'éthique local sont compétents.
4. N'utilise JAMAIS de syntaxe ou de formatage LaTeX, que ce soit en bloc (\`$$...$$\`) ou en ligne (comme des expressions entourées de \`$\` ou des balises comme \`\\(...\\)\`), pour les formules, variables ou symboles mathématiques. Écris-les TOUJOURS en texte brut clair et lisible avec des caractères standards (ex : écris "p" au lieu de "p", "±" au lieu de "±", "(1-p)" au lieu de "(1-p)", "d = 0.05" au lieu de "d = 0.05", et "n = (Z² * p * (1-p)) / d²").`;

  return `${basePrompt}${ragPrompt}${footerPrompt}`;
}

export async function POST(req: Request) {
  loadEnvLocal();

  // Validation de sécurité (vérification de l'authentification et de la non-suspension)
  const authCheck = await verifyUserAuth(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  let messages: any[] = [];
  let headerOllamaModel: string | null = null;
  try {
    const body = await req.json();
    messages = body.messages;
    const mode = body.mode || 'free';

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages format invalide.' }, { status: 400 });
    }

    const requestHeaders = new Headers(req.headers);
    headerOllamaModel = requestHeaders.get('x-ollama-model');
    const preferredProvider = requestHeaders.get('x-ai-provider') || 'openrouter';
    const apiKey = preferredProvider === 'ollama' ? null : process.env.OPENROUTER_API_KEY;
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma2:2b';

    // Fallback si la clé API n'est pas configurée
    if (!apiKey) {
      const localContext = await getLocalContextForLLM(lastUserMessage);
      const systemInstruction = getSystemInstruction(mode, localContext.context, true);
      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      const activeModel = resolvedModel || ollamaModel;
      const ollamaReply = await tryOllamaChat(messages, systemInstruction, ollamaUrl, activeModel);
      
      if (ollamaReply) {
        const notePrefix = `Bonjour ! Je suis votre tuteur virtuel RECIF.\n\n🤖 *Note : Réponse générée localement par l'IA (${activeModel}) via Ollama (basée sur : ${localContext.source}) :*\n\n`;
        return NextResponse.json({ text: notePrefix + ollamaReply });
      }

      const notePrefix = "Bonjour ! Je suis votre tuteur virtuel RECIF.\n\n⚠️ *Note : La clé API `OPENROUTER_API_KEY` n'est pas configurée et aucun service local Ollama n'a été détecté.* Pour tester le tuteur connecté avec RAG et recherche vectorielle en temps réel, veuillez ajouter votre clé. En attendant, voici une réponse basée sur notre base de connaissances intégrée :";
      const mockReply = buildOfflineResponse(lastUserMessage, notePrefix);
      return NextResponse.json({ text: mockReply });
    }

    const lastUserMessageObj = messages.filter((m: any) => m.role === 'user').slice(-1)[0];
    const userQuery = lastUserMessageObj ? lastUserMessageObj.content : '';

    let contextString = '';
    let hasRAG = false;

    // RAG Local avec E5
    if (recifEmbeddings.length > 0 && userQuery) {
      try {
        console.log(`🔍 Génération de l'embedding local pour la requête : "${userQuery.substring(0, 50)}..."`);
        const queryVector = await getLocalQueryEmbedding(userQuery);

        if (queryVector) {
          const scoredChunks = recifEmbeddings.map(chunk => ({
            doc: chunk.doc, page: chunk.page, text: chunk.text,
            similarity: getCosineSimilarity(queryVector, chunk.embedding)
          }));

          const topChunks = scoredChunks.sort((a, b) => b.similarity - a.similarity).slice(0, 4);

          console.log(`🎯 [RAG Local] Top 4 segments trouvés (Similitudes max: ${topChunks[0]?.similarity.toFixed(4)}) :`);
          topChunks.forEach((c, idx) => {
            const docName = c.doc || "Manuel RECIF";
            console.log(`   [${idx + 1}] ${docName}, Page ${c.page} (Sim: ${c.similarity.toFixed(4)}) : "${c.text.substring(0, 60)}..."`);
          });

          contextString = topChunks.map(c => `[Document: ${c.doc || 'Manuel RECIF'}, Page ${c.page}] : "${c.text}"`).join('\n\n');
          hasRAG = true;
        }
      } catch (err) {
        console.error('❌ Échec de la recherche vectorielle (RAG):', err);
      }
    }

    const systemInstruction = getSystemInstruction(mode, hasRAG ? contextString : JSON.stringify(recifKb, null, 2), hasRAG);

    const firstUserIdx = messages.findIndex((m: any) => m.role === 'user');
    const conversationMessages = firstUserIdx !== -1 ? messages.slice(firstUserIdx) : messages;

    // --- APPEL OPENROUTER (QWEN / GLM) ---
    console.log(`🤖 [Chat API] Appel à OpenRouter (QWEN/GLM)...`);
    const replyText = await withTimeout(
      callLLMChat(systemInstruction, conversationMessages, {
        provider: "qwen-flash", // Change en "glm-5" si tu préfères GLM
        temperature: 0.5
      }),
      120000
    );
    console.log(`✅ [Chat API] Réponse obtenue avec succès via OpenRouter`);
    
    return NextResponse.json({ text: replyText });

  } catch (error: any) {
    console.error('Erreur API Chat, bascule vers le mode de secours local:', error);
    
    try {
      const lastUserMessageObj = messages.filter((m: any) => m.role === 'user').slice(-1)[0];
      const userQuery = lastUserMessageObj ? lastUserMessageObj.content : '';
      const mode = 'free'; 

      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma2:2b';

      const localContext = await getLocalContextForLLM(userQuery);
      const systemInstruction = getSystemInstruction(mode, localContext.context, true);

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      const activeModel = resolvedModel || ollamaModel;
      const ollamaReply = await tryOllamaChat(messages, systemInstruction, ollamaUrl, activeModel);
      
      if (ollamaReply) {
        const notePrefix = `Bonjour ! Je suis votre tuteur virtuel RECIF.\n\n🤖 *Note : Impossible de joindre le service d'IA externe. L'application a basculé automatiquement sur votre IA locale (${activeModel}) via Ollama (basée sur : ${localContext.source}) :*\n\n`;
        return NextResponse.json({ text: notePrefix + ollamaReply });
      }

      const notePrefix = `Bonjour ! Je suis votre tuteur virtuel RECIF.\n\n⚠️ *Note : Impossible de joindre le service d'IA externe (appareil hors-ligne ou limite de requêtes atteinte). (Détails : ${error.message || String(error)})* Voici une réponse issue de notre base de connaissances locale :`;
      const mockReply = buildOfflineResponse(userQuery, notePrefix);
      return NextResponse.json({ text: mockReply });
    } catch (fallbackErr) {
      let numericStatus = 500;
      if (error && typeof error.status === 'number' && error.status >= 400 && error.status < 600) numericStatus = error.status;
      else if (error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600) numericStatus = error.statusCode;
      
      let userMessage = 'Erreur interne du serveur lors du traitement de la requête.';
      if (numericStatus === 429) userMessage = 'Limite de requêtes d\'IA atteinte (Rate Limit). Veuillez patienter une minute avant de réessayer.';
      else if (numericStatus === 503 || numericStatus === 504) userMessage = 'Le service d\'IA est temporairement surchargé. Veuillez réessayer dans quelques instants.';
      else if (error && error.message) userMessage = `Erreur : ${error.message}`;

      return NextResponse.json({ error: userMessage }, { status: numericStatus });
    }
  }
}

