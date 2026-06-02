import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
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
    const timeoutId = setTimeout(() => controller.abort(), 150000); // 150 secondes de timeout


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
            content: "Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un protocole de recherche clinique formel, structuré et détaillé en français sous forme de Markdown, en te basant sur le manuel de référence RECIF et la réglementation algérienne (Loi n° 18-11)." 
          },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: {
          temperature: 0.5
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
    console.warn('⚠️ Échec de la génération locale de protocole par Ollama :', error.message || error);
    return null;
  }
}

function getStaticFallbackProtocol(
  title: string,
  acronym: string,
  question: string,
  design: string,
  population: string,
  inclusion: string,
  exclusion: string,
  primaryEndpoint: string,
  secondaryEndpoints: string,
  intervention: string,
  categoryName: string,
  isOfflineNotice = false
): string {
  const notice = isOfflineNotice 
    ? `⚠️ *Note : Ce protocole a été généré localement car le service d'IA (appareil hors-ligne ou quota d'API de Google atteint) est indisponible. Pour bénéficier d'une rédaction enrichie par IA, configurez votre clé ou vérifiez votre connexion.*`
    : `⚠️ *Note : Ce protocole a été généré localement car la clé API \`GEMINI_API_KEY\` n'est pas configurée. Pour bénéficier d'une rédaction enrichie par IA, configurez votre clé.*`;

  return `# PROTOCOLE DE RECHERCHE CLINIQUE (PROVISOIRE)
*Généré selon les recommandations méthodologiques du manuel RECIF & Loi algérienne n° 18-11*

${notice}

---

## 1. INFORMATIONS GÉNÉRALES
* **Titre de l'étude :** ${title || '[Non spécifié]'}
* **Acronyme :** ${acronym || '[Non spécifié]'}
* **Cadre Réglementaire :** Loi n° 18-11 relative à la santé (Algérie)
* **Catégorie d'étude :** ${categoryName}
* **Schéma d'étude :** ${design || 'Non spécifié'}

---

## 2. RATIONNEL SCIENTIFIQUE ET QUESTION DE RECHERCHE
### Question de recherche :
${question || 'Quelle est l\'efficacité et la tolérance de la nouvelle intervention par rapport au comparateur ?'}

### Justification :
Cette étude se propose d'évaluer la faisabilité et l'impact de l'intervention dans la population cible. Elle répond à un besoin médical non satisfait et vise à optimiser la prise en charge clinique en accord avec les recommandations du RECIF et dans le respect de l'éthique médicale.

---

## 3. OBJECTIFS DE L'ÉTUDE
### Objectif Principal :
Évaluer l'impact de l'intervention sur le critère de jugement principal.
### Objectifs Secondaires :
1. Évaluer la tolérance et la sécurité de l'intervention.
2. Analyser l'impact sur la qualité de vie des participants.

---

## 4. CRITÈRES DE JUGEMENT (ENDPOINTS)
### Critère de Jugement Principal :
* **Critère :** ${primaryEndpoint || '[Non spécifié]'}
* **Justification RECIF :** Ce critère est unique, mesurable de manière objective, cliniquement pertinent et reproductible.
### Critères de Jugement Secondaires :
* **Critères :** ${secondaryEndpoints || 'Tolérance clinique, survenue d\'effets indésirables, scores de qualité de vie.'}

---

## 5. POPULATION ET ÉLIGIBILITÉ
### Population cible :
${population || 'Patients répondant aux critères d\'éligibilité.'}

### Critères d'Inclusion :
${inclusion ? inclusion.split('\n').map((line: string) => `- ${line}`).join('\n') : '- Patient âgé de plus de 18 ans\n- Signature du consentement écrit libre et éclairé\n- Patient suivi dans la structure sanitaire d\'étude'}

### Critères d'Exclusion :
${exclusion ? exclusion.split('\n').map((line: string) => `- ${line}`).join('\n') : '- Contre-indication médicale majeure à l\'intervention\n- Femme enceinte ou allaitante\n- Incapables majeurs ou sujets sous tutelle sans représentant légal'}

---

## 6. INTERVENTION ET DÉROULEMENT
### Description de l'intervention :
${intervention || 'L\'intervention sera menée conformément au standard de soins ou au protocole spécifique.'}

---

## 7. ASPECTS ÉTHIQUES, RÉGLEMENTAIRES ET STATISTIQUES (ALGERIE)
* **Comité d'éthique médicale :** Un avis favorable obligatoire d'un Comité d'éthique médicale agréé (conformément à l'Art. 382 de la loi 18-11) sera sollicité avant le démarrage de l'étude.
* **Autorisation Ministérielle :** Ce projet est subordonné à l'autorisation formelle du **Ministère de la Santé** (décision sous 3 mois, Art. 381).
* **Consentement (Art. 386) :** Le consentement libre, exprès et éclairé des participants sera obligatoirement recueilli **par écrit** après information loyale.
* **Données et Secret Médical (Art. 24) :** Respect strict du secret médical et de la vie privée des patients. Les données seront anonymisées (codification).
* **Effets Indésirables Graves (Art. 395) :** Toute notification d'effet indésirable grave (EIG) sera transmise immédiatement (sous 7 jours maximum) au Ministère de la Santé et au Comité d'éthique.
* **Taille d'échantillon (Règle RECIF) :** Le calcul du nombre de sujets nécessaires (NSN) devra être effectué par un biostatisticien en fonction de la variance estimée du critère principal et d'un risque d'erreur alpha de 5% avec une puissance de 80%.
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
  let riphCategory = 'observational';
  let categoryName = 'Non spécifiée';

  // New variables for Approche B
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
    riphCategory = data.riphCategory || 'observational';
    
    // Parse new fields
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

    const requestHeaders = new Headers(req.headers);
    const preferredProvider = requestHeaders.get('x-ai-provider') || 'gemini';
    const apiKey = preferredProvider === 'ollama' ? null : process.env.GEMINI_API_KEY;

    // Fetch the category name from the Algerian Health Law dataset in recif-kb.json
    const studyCategories = recifKb.algerian_regulation.study_categories;
    categoryName = studyCategories[riphCategory as keyof typeof studyCategories] || 'Non spécifiée';

    const prompt = `Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un protocole de recherche clinique formel, structuré et extrêmement détaillé en français sous forme de Markdown, en te basant sur le manuel de référence RECIF et la réglementation algérienne (Loi n° 18-11 du 2 juillet 2018 relative à la santé, Articles 377 à 399).

Tu DOIS impérativement structurer le protocole final en suivant strictement les 19 sections de la grille d'évaluation du protocole de recherche RECIF ci-dessous. Pour chaque section, utilise les données soumises par le chercheur pour formuler une rédaction complète, rigoureuse et scientifiquement solide.

Voici les données saisies par le chercheur :
- Titre proposé : ${title}
- Acronyme : ${acronym}
- Question de recherche : ${question}
- Objectifs secondaires saisis : ${objectives || 'Non spécifiés'}
- Schéma d'étude : ${design}
- Catégorie de recherche (Loi 18-11) : ${riphCategory} (${categoryName})
- Description de l'intervention : ${intervention || 'Non spécifiée'}
- Population cible : ${population || 'Non spécifiée'}
- Critères d'inclusion : ${inclusion || 'Non spécifiés'}
- Critères d'exclusion : ${exclusion || 'Non spécifiés'}
- Critère de jugement principal (Endpoint) : ${primaryEndpoint}
- Critères de jugement secondaires : ${secondaryEndpoints || 'Non spécifiés'}
- Biais et facteurs de confusion saisis : ${bias || 'Non spécifiés'}
- Justification saisie : ${justification || 'Non spécifiée'}
- Hypothèse(s) saisie(s) : ${hypothesis || 'Non spécifiée(s)'}
- Logistique, récolte & étude pilote saisies : ${logistics || 'Non spécifiées'}
- Personnel et rôles saisis : ${personnel || 'Non spécifiés'}
- Budget et Financement saisis : ${budget || 'Non spécifié'}
- Calendrier et jalons saisis : ${calendar || 'Non spécifié'}
- Considérations éthiques saisies : ${ethics || 'Non spécifiées'}
- Références bibliographiques & Annexes saisies : ${references || 'Non spécifiées'}

Instructions de rédaction :
Si un paramètre ou une section ci-dessus est marqué comme "Non spécifié(e)", tu dois formuler des propositions méthodologiques, logistiques ou scientifiques cohérentes et réalistes adaptées au type d'étude et à la question clinique pour compléter cette section. Si le chercheur a fourni des détails, utilise-les en priorité absolue et enrichis-les.

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
* Définition précise de la population cible, comprenant les critères d'inclusion, de non-inclusion et d'exclusion saisis par le chercheur.

### 10. La taille de l'échantillon
* Calcul ou justification du nombre de sujets nécessaires (NSN) à l'étude. Si des précisions statistiques ne sont pas fournies, propose une formule mathématique adaptée au schéma d'étude (ex: Schwartz pour les proportions ou comparaison de deux moyennes).

### 11. La récolte et la gestion des données
* Logistique pratique du recueil d'informations, de la manipulation ou du transport des prélèvements et de la protection des données (sécurisation, anonymisation). Incorpore la logistique saisie par le chercheur.

### 12. L'analyse des données
* Le plan d'analyse statistique prévu pour exploiter les résultats (statistiques descriptives, tests d'hypothèse univariés et multivariés appropriés).

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
* Documents complémentaires indispensables à la compréhension ou à la réplication de l'étude (formulaire de consentement, grilles de recueil, questionnaires, etc.).

