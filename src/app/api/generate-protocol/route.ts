import { NextResponse } from 'next/server';
import { callLLM } from '@/utils/llm';
import { loadEnvLocal } from '@/utils/env';
import { verifyUserAuth } from '@/utils/firebase-admin';
import recifKb from '@/data/recif-kb.json';

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

async function tryOllamaGenerateProtocol(
  prompt: string,
  ollamaUrl: string,
  ollamaModel: string
): Promise<string | null> {
  try {
    console.log(`🤖 [Générateur de Protocole] Tentative d'appel à Ollama (${ollamaModel}) sur ${ollamaUrl}...`);

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
            content: "Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un protocole de recherche clinique formel, structuré et détaillé en français sous forme de Markdown, en te basant sur le manuel de référence RECIF et la réglementation algérienne (Loi n° 18-11)." 
          },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: { temperature: 0.5, num_ctx: 16384, num_predict: 8192 }
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
    console.warn('⚠️ Échec de la génération locale de protocole par Ollama :', error.message || error);
    return null;
  }
}

function getStaticFallbackProtocol(
  params: {
    title: string;
    acronym: string;
    question: string;
    design: string;
    population: string;
    inclusion: string;
    exclusion: string;
    primaryEndpoint: string;
    secondaryEndpoints: string;
    intervention: string;
    methodologyName: string;
    benefitTypeName: string;
    objectives: string;
    bias: string;
    justification: string;
    hypothesis: string;
    logistics: string;
    personnel: string;
    budget: string;
    calendar: string;
    ethics: string;
    references: string;
    annexes: string;
    samplingStrategy: string;
    dataCollection: string;
    dataAnalysis: string;
  },
  preferredProvider: string = 'openrouter',
  isError = false,
  errorMessage = ''
): string {
  const {
    title, acronym, question, design, population, inclusion, exclusion,
    primaryEndpoint, secondaryEndpoints, intervention, methodologyName,
    benefitTypeName, objectives, bias, justification, hypothesis, logistics,
    personnel, budget, calendar, ethics, references, annexes,
    samplingStrategy, dataCollection, dataAnalysis
  } = params;

  let notice = '';
  if (preferredProvider === 'ollama') {
    notice = `⚠️ *Note : Ce protocole a été généré via notre algorithme local standard car le service local Ollama est injoignable ou le modèle n'est pas chargé. Veuillez lancer l'application Ollama et charger le modèle \`${process.env.OLLAMA_MODEL || 'gemma4:latest'}\`.*`;
  } else {
    notice = isError
      ? `⚠️ *Note : Ce protocole a été généré via notre algorithme local standard car le service d'IA externe (OpenRouter) a rencontré une erreur ou est temporairement indisponible.${errorMessage ? ` (Détails : ${errorMessage})` : ''} Vous pouvez basculer sur Ollama localement ou réessayer.*`
      : `⚠️ *Note : Ce protocole a été généré via notre algorithme local standard car la clé API \`OPENROUTER_API_KEY\` n'est pas configurée. Pour bénéficier d'une rédaction enrichie par IA, configurez votre clé.*`;
  }

  const cleanInclusion = inclusion ? inclusion.split('\n').map((line: string) => line.trim()).filter(Boolean).join(' ; ') : '[Non renseigné]';
  const cleanExclusion = exclusion ? exclusion.split('\n').map((line: string) => line.trim()).filter(Boolean).join(' ; ') : '[Non renseigné]';
  const cleanObjectives = objectives ? objectives.split('\n').map((line: string) => line.trim()).filter(Boolean).join(' ; ') : '[Non renseigné]';

  return `# PROTOCOLE DE RECHERCHE CLINIQUE (MÉTHODOLOGIE RECIF & LOI 18-11)
*Généré selon les 19 sections de la grille d'évaluation du manuel RECIF et la législation algérienne*

 ${notice}

---

### 1. Le titre
* **Titre de l'étude :** ${title || '[Non renseigné / À compléter]'}
* **Acronyme :** ${acronym || '[Non renseigné / À compléter]'}
* **Cadre Réglementaire :** Loi n° 18-11 relative à la santé (Algérie)
* **Type de Recherche (Méthodologie) :** ${methodologyName}
* **Bénéfice individuel attendu (Loi 18-11) :** ${benefitTypeName}

### 2. Le(s) objectif(s)
* **Objectif Principal :** Évaluer l'impact et la tolérance de l'intervention/exposition sur le critère de jugement principal dans la population d'étude.
* **Objectifs Secondaires :**
 ${objectives ? objectives.split('\n').map((line: string) => `  * ${line.trim()}`).join('\n') : '  * Évaluer la tolérance clinique de l\'intervention.\n  * Analyser les critères de jugement secondaires.'}

### 3. La justification de l'étude
 ${justification || 'Cette étude vise à évaluer la faisabilité et l\'impact de l\'intervention dans la population cible. Elle répond à un besoin médical et méthodologique en accord avec le guide RECIF.'}

### 4. La (les) hypothèse(s)
 ${hypothesis || 'L\'intervention présente une efficacité supérieure ou une équivalence par rapport au standard de soins ou au groupe témoin.'}

### 5. Le type d'étude
* **Schéma d'étude :** ${design || '[Non renseigné / À compléter]'}
* **Type de recherche (Méthodologie) :** ${methodologyName}

### 6. Le(s) facteur(s) étudié(s)
* **Description de l'intervention ou de l'exposition :**
 ${intervention || '[Non renseigné / À compléter]'}

### 7. Le(s) critère(s) de jugement
* **Critère de Jugement Principal (Endpoint) :** ${primaryEndpoint || '[Non renseigné / À compléter]'}
* **Critères de Jugement Secondaires :**
 ${secondaryEndpoints || '[Non renseigné / À compléter]'}

### 8. Les causes d'erreur : biais et facteurs de confusion
* **Biais identifiés & Contrôle des facteurs de confusion :**
 ${bias || 'Les biais de sélection, d\'information et de confusion seront minimisés par le respect strict des critères d\'éligibilité et une méthodologie rigoureuse.'}

### 9. Les sujets
* **Population cible :** ${population || '[Non renseigné / À compléter]'}
* **Stratégie d'échantillonnage :** ${samplingStrategy || '[Non renseignée / À compléter]'}
* **Critères d'Inclusion :**
 ${inclusion ? inclusion.split('\n').map((line: string) => `* ${line.trim()}`).join('\n') : '* Patient éligible\n* Consentement écrit signé'}
* **Critères d'Exclusion :**
 ${exclusion ? exclusion.split('\n').map((line: string) => `* ${line.trim()}`).join('\n') : '* Contre-indication médicale majeure\n* Refus de participer'}

### 10. La taille de l'échantillon
* Le calcul du nombre de sujets nécessaires (NSN) sera effectué par un biostatisticien selon la variance attendue du critère principal.

### 11. La récolte et la gestion des données
* **Collecte des données :**
 ${dataCollection || 'Recueil d\'informations standardisé, stockage sécurisé et respect de la confidentialité.'}
* **Logistique, récolte & étude pilote :**
 ${logistics || 'Anonymisation des données à la source, stockage sécurisé.'}

### 12. L'analyse des données
* **Analyse statistique :**
 ${dataAnalysis || 'Plan d\'analyse : Statistiques descriptives pour décrire la population (moyennes, écarts-types, pourcentages) et tests comparatifs univariés et multivariés appropriés (test t, ANOVA, Chi-2) selon la nature des variables.'}

### 13. Une éventuelle étude pilote
* Une phase pilote pourra être initiée sur un nombre restreint de sujets afin de valider la faisabilité opérationnelle du circuit des données.

### 14. Les implications éthiques
* **Considérations éthiques & Réglementation :**
 ${ethics || 'Soumission au Comité de Protection des Personnes (CPP) ou Comité d\'éthique compétent. Recueil obligatoire du consentement éclairé écrit de chaque participant.'}
* **Loi algérienne 18-11 :** Respect du secret médical (Art. 24), recueil du consentement exprès et éclairé écrit (Art. 386), et notification de tout EIG sous 7 jours (Art. 395).

### 15. Le personnel
* **Personnel et rôles requis :**
 ${personnel || 'L\'investigateur principal, les cliniciens collaborateurs, le personnel infirmier et le biostatisticien.'}

### 16. Le budget
* **Budget et Financement :**
 ${budget || 'Financement interne / Prise en charge par la structure hospitalière.'}

### 17. Le calendrier
* **Calendrier prévisionnel :**
 ${calendar || 'Jalons prévisionnels à définir (soumissions réglementaires, phase active de recrutement, analyse et rédaction finale).'}

### 18. Les annexes éventuelles
* **Annexes à joindre :**
 ${annexes || 'Cahier d\'observation clinique (CRF), Notice d\'information, Formulaire de consentement.'}

### 19. Les références
* **Références bibliographiques :**
 ${references || 'Manuel RECIF de méthodologie de recherche clinique.\nLoi algérienne n° 18-11 relative à la santé.'}

*(Fin du Protocole)*
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
  let title = '';
  let acronym = '';
  let question = '';
  let design = '';
  let population = '';
  let inclusion = '';
  let exclusion = '';
  let primaryEndpoint = '';
  let secondaryEndpoints = '';
  let intervention = '';
  let methodology = 'observational';
  let benefitType = 'sbid';
  let methodologyName = 'Non spécifiée';
  let benefitTypeName = 'Non spécifié';
  let preferredProvider = 'openrouter';
  let headerOllamaModel: string | null = null;

  let objectives = '';
  let bias = '';
  let justification = '';
  let hypothesis = '';
  let logistics = '';
  let personnel = '';
  let budget = '';
  let calendar = '';
  let ethics = '';
  let references = '';
  let annexes = '';
  let samplingStrategy = '';
  let dataCollection = '';
  let dataAnalysis = '';

  let prompt = '';

  try {
    const data = await req.json();
    title = data.title || '';
    acronym = data.acronym || '';
    question = data.question || '';
    design = data.design || '';
    population = data.population || '';
    inclusion = data.inclusion || '';
    exclusion = data.exclusion || '';
    primaryEndpoint = data.primaryEndpoint || '';
    secondaryEndpoints = data.secondaryEndpoints || '';
    intervention = data.intervention || '';
    methodology = data.methodology || 'observational';
    benefitType = data.benefitType || 'sbid';
    
    objectives = data.objectives || '';
    bias = data.bias || '';
    justification = data.justification || '';
    hypothesis = data.hypothesis || '';
    logistics = data.logistics || '';
    personnel = data.personnel || '';
    budget = data.budget || '';
    calendar = data.calendar || '';
    ethics = data.ethics || '';
    references = data.references || '';
    annexes = data.annexes || '';
    samplingStrategy = data.samplingStrategy || '';
    dataCollection = data.dataCollection || '';
    dataAnalysis = data.dataAnalysis || '';

    const requestHeaders = new Headers(req.headers);
    preferredProvider = requestHeaders.get('x-ai-provider') || 'openrouter';
    headerOllamaModel = requestHeaders.get('x-ollama-model');
    const apiKey = preferredProvider === 'ollama' ? null : process.env.OPENROUTER_API_KEY;

    const studyCategories = recifKb.algerian_regulation.study_categories;
    methodologyName = studyCategories[methodology as keyof typeof studyCategories] || 'Non spécifiée';
    benefitTypeName = studyCategories[benefitType as keyof typeof studyCategories] || 'Non spécifié';

    prompt = `Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un protocole de recherche clinique formel, structuré et extrêmement détaillé en français sous forme de Markdown, en te basant sur le manuel de référence RECIF et la réglementation algérienne (Loi n° 18-11 du 2 juillet 2018 relative à la santé, Articles 377 à 399).

CONSIGNE DE CONCISION CRITIQUE : Afin de garantir que l'intégralité du document soit générée sans troncature et rapidement, sois extrêmement synthétique, concis et précis. Évite tout bavardage, préambule ou transition inutile. Pour chaque section, formule une rédaction claire de 3 à 8 lignes maximum, reprenant les données fournies par le chercheur et les complétant de manière succincte. L'ensemble du protocole (y compris le tableau de synthèse initial) doit pouvoir être rédigé en moins de 1500 mots.

CONSIGNE CRITIQUE DE STRUCTURE : Tu DOIS impérativement structurer le protocole final en suivant strictement les 19 sections de la grille d'évaluation du protocole de recherche RECIF ci-dessous, dans l'ordre, de la section 1 à la section 19. Ne saute aucune section, n'en regroupe aucune et ne t'arrête pas prématurément avant d'avoir entièrement rédigé les 19 sections. Il est obligatoire d'inclure les aspects logistiques, le personnel, le budget, le calendrier, les considérations éthiques, les annexes et les références.

Voici les données saisies par le chercheur :
- Titre proposé : ${title}
- Acronyme : ${acronym}
- Question de recherche : ${question}
- Objectifs secondaires saisis : ${objectives || 'Non spécifiés'}
- Schéma d'étude : ${design}
- Type de recherche (Méthodologie) : ${methodology} (${methodologyName})
- Bénéfice individuel attendu (Loi 18-11) : ${benefitType} (${benefitTypeName})
- Description de l'intervention : ${intervention || 'Non spécifiée'}
- Population cible : ${population || 'Non spécifiée'}
- Critères d'inclusion : ${inclusion || 'Non spécifiés'}
- Critères d'exclusion : ${exclusion || 'Non spécifiés'}
- Stratégie d'échantillonnage : ${samplingStrategy || 'Non spécifiée'}
- Critère de jugement principal (Endpoint) : ${primaryEndpoint}
- Critères de jugement secondaires : ${secondaryEndpoints || 'Non spécifiés'}
- Biais et facteurs de confusion saisis : ${bias || 'Non spécifiés'}
- Justification saisie : ${justification || 'Non spécifiée'}
- Hypothèse(s) saisie(s) : ${hypothesis || 'Non spécifiée(s)'}
- Logistique, récolte & étude pilote saisies : ${logistics || 'Non spécifiées'}
- Collecte des données saisie : ${dataCollection || 'Non spécifiée'}
- Analyse des données saisie : ${dataAnalysis || 'Non spécifiée'}
- Personnel et rôles saisis : ${personnel || 'Non spécifiés'}
- Budget et Financement saisis : ${budget || 'Non spécifié'}
- Calendrier et jalons saisis : ${calendar || 'Non spécifié'}
- Considérations éthiques saisies : ${ethics || 'Non spécifiées'}
- Références bibliographiques saisies : ${references || 'Non spécifiées'}
- Annexes saisies (à lister/citer) : ${annexes || 'Non spécifiées'}

Instructions de rédaction :
Si un paramètre ou une section ci-dessus est marqué comme "Non spécifié(e)", tu dois formuler des propositions méthodologiques, logistiques ou scientifiques cohérentes, réalistes et structurées, adaptées au type d'étude et à la question clinique pour compléter cette section. Si le chercheur a fourni des détails, utilise-les en priorité absolue et enrichis-les.

Voici la structure obligatoire en 19 sections à respecter rigoureusement :

### 1. Le titre
* Un titre précis, informatif et reflétant fidèlement l'étude. Intègre le titre proposé par le chercheur et son acronyme.

### 2. Le(s) objectif(s)
* Définit le but principal (objectif principal) et les étapes intermédiaires (objectifs secondaires) de la recherche, en lien avec la question de recherche et l'intervention. Utilise les objectifs secondaires saisis s'ils sont fournis.

### 3. La justification de l'étude
* Démontre l'originalité, l'urgence, la pertinence médicale, scientifique et l'impact de l'étude (le "pourquoi"). Incorpore la justification saisie par le chercheur.

### 4. La (les) hypothèse(s)
* Propositions de réponses théoriques aux questions de recherche, qui seront infirmées ou confirmées par les résultats. Incorpore l'hypothèse saisie par le chercheur.

### 5. Le type d'étude
* Choix du design méthodologique (ex: descriptive, analytique, prospective, rétrospective, etc.) en adéquation avec le schéma d'étude choisi par le chercheur.

### 6. Le(s) facteur(s) étudié(s)
* Identification et mesure des variables d'exposition (causes suspectées) et des facteurs de confusion ou de co-exposition possibles. Incorpore la description de l'intervention ou de l'exposition.

### 7. Le(s) critère(s) de jugement
* Critères (cliniques, paracliniques ou biologiques) permettant de mesurer l'efficacité d'un traitement ou la sévérité d'une maladie. Reprend le critère de jugement principal et les critères secondaires définis par le chercheur.

### 8. Les causes d'erreur : biais et facteurs de confusion
* Identification des limites méthodologiques potentielles (biais de sélection, biais d'information, facteurs de confusion) et les moyens prévus pour les minimiser. Incorpore le texte sur les biais saisi par le chercheur.

### 9. Les sujets
* Définition précise de la population cible, comprenant les critères d'inclusion, de non-inclusion et d'exclusion saisis par le chercheur, ainsi que la stratégie d'échantillonnage spécifiée.

### 10. La taille de l'échantillon
* Calcul ou justification du nombre de sujets nécessaires (NSN) à l'étude. Si des précisions statistiques ne sont pas fournies, propose une formule mathématique adaptée au schéma d'étude (ex: Schwartz pour les proportions ou comparaison de deux moyennes).

### 11. La récolte et la gestion des données
* Outils de collecte des données et logistique pratique du recueil d'informations, de la manipulation ou du transport des prélèvements et de la protection des données (sécurisation, anonymisation). Incorpore la collecte et la logistique saisies par le chercheur.

### 12. L'analyse des données
* Le plan d'analyse statistique prévu pour exploiter les résultats (statistiques descriptives, tests d'hypothèse univariés et multivariés appropriés). Incorpore l'analyse des données saisie par le chercheur.

### 13. Une éventuelle étude pilote
* Description d'une phase préliminaire à petite échelle (si applicable) pour tester la faisabilité du protocole, des questionnaires ou de la logistique de prélèvement.

### 14. Les implications éthiques
* Respect des règles morales et déontologiques vis-à-vis des participants (notice d'information, recueil obligatoire du consentement éclairé écrit, anonymisation des données) conformément aux exigences du Comité d'éthique et à la Loi algérienne n° 18-11. Incorpore les considérations éthiques saisies.

### 15. Le personnel
* Ressources humaines nécessaires à la réalisation de l'étude et rôle précis de chaque intervenant (investigateurs, attachés de recherche clinique, statisticiens, etc.). Incorpore le personnel saisi.

### 16. Le budget
* Évaluation financière détaillée des coûts de l'étude (frais de personnel, matériel, analyses de laboratoire, traitements) et recensement des sources de financement. Incorpore le budget saisi.

### 17. Le calendrier
* Calendrier prévisionnel des différentes étapes de la recherche (jalons de recrutement, soumissions réglementaires, suivi, analyse, rédaction). Incorpore le calendrier saisi.

### 18. Les annexes éventuelles
* Documents complémentaires indispensables à la compréhension ou à la réplication de l'étude (formulaire de consentement, grilles de recueil, questionnaires, etc.). Incorpore les annexes saisies par le chercheur (en les citant ou en dressant la liste de ce qui doit être fourni).

### 19. Les références
* Bibliographie scientifique rigoureuse soutenant les choix théoriques, physiopathologiques et méthodologiques du protocole. Incorpore les références bibliographiques saisies.

Format du document final : Rédige le protocole complet en français, de manière hautement professionnelle et académique, en écrivant les 19 titres de section ci-dessus en Markdown H3. Rédige chaque section de manière exhaustive et rigoureuse sans abréger ou omettre les sections de la fin (logistique, personnel, budget, calendrier, éthique, annexes et références).`;

    // Fallback si la clé API n'est pas configurée
    if (!apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateProtocol(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Ce protocole a été généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ protocol: formattedOllamaReply });
        }
      }

      const mockProtocol = getStaticFallbackProtocol({
        title, acronym, question, design, population, inclusion, exclusion,
        primaryEndpoint, secondaryEndpoints, intervention, methodologyName,
        benefitTypeName, objectives, bias, justification, hypothesis, logistics,
        personnel, budget, calendar, ethics, references, annexes,
        samplingStrategy, dataCollection, dataAnalysis
      }, preferredProvider, false);
      return NextResponse.json({ protocol: mockProtocol });
    }

    // --- APPEL OPENROUTER (QWEN / GLM) ---
    console.log(`🤖 [Protocol API] Appel à OpenRouter (QWEN/GLM)...`);
    const protocolText = await withTimeout(
      callLLM(
        "Tu es un méthodologiste expert en recherche clinique. Tu rédiges des protocoles structurés en français conforme au manuel RECIF et à la Loi 18-11 algérienne. Tu ne fais jamais de LaTeX.",
        prompt,
        {
          provider: "qwen-max", // Change en "glm-5" si tu préfères GLM
          temperature: 0.5,
          maxTokens: 8192,
          timeoutMs: 240000
        }
      ),
      240000
    );
    console.log(`✅ [Protocol API] Réponse obtenue avec succès via OpenRouter`);

    return NextResponse.json({ protocol: protocolText });

  } catch (error: any) {
    console.error('Erreur API Générateur de Protocole, bascule vers le secours local:', error);

    // Tente Ollama local en cas d'erreur
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateProtocol(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Impossible de joindre le service d'IA externe. Protocole généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ protocol: formattedOllamaReply });
        }
      }
    } catch (ollamaErr) {
      console.warn("⚠️ Échec du secours Ollama pour le protocole:", ollamaErr);
    }

    // Repli ultime sur mock statique
    try {
      const mockProtocol = getStaticFallbackProtocol({
        title, acronym, question, design, population, inclusion, exclusion,
        primaryEndpoint, secondaryEndpoints, intervention, methodologyName,
        benefitTypeName, objectives, bias, justification, hypothesis, logistics,
        personnel, budget, calendar, ethics, references, annexes,
        samplingStrategy, dataCollection, dataAnalysis
      }, preferredProvider, true, error.message || String(error));
      return NextResponse.json({ protocol: mockProtocol });
    } catch (fallbackErr) {
      const status = error.status || error.statusCode || 500;
      let userMessage = 'Erreur interne du serveur lors de la génération du protocole.';

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
