import { NextResponse } from 'next/server';
import { verifyUserAuth } from '@/utils/firebase-admin';
import { callLLM } from '@/utils/llm';
import { PubMedArticle } from '@/utils/pubmed';

async function tryOllamaSynthesize(
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
        options: { temperature: 0.3 },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.message?.content || null;
  } catch (err) {
    console.warn('⚠️ Échec de l\'appel Ollama local pour la synthèse:', err);
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
    const { articles, query, modelProvider = 'openrouter', selectedModel } = body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: 'Aucun article PubMed sélectionné pour la synthèse.' },
        { status: 400 }
      );
    }

    const requestHeaders = new Headers(req.headers);
    const headerProvider = requestHeaders.get('x-ai-provider');
    const headerOllamaModel = requestHeaders.get('x-ollama-model');

    const effectiveProvider = headerProvider || modelProvider;
    const apiKey = effectiveProvider === 'ollama' ? null : process.env.OPENROUTER_API_KEY;

    // Construction du prompt pour Qwen / LLM
    const systemPrompt = `Tu es un expert en méthodologie de recherche clinique et en rédaction médicale (normes RECIF & STROBE).
Ta mission est de rédiger une **Revue de la Littérature et Synthèse Bibliographique** rigoureuse, scientifique et impartiale basée EXCLUSIVEMENT sur les résumés PubMed fournis par l'utilisateur.

Consignes strictes :
1. **Ne rien inventer** : Base toutes tes affirmations et conclusions uniquement sur les résumés fournis. Si une donnée manque (ex: taille d'échantillon non précisée), indique "Non spécifié".
2. **Structure de la réponse** (en Markdown clair avec titres H2 et H3) :
   - **1. Résumé Analytique & Synthèse Thématique** : Résume les connaissances actuelles et les principaux résultats de recherche ressortant des articles.
   - **2. Tableau Comparatif des Études Analyées** (au format tableau Markdown) :
     | PMID / Auteurs | Année | Type d'étude | Objectif & Population | Résultats clés | Limites identifiées |
   - **3. Lacunes dans la Littérature & Rationnel pour une Nouvelle Étude** : Identifie ce qui reste insuffisamment exploré et justifie pourquoi un nouveau protocole de recherche serait scientifiquement pertinent.
   - **4. Références Bibliographiques (Format Vancouver)** : Liste numérotée complète avec PMID et DOI.
3. Rédige en français scientifique de très haute qualité.`;

    const articlesFormatted = articles
      .map(
        (a: PubMedArticle, idx: number) => `
---
[ARTICLE ${idx + 1}]
- PMID: ${a.pmid}
- Titre: ${a.title}
- Auteurs: ${a.authors.join(', ')}
- Journal: ${a.journal} (${a.year})
- DOI: ${a.doi || 'Non spécifié'}
- Type de publication: ${a.pubTypes.join(', ') || 'Article scientifique'}
- Résumé (Abstract):
${a.abstract}
---`
      )
      .join('\n');

    const userMessage = `Sujet / Question de recherche : "${query || 'Recherche générale PubMed'}"

Voici la liste des ${articles.length} articles PubMed sélectionnés pour l'analyse :

${articlesFormatted}

Merci de générer la synthèse bibliographique complète selon les consignes.`;

    console.log(`🤖 [PubMed Synthesize] Génération de la synthèse pour ${articles.length} articles (Provider: ${effectiveProvider})...`);

    // 1. Mode Ollama (Local)
    if (effectiveProvider === 'ollama' || !apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || selectedModel || process.env.OLLAMA_MODEL || 'qwen2.5';

      const ollamaResult = await tryOllamaSynthesize(systemPrompt, userMessage, ollamaUrl, ollamaModel);
      if (ollamaResult) {
        return NextResponse.json({
          synthesis: ollamaResult,
          provider: `Ollama (${ollamaModel})`,
        });
      }

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Clé API OpenRouter non configurée et service local Ollama indisponible.' },
          { status: 503 }
        );
      }
    }

    // 2. Mode OpenRouter (Qwen-max ou Qwen-flash)
    try {
      const synthesis = await callLLM(systemPrompt, userMessage, {
        provider: 'qwen-max',
        temperature: 0.3,
        maxTokens: 8192,
      });

      return NextResponse.json({
        synthesis,
        provider: 'OpenRouter (Qwen 3.7 Max)',
      });
    } catch (openRouterErr: any) {
      console.warn('⚠️ Échec OpenRouter qwen-max, tentative avec qwen-flash...', openRouterErr);
      
      const fallbackSynthesis = await callLLM(systemPrompt, userMessage, {
        provider: 'qwen-flash',
        temperature: 0.3,
        maxTokens: 8192,
      });

      return NextResponse.json({
        synthesis: fallbackSynthesis,
        provider: 'OpenRouter (Qwen 3.6 Flash)',
      });
    }
  } catch (error: any) {
    console.error('❌ [PubMed Synthesize] Erreur lors de la synthèse:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne lors de la génération de la synthèse.' },
      { status: 500 }
    );
  }
}