### 19. Les références
* Bibliographie scientifique rigoureuse soutenant les choix théoriques, physiopathologiques et méthodologiques du protocole. Incorpore les références bibliographiques saisies.

Format du document final : Rédige le protocole complet en français, hautement professionnel et académique, en utilisant des titres Markdown H1 à H6 clairs, des tableaux Markdown pour résumer les données structurelles (par exemple pour le budget, le calendrier, ou les critères de jugement) et veille à ce que chaque section soit rédigée de manière exhaustive et rigoureuse.`;

    // Fallback si la clé API n'est pas configurée
    if (!apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:latest';

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateProtocol(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Ce protocole a été généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ protocol: formattedOllamaReply });
        }
      }

      const mockProtocol = getStaticFallbackProtocol(title, acronym, question, design, population, inclusion, exclusion, primaryEndpoint, secondaryEndpoints, intervention, categoryName, false);
      return NextResponse.json({ protocol: mockProtocol });
    }

    // Initialisation du client Google GenAI
    const ai = new GoogleGenAI({ apiKey });

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
              temperature: 0.5,
            }
          }),
          20000 // 20 secondes de timeout pour les protocoles longs
        );
        break; // Succès
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée pour generateContent (Protocol):`, err.message || err);
        if (checkIsOffline(err) || checkIsQuotaOrRateLimit(err) || err.message === 'TIMEOUT_EXCEEDED' || attempt >= maxAttempts) throw err;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    const protocolText = response?.text || "Désolé, la génération du protocole a échoué.";
    return NextResponse.json({ protocol: protocolText });

  } catch (error: any) {
    console.error('Erreur API Générateur de Protocole, bascule vers le secours local:', error);

    // Tente de basculer vers Ollama local en cas d'erreur de Gemini (offline / rate limit)
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:latest';

      const studyCategories = recifKb.algerian_regulation.study_categories;
      const resolvedCategoryName = categoryName !== 'Non spécifiée' ? categoryName : (studyCategories[riphCategory as keyof typeof studyCategories] || 'Non spécifiée');

      const prompt = `Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un protocole de recherche clinique formel, structuré et extrêmement détaillé en français sous forme de Markdown, en te basant sur le manuel de référence RECIF et la réglementation algérienne (Loi n° 18-11 du 2 juillet 2018 relative à la santé, Articles 377 à 399).

Tu DOIS impérativement structurer le protocole final en suivant strictement les 19 sections de la grille d'évaluation du protocole de recherche RECIF ci-dessous. Pour chaque section, utilise les données soumises par le chercheur pour formuler une rédaction complète, rigoureuse et scientifiquement solide.

Voici les données saisies par le chercheur :
- Titre proposé : ${title}
- Acronyme : ${acronym}
- Question de recherche : ${question}
- Objectifs secondaires saisis : ${objectives || 'Non spécifiés'}
- Schéma d'étude : ${design}
- Catégorie de recherche (Loi 18-11) : ${riphCategory} (${resolvedCategoryName})
- Description de l'intervention : ${intervention || 'Non spécifiée'}
- Population cible : ${population || 'Non spécifiée'}
- Critères d'inclusion : ${inclusion || 'Non spécifiés'}
- Critères d'exclusion : ${exclusion || 'Non spécifiés'}
- Critère de jugement principal (Endpoint) : ${primaryEndpoint}
- Critères de jugement secondaires : ${secondaryEndpoints || 'Non spécifiés'}
- Biais et facteurs de confusion saisis : ${bias || 'Non spécifiés'}
- Justification saisie : ${justification || 'Non spécifiée'}
- Hypothèse(s) saisie(s) : ${hypothesis || 'Non spécifiée(s)'}
- Logistique, récolte & étude pilote saisies : ${logistics || 'Non spécifiées'}
- Personnel et rôles saisis : ${personnel || 'Non spécifiés'}
- Budget et Financement saisis : ${budget || 'Non spécifié'}
- Calendrier et jalons saisis : ${calendar || 'Non spécifié'}
- Considérations éthiques saisies : ${ethics || 'Non spécifiées'}
- Références bibliographiques & Annexes saisies : ${references || 'Non spécifiées'}

Instructions de rédaction :
Si un paramètre ou une section ci-dessus est marqué comme "Non spécifié(e)", tu dois formuler des propositions méthodologiques, logistiques ou scientifiques cohérentes et réalistes adaptées au type d'étude et à la question clinique pour compléter cette section. Si le chercheur a fourni des détails, utilise-les en priorité absolue et enrichis-les.

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
* Définition précise de la population cible, comprenant les critères d'inclusion, de non-inclusion et d'exclusion saisis par le chercheur.

### 10. La taille de l'échantillon
* Calcul ou justification du nombre de sujets nécessaires (NSN) à l'étude. Si des précisions statistiques ne sont pas fournies, propose une formule mathématique adaptée au schéma d'étude (ex: Schwartz pour les proportions ou comparaison de deux moyennes).

### 11. La récolte et la gestion des données
* Logistique pratique du recueil d'informations, de la manipulation ou du transport des prélèvements et de la protection des données (sécurisation, anonymisation). Incorpore la logistique saisie par le chercheur.

### 12. L'analyse des données
* Le plan d'analyse statistique prévu pour exploiter les résultats (statistiques descriptives, tests d'hypothèse univariés et multivariés appropriés).

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
* Documents complémentaires indispensables à la compréhension ou à la réplication de l'étude (formulaire de consentement, grilles de recueil, questionnaires, etc.).

### 19. Les références
* Bibliographie scientifique rigoureuse soutenant les choix théoriques, physiopathologiques et méthodologiques du protocole. Incorpore les références bibliographiques saisies.

Format du document final : Rédige le protocole complet en français, hautement professionnel et académique, en utilisant des titres Markdown H1 à H6 clairs, des tableaux Markdown pour résumer les données structurelles (par exemple pour le budget, le calendrier, ou les critères de jugement) et veille à ce que chaque section soit rédigée de manière exhaustive et rigoureuse.`;

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateProtocol(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Impossible de joindre le service Google Cloud. Protocole généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ protocol: formattedOllamaReply });
        }
      }
    } catch (ollamaErr) {
      console.warn("⚠️ Échec du secours Ollama pour le protocole:", ollamaErr);
    }

    // Repli ultime sur mock statique
    try {
      const mockProtocol = getStaticFallbackProtocol(title, acronym, question, design, population, inclusion, exclusion, primaryEndpoint, secondaryEndpoints, intervention, categoryName, true);
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
