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
    console.warn("⚠️ Impossible de lister les modèles Ollama :", err);
    return null;
  }
}

async function tryOllamaGenerateArticle(
  prompt: string,
  ollamaUrl: string,
  ollamaModel: string
): Promise<string | null> {
  try {
    console.log(`🤖 [Générateur d'Article] Tentative d'appel à Ollama (${ollamaModel}) sur ${ollamaUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 250000);

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { 
            role: 'system', 
            content: "Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un article scientifique formel, structuré et extrêmement détaillé en français sous forme de Markdown, conforme aux normes internationales de la grille STROBE." 
          },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: { temperature: 0.5, num_ctx: 16384, num_predict: 4096 }
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
    console.warn('⚠️ Échec de la génération locale d\'article par Ollama :', error.message || error);
    return null;
  }
}

function getStaticFallbackArticle(
  data: any,
  preferredProvider: string,
  hasError: boolean,
  errorDetail: string
): string {
  const studyTypeName = data.studyType === 'cohort' ? 'Cohorte' : (data.studyType === 'case-control' ? 'Cas-témoins' : 'Transversale');
  const note = preferredProvider === 'ollama'
    ? `⚠️ *Note : Cet article a été généré via notre algorithme local standard car le service local Ollama est injoignable ou le modèle n'est pas chargé. Veuillez lancer l'application Ollama et charger le modèle.*`
    : `⚠️ *Note : Cet article a été généré via notre algorithme local standard car le service d'IA externe (OpenRouter) a rencontré une erreur ou est temporairement indisponible. (Détails : ${errorDetail})*`;

  return `# ${data.title || 'Article d\'Étude Observationnelle STROBE'}
*Méthodologie de publication aux normes STROBE — Étude de type ${studyTypeName}*

 ${note}

---

## 1. Titre et Résumé (Critères STROBE 1-2)
* **Titre :** ${data.title || 'Non spécifié'}
* **Résumé structuré :**
 ${data.abstract || 'Non spécifié. Résumé synthétique de l\'objectif principal, des méthodes employées, des résultats d\'intérêt majeurs et de la conclusion.'}

---

## 2. Introduction (Critères STROBE 3-4)
* **Contexte scientifique et justification :**
 ${data.rationale || 'Non spécifié. Justification basée sur l\'état actuel des connaissances scientifiques.'}
* **Objectifs et hypothèses :**
 ${data.objectives || 'Non spécifié. Objectifs principaux et secondaires de la recherche.'}

---

## 3. Méthodes (Critères STROBE 5-12)
* **Schéma d\'étude (Critère 5) :** ${data.design || 'Non spécifié.'}
* **Cadre de l\'étude (Critère 6) :** ${data.setting || 'Non spécifié.'}
* **Participants et éligibilité (Critère 6) :** ${data.participants || 'Non spécifié.'}
* **Variables d\'étude (Critère 7) :** ${data.variables || 'Non spécifié.'}
* **Sources et méthodes de mesure (Critère 8) :** ${data.dataSources || 'Non spécifié.'}
* **Biais de recherche (Critère 9) :** ${data.bias || 'Non spécifié.'}
* **Taille de l\'échantillon (Critère 10) :** ${data.studySize || 'Non spécifié.'}
* **Traitement des variables quantitatives (Critère 11) :** ${data.quantitativeVariables || 'Non spécifié.'}
* **Méthodes statistiques (Critère 12) :** ${data.statisticalMethods || 'Non spécifié.'}

---

## 4. Résultats (Critères STROBE 13-17)
* **Flux de participants (Critère 13) :**
 ${data.participantsFlow || 'Non spécifié.'}
* **Données descriptives (Critère 14) :**
 ${data.descriptiveData || 'Non spécifié.'}
* **Données sur les résultats d\'intérêt (Critère 15) :**
 ${data.outcomeData || 'Non spécifié.'}
* **Résultats principaux (Critère 16) :**
 ${data.mainResults || 'Non spécifié.'}
* **Analyses secondaires (Critère 17) :**
 ${data.otherAnalyses || 'Non spécifié.'}

---

## 5. Discussion (Critères STROBE 18-21)
* **Résultats clés (Critère 18) :**
 ${data.keyResults || 'Non spécifié.'}
* **Limites de l\'étude (Critère 19) :**
 ${data.limitations || 'Non spécifié.'}
* **Interprétation (Critère 20) :**
 ${data.interpretation || 'Non spécifié.'}
* **Généralisabilité (Critère 21) :**
 ${data.generalisability || 'Non spécifié.'}

---

## 6. Financement (Critère STROBE 22)
* **Financement de l\'étude :**
 ${data.funding || 'Non spécifié.'}
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

  // Validation de sécurité (vérification de l'authentification et de la non-suspension)
  const authCheck = await verifyUserAuth(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }
  
  let payload: any = {};
  try {
    payload = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }

  const {
    title = '',
    studyType = 'cohort',
    abstract = '',
    rationale = '',
    objectives = '',
    design = '',
    setting = '',
    participants = '',
    variables = '',
    dataSources = '',
    bias = '',
    studySize = '',
    quantitativeVariables = '',
    statisticalMethods = '',
    participantsFlow = '',
    descriptiveData = '',
    outcomeData = '',
    mainResults = '',
    otherAnalyses = '',
    keyResults = '',
    limitations = '',
    interpretation = '',
    generalisability = '',
    funding = ''
  } = payload;

  const requestHeaders = new Headers(req.headers);
  const preferredProvider = requestHeaders.get('x-ai-provider') || 'openrouter';
  const headerOllamaModel = requestHeaders.get('x-ollama-model');
  const apiKey = preferredProvider === 'ollama' ? null : process.env.OPENROUTER_API_KEY;

  const studyTypeName = studyType === 'cohort' ? 'Cohorte' : (studyType === 'case-control' ? 'Cas-témoins' : 'Transversale');

  const prompt = `Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un article scientifique formel, structuré et extrêmement détaillé en français sous forme de Markdown, conforme aux normes internationales de la grille STROBE (Strengthening the Reporting of Observational Studies in Epidemiology).

CONSIGNE DE CONCISION CRITIQUE : Afin de garantir que l'intégralité du document soit générée sans troncature et rapidement, sois extrêmement synthétique, concis et précis. Évite tout bavardage, préambule ou transition inutile. Pour chaque section, formule une rédaction claire de 3 à 8 lignes maximum, reprenant les données fournies par le chercheur et les complétant de manière scientifique. L'ensemble de l'article (y compris le titre et le résumé) doit pouvoir être rédigé en moins de 1500 mots.

L'article doit être structuré de manière académique avec les sections suivantes :
1. **Titre et Résumé** (Critères STROBE 1-2)
2. **Introduction** (Critères STROBE 3-4 : Contexte/justification, Objectifs et hypothèses)
3. **Méthodes** (Critères STROBE 5-12 : Schéma, Cadre, Participants, Variables, Sources/mesures, Biais, Taille de l'étude, Variables quantitatives, Méthodes statistiques)
4. **Résultats** (Critères STROBE 13-17 : Participants, Données descriptives, Données sur les résultats d'intérêt, Résultats principaux, Autres analyses)
5. **Discussion** (Critères STROBE 18-21 : Résultats clés, Limites, Interprétation, Généralisabilité)
6. **Financement** (Critère STROBE 22)

Voici les données saisies par le chercheur :
- Titre proposé : ${title}
- Type d'étude : ${studyTypeName}
- Résumé structuré : ${abstract || 'Non spécifié'}
- Contexte scientifique et justification : ${rationale || 'Non spécifié'}
- Objectifs et hypothèses : ${objectives || 'Non spécifié'}
- Schéma d'étude : ${design || 'Non spécifié'}
- Cadre (dates, lieux, recrutement) : ${setting || 'Non spécifié'}
- Sélection des participants & critères d'éligibilité : ${participants || 'Non spécifié'}
- Variables étudiées : ${variables || 'Non spécifié'}
- Sources des données et méthodes de mesure : ${dataSources || 'Non spécifié'}
- Biais et contrôles : ${bias || 'Non spécifié'}
- Taille de l'étude : ${studySize || 'Non spécifié'}
- Traitement des variables quantitatives : ${quantitativeVariables || 'Non spécifié'}
- Méthodes statistiques utilisées : ${statisticalMethods || 'Non spécifié'}
- Flux de participants : ${participantsFlow || 'Non spécifié'}
- Données descriptives des participants : ${descriptiveData || 'Non spécifié'}
- Mesures de résumé / critères de jugement principaux : ${outcomeData || 'Non spécifié'}
- Résultats principaux et précision (IC) : ${mainResults || 'Non spécifié'}
- Analyses secondaires (sous-groupes, sensibilité) : ${otherAnalyses || 'Non spécifié'}
- Résultats clés en lien avec les objectifs : ${keyResults || 'Non spécifié'}
- Limites de l'étude : ${limitations || 'Non spécifié'}
- Interprétation globale prudente : ${interpretation || 'Non spécifié'}
- Généralisabilité des résultats : ${generalisability || 'Non spécifié'}
- Financement de l'étude : ${funding || 'Non spécifié'}

Instructions de rédaction :
Si un paramètre ou une section ci-dessus est marqué comme "Non spécifié(e)" ou "Non spécifié", tu dois formuler des propositions méthodologiques, logistiques ou scientifiques cohérentes, réalistes et structurées, adaptées à l'étude pour compléter cette section. Si le chercheur a fourni des détails, utilise-les en priorité absolue et enrichis-les de manière rigoureuse.
`;

  try {
    if (!apiKey) {
      throw new Error("Clé API OpenRouter non configurée (Bascule Ollama)");
    }

    // --- APPEL OPENROUTER (GLM-5 recommandé pour la rédaction longue) ---
    console.log(`🤖 [Article API] Appel à OpenRouter (GLM-5)...`);
    const articleText = await withTimeout(
      callLLM(
        "Tu es un méthodologiste expert en recherche clinique. Tu rédiges des articles scientifiques structurés en français conforme aux normes STROBE. Tu ne fais jamais de LaTeX.",
        prompt,
        {
          provider: "qwen-plus", // Qwen-Plus pour la rédaction longue et style académique
          temperature: 0.6,
          maxTokens: 8192
        }
      ),
      120000
    );
    console.log(`✅ [Article API] Réponse obtenue avec succès via OpenRouter`);

    return NextResponse.json({ article: articleText });

  } catch (error: any) {
    console.error('Erreur API Générateur d\'Article, bascule vers le secours local:', error);

    // Tente Ollama local
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateArticle(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Impossible de joindre le service d'IA externe. Article généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ article: formattedOllamaReply });
        }
      }
    } catch (ollamaErr) {
      console.warn("⚠️ Échec du secours Ollama pour l'article:", ollamaErr);
    }

    // Repli ultime sur mock statique
    try {
      const mockArticle = getStaticFallbackArticle(payload, preferredProvider, true, error.message || String(error));
      return NextResponse.json({ article: mockArticle });
    } catch (fallbackErr) {
      const status = error.status || error.statusCode || 500;
      return NextResponse.json({ error: `Erreur interne du serveur lors de la génération de l'article : ${error.message || error}` }, { status });
    }
  }
}