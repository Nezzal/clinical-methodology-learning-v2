import { NextResponse } from 'next/server';
import { verifyUserAuth } from '@/utils/firebase-admin';
import { callLLM } from '@/utils/llm';

async function tryOllamaMeshQuery(
  systemPrompt: string,
  userMessage: string,
  ollamaUrl: string,
  ollamaModel: string
): Promise<string | null> {
  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.message?.content?.trim() || null;
  } catch (err) {
    console.warn('⚠️ Échec de l\'appel Ollama local pour MeSH:', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await verifyUserAuth(req);
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { question, modelProvider = 'openrouter', selectedModel } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { error: 'La question en langage naturel est requise.' },
        { status: 400 }
      );
    }

    const requestHeaders = new Headers(req.headers);
    const headerProvider = requestHeaders.get('x-ai-provider');
    const headerOllamaModel = requestHeaders.get('x-ollama-model');

    const effectiveProvider = headerProvider || modelProvider;
    const apiKey = effectiveProvider === 'ollama' ? null : process.env.OPENROUTER_API_KEY;

    // Prompt spécialisé pour formuler des requêtes PubMed selon les normes MeSH
    const systemPrompt = `Tu es un bibliothécaire médical et documentaliste senior expert dans la base de données PubMed/MEDLINE.
Ta tâche est de traduire la question clinique en langage naturel fournie par l'utilisateur en une **requête de recherche PubMed professionnelle et syntaxiquement parfaite** en utilisant les termes MeSH (Medical Subject Headings) et les termes en texte libre.

Règles strictes de formatage :
1. **Traduction** : Traduis tous les concepts médicaux français en anglais médical standard.
2. **Structure des concepts (PICO)** :
   - Divise la requête en concepts clés combinés par l'opérateur "AND".
   - Pour chaque concept, crée un groupe de synonymes combinés par l'opérateur "OR".
   - Utilise le tag "[Mesh]" pour les descripteurs MeSH officiels (ex: "Mercury Poisoning"[Mesh]).
   - Utilise le tag "[TiAb]" pour les équivalents en texte libre dans le Titre et le Résumé (ex: "mercury poisoning"[TiAb]).
   - Utilise des astérisques de troncature si nécessaire (ex: miner*[TiAb]).
3. **Plage de dates** : Si l'utilisateur mentionne des dates ou une période (ex: "depuis 2000", "de 2000 à 2026"), traduis-la au format exact de PubMed :
   - Format: AND (YYYY/MM/DD[PDAT] : YYYY/MM/DD[PDAT]) (ex: AND (2000/01/01[PDAT] : 2026/12/31[PDAT])).
4. **Retour strict** : Renvoy uniquement la requête PubMed finale, sur une seule ligne.
   - Ne mets pas de guillemets autour de toute la requête.
   - Ne mets aucun texte explicatif avant ou après la requête (pas d'intro ni d'outro).
   - Pas de formatage bloc de code markdown (\`\`\`). Retourne uniquement la chaîne de caractères brute de la requête.

Exemple :
Entrée : "Rédige avec les Mesh de Pubmed une commande de recherche sur l'intoxication mercurielle chronique des orpailleurs, artisans bijoutiers et mineurs d'or depuis 2000 à 2026"
Sortie : (("Mercury Poisoning"[Mesh] OR "Mercury"[Mesh] OR "Mercury Poisoning, Nervous System"[Mesh] OR "mercury poisoning"[TiAb] OR "chronic mercury"[TiAb] OR "mercurialism"[TiAb] OR "mercury intoxication"[TiAb] OR "mercury exposure"[TiAb] OR "mercury toxicity"[TiAb]) AND ("Chronic Disease"[Mesh] OR "Occupational Exposure"[Mesh] OR "chronic"[TiAb] OR "long-term"[TiAb] OR "occupational"[TiAb])) AND ("Gold"[Mesh] OR "Mining"[Mesh] OR "Miners"[Mesh] OR "gold mining"[TiAb] OR "gold miner*"[TiAb] OR "artisanal gold"[TiAb] OR "small-scale gold"[TiAb] OR "ASGM"[TiAb] OR "gold panner*"[TiAb] OR "orpailleur*"[TiAb] OR "jeweler*"[TiAb] OR "jeweller*"[TiAb] OR "goldsmith*"[TiAb] OR "jewelry worker*"[TiAb]) AND (2000/01/01[PDAT] : 2026/12/31[PDAT])`;

    console.log(`🤖 [PubMed MeSH Generator] Traitement de la question (Provider: ${effectiveProvider})...`);

    // 1. Mode Ollama (Local)
    if (effectiveProvider === 'ollama' || !apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || selectedModel || process.env.OLLAMA_MODEL || 'qwen2.5';

      const ollamaResult = await tryOllamaMeshQuery(systemPrompt, question, ollamaUrl, ollamaModel);
      if (ollamaResult) {
        return NextResponse.json({ query: ollamaResult });
      }

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Clé API OpenRouter non configurée et service local Ollama indisponible.' },
          { status: 503 }
        );
      }
    }

    // 2. Mode OpenRouter (Qwen)
    try {
      const query = await callLLM(systemPrompt, question, {
        provider: 'qwen-max',
        temperature: 0.1,
      });

      return NextResponse.json({ query: query.trim() });
    } catch (err: any) {
      console.warn('⚠️ Échec de Qwen-max pour la requête MeSH, bascule sur qwen-flash...', err);
      const fallbackQuery = await callLLM(systemPrompt, question, {
        provider: 'qwen-flash',
        temperature: 0.1,
      });
      return NextResponse.json({ query: fallbackQuery.trim() });
    }
  } catch (error: any) {
    console.error('❌ [PubMed MeSH Generator] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne lors de la génération de la requête MeSH.' },
      { status: 500 }
    );
  }
}
