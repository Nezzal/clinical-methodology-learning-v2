import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { loadEnvLocal } from '@/utils/env';
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
    console.warn("⚠️ [CRF API] Impossible de lister les modèles Ollama :", err);
    return null;
  }
}

async function tryOllamaGenerateCrf(
  prompt: string,
  ollamaUrl: string,
  ollamaModel: string
): Promise<string | null> {
  try {
    console.log(`🤖 [Générateur de CRF] Tentative d'appel à Ollama (${ollamaModel}) sur ${ollamaUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 secondes de timeout

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
            content: "Tu es un méthodologiste et gestionnaire de données cliniques expert. Tu dois concevoir un Cahier d'Observation Clinique (CRF / Case Report Form) formel, structuré, rigoureux et prêt à l'emploi (pour impression ou saisie) en français sous forme de Markdown, basé sur les détails du protocole de recherche clinique."
          },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: {
          temperature: 0.3, // Faible température pour plus de structure
          num_ctx: 16384,
          num_predict: 4096
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ [CRF API] Ollama a retourné un statut d'erreur : ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.message?.content || null;
  } catch (error: any) {
    console.warn('⚠️ [CRF API] Échec de la génération locale de CRF par Ollama :', error.message || error);
    return null;
  }
}

function getStaticFallbackCrf(
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
  methodologyName: string,
  benefitTypeName: string,
  preferredProvider = 'gemini',
  isError = false,
  errorMessage = ''
): string {
  let notice = '';
  if (preferredProvider === 'ollama') {
    notice = `⚠️ *Note : Ce CRF a été généré via notre algorithme local standard car le service local Ollama est injoignable ou le modèle n'est pas chargé. Veuillez lancer l'application Ollama et charger le modèle \`${process.env.OLLAMA_MODEL || 'gemma4:latest'}\`.*`;
  } else {
    notice = isError
      ? `⚠️ *Note : Ce CRF a été généré via notre algorithme local standard car le service d'IA Google Gemini (Cloud) a rencontré une erreur ou est temporairement indisponible.${errorMessage ? ` (Détails : ${errorMessage})` : ''}*`
      : `⚠️ *Note : Ce CRF a été généré via notre algorithme local standard car la clé API \`GEMINI_API_KEY\` n'est pas configurée. Pour bénéficier d'une rédaction enrichie par IA, configurez votre clé.*`;
  }

  const parsedInclusion = inclusion 
    ? inclusion.split('\n').map((line: string) => `[ ] ${line.trim()}`).join('\n')
    : '[ ] Patient âgé de plus de 18 ans\n[ ] Signature du consentement écrit libre et éclairé\n[ ] Patient suivi dans la structure sanitaire d\'étude';

  const parsedExclusion = exclusion
    ? exclusion.split('\n').map((line: string) => `[ ] ${line.trim()}`).join('\n')
    : '[ ] Contre-indication médicale majeure à l\'intervention\n[ ] Femme enceinte ou allaitante\n[ ] Incapables majeurs ou sujets sous tutelle';

  return `# CAHIER D'OBSERVATION CLINIQUE (CRF) - PROTOCOLE DE RECHERCHE
*Généré selon les directives méthodologiques du manuel RECIF & Loi algérienne n° 18-11*

${notice}

---

## 📋 INFORMATIONS GÉNÉRALES
* **Titre de l'étude :** ${title || '[Non spécifié]'}
* **Acronyme :** ${acronym || '[Non spécifié]'}
* **Type de Recherche / Statut :** ${methodologyName} • ${benefitTypeName}
* **Schéma d'étude :** ${design || 'Non spécifié'}
* **Numéro du Centre :** [____]  •  **Numéro du Patient :** [____]  •  **Initiales du Patient :** [__][__]

---

## 📑 FICHE 1 : CRITÈRES D'ÉLIGIBILITÉ (INCLUSION / NON-INCLUSION)

### Critères d'inclusion (Tous doivent être cochés "OUI" pour inclure le patient) :
${parsedInclusion}

### Critères de non-inclusion (Tous doivent être cochés "NON" / non cochés pour inclure le patient) :
${parsedExclusion}

**DÉCISION D'ÉLIGIBILITÉ :**
* Le patient remplit-il tous les critères d'éligibilité ?   **[ ] OUI**   **[ ] NON**
* Le consentement écrit a-t-il été signé ?   **[ ] OUI** (Date de signature : [__]/[__]/[____])   **[ ] NON**
* **Le patient est-il inclus dans l'étude ?**   **[ ] OUI**   **[ ] NON**

---

## 📑 FICHE 2 : DONNÉES DÉMOGRAPHIQUES & ANTÉCÉDENTS

* **Date de naissance :** [__]/[__]/[____]  •  **Âge :** [____] ans
* **Sexe :**  **[ ] Masculin**   **[ ] Féminin**
* **Date d'inclusion :** [__]/[__]/[____]
* **Données d'exposition / Facteur étudié :**
  - Type d'exposition : ${intervention || 'Saisir les données d\'exposition du patient'}
  - Niveau ou durée d'exposition : [____________________]
* **Principaux antécédents médicaux :**
  * Cardiovasculaire :  **[ ] NON**  **[ ] OUI** (précisez : _________________)
  * Rénal :             **[ ] NON**  **[ ] OUI** (précisez : _________________)
  * Hépatique :          **[ ] NON**  **[ ] OUI** (précisez : _________________)
  * Autre :             **[ ] NON**  **[ ] OUI** (précisez : _________________)

---

## 📑 FICHE 3 : EXAMEN CLINIQUE ET DOSAGES VITAUX (BASELINE)

* **Poids :** [____] kg  •  **Taille :** [____] cm  •  **IMC :** [____] kg/m²
* **Pression Artérielle :** [____]/[____] mmHg  •  **Fréquence Cardiaque :** [____] bpm
* **Examens cliniques spécifiques en lien avec la population d'étude (${population || 'Patients inclus'}) :**
  - Signe clinique 1 :  **[ ] Normal**  **[ ] Anormal** (Détails : _________________)
  - Signe clinique 2 :  **[ ] Normal**  **[ ] Anormal** (Détails : _________________)
* **Examens paracliniques ou dosages biologiques initiaux :**
  - Paramètre biologique 1 : [________]  (Unité : ______)
  - Paramètre biologique 2 : [________]  (Unité : ______)

---

## 📑 FICHE 4 : CRITÈRES D'ÉVALUATION ET DE SUIVI (ENDPOINTS)

### Évaluation du Critère de Jugement Principal :
* **Critère évalué :** ${primaryEndpoint || 'Critère de jugement principal'}
* Valeur ou résultat mesuré : [____________________] (Unité : ______)
* Date de la mesure : [__]/[__]/[____]

### Évaluation des Critères de Jugement Secondaires :
* **Critères évalués :** ${secondaryEndpoints || 'Critères secondaires'}
* 1. Critère secondaire A : [____________________] (Unité : ______)
* 2. Critère secondaire B : [____________________] (Unité : ______)
* 3. Tolérance clinique générale : **[ ] Excellente**  **[ ] Moyenne**  **[ ] Mauvaise**

---

## 📑 FICHE 5 : ÉVÉNEMENTS INDÉSIRABLES ET TOLÉRANCE

* **Survenue d'un effet indésirable au cours de l'étude ?**  **[ ] NON**  **[ ] OUI**
* Si OUI, complétez le tableau ci-dessous pour chaque événement :

| Description de l'Événement | Date de Début | Gravité (EIG ?)* | Lien avec l'étude (Imputabilité)** | Action prise |
| :--- | :--- | :--- | :--- | :--- |
| | | **[ ] OUI [ ] NON** | **[ ] Nul [ ] Possible [ ] Fort** | |
| | | **[ ] OUI [ ] NON** | **[ ] Nul [ ] Possible [ ] Fort** | |

*\* Un Événement Indésirable Grave (EIG) désigne tout événement entraînant la mort, mettant en jeu le pronostic vital, nécessitant une hospitalisation ou entraînant une invalidité.*
*\*\* Conformément à la Loi n° 18-11 relative à la santé, tout EIG doit être notifié immédiatement (sous 7 jours) au Ministère de la Santé et au Comité d'éthique.*

---

**Signature de l'Investigateur :** ___________________________    **Date :** [__]/[__]/[____]
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
  let preferredProvider = 'gemini';
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
  let protocolContent = '';

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
    protocolContent = data.protocolContent || '';

    const requestHeaders = new Headers(req.headers);
    preferredProvider = requestHeaders.get('x-ai-provider') || 'gemini';
    headerOllamaModel = requestHeaders.get('x-ollama-model');
    const apiKey = preferredProvider === 'ollama' ? null : process.env.GEMINI_API_KEY;
    console.log(`🔑 [CRF API] Clé API lue : ${apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 8)}` : 'AUCUNE'}`);

    const studyCategories = recifKb.algerian_regulation.study_categories;
    methodologyName = studyCategories[methodology as keyof typeof studyCategories] || 'Non spécifiée';
    benefitTypeName = studyCategories[benefitType as keyof typeof studyCategories] || 'Non spécifié';

    const prompt = `Tu es un méthodologiste et gestionnaire de données cliniques expert. Tu dois concevoir un Cahier d'Observation Clinique (CRF / Case Report Form) formel, structuré, rigoureux et prêt à l'emploi (pour impression ou saisie) en français sous forme de Markdown, basé sur les détails et le contenu du protocole de recherche clinique ci-dessous.

Le CRF final doit être composé de 5 fiches distinctes, structurées avec des cases à cocher [ ] et des lignes de saisie vide [____] pour permettre un recueil propre.

Données simplifiées du projet :
- Titre : ${title}
- Acronyme : ${acronym}
- Question de recherche : ${question}
- Schéma d'étude : ${design}
- Type de recherche (Méthodologie) : ${methodology} (${methodologyName})
- Bénéfice individuel (Loi 18-11) : ${benefitType} (${benefitTypeName})
- Description de l'intervention ou exposition : ${intervention || 'Non spécifiée'}
- Population cible : ${population || 'Non spécifiée'}
- Critères d'inclusion : ${inclusion || 'Non spécifiés'}
- Critères d'exclusion : ${exclusion || 'Non spécifiés'}
- Stratégie d'échantillonnage : ${samplingStrategy || 'Non spécifiée'}
- Critère de jugement principal (Endpoint) : ${primaryEndpoint}
- Critères de jugement secondaires : ${secondaryEndpoints || 'Non spécifiés'}
- Biais à contrôler : ${bias || 'Non spécifiés'}
- Collecte des données : ${dataCollection || 'Non spécifiée'}
- Analyse des données : ${dataAnalysis || 'Non spécifiée'}

${protocolContent ? `
[PROTOCOLE GÉNÉRÉ DE RÉFÉRENCE]
---
${protocolContent}
---
` : ''}

CONSIGNES DE PERSONNALISATION CRITIQUES :
1. Analyse très attentivement le protocole clinique complet ci-dessus. Le CRF doit correspondre PARFAITEMENT à ce protocole spécifique, sans être générique.
2. Si le protocole étudie une pathologie spécifique (comme le diabète, la toxicité au plomb, etc.), adapte les questions de la Fiche 2 (Antécédents et caractéristiques démographiques spécifiques à cette population) et la Fiche 3 (Examen clinique et biologique baseline spécifique) pour inclure précisément les signes cliniques, examens biologiques, questionnaires ou scores et paramètres décrits dans le protocole.
3. Les critères de jugement (Fiche 4) doivent mesurer EXACTEMENT le critère principal et les critères secondaires détaillés dans le protocole (ex. taux de plomb sanguin, HbA1c à 6 mois, scores cliniques réels, délais).
4. L'intervention ou l'exposition (Fiche 2) doit refléter les bras de traitement ou le mode d'exposition réels décrits dans le protocole.

Structure obligatoire du CRF en 5 fiches :

### Fiche 1 : Éligibilité et Inclusion
* Génère une checklist exhaustive de TOUS les critères d'inclusion (le clinicien coche OUI) et d'exclusion (le clinicien coche NON) saisis par le chercheur.
* Ajoute des sections pour la signature du consentement écrit (requis par l'Art. 386 de la Loi 18-11), la date de signature et la validation de l'éligibilité finale (Patient inclus OUI / NON).

### Fiche 2 : Caractéristiques Démographiques et Exposition
* Recueil de l'âge, sexe, date d'inclusion.
* Section spécifique pour quantifier et qualifier l'exposition ou l'intervention (ex. durée d'exposition, doses, facteurs confondants, antécédents médicaux majeurs à consigner).

### Fiche 3 : État Initial (Baseline)
* Relevé des constantes cliniques initiales (Poids, taille, PA, FC, température).
* Relevé des examens cliniques spécifiques à la pathologie ou population de l'étude.
* Tableau ou liste pour inscrire les résultats des examens biologiques de référence ou dosages toxicologiques initiaux en lien avec la recherche.

### Fiche 4 : Évaluation des Critères de Jugement (Endpoints)
* Grille de recueil précise pour enregistrer le résultat de la mesure du critère principal (endpoint principal) à l'échéance voulue.
* Grille de recueil pour enregistrer les critères secondaires (tolérance biologique, scores cliniques, événements spécifiques).

### Fiche 5 : Pharmacovigilance et Tolérance (Événements Indésirables)
* Question binaire sur la survenue d'un effet indésirable.
* Tableau structuré de déclaration contenant : description de l'événement, date de début, gravité (Événement Indésirable Grave ? OUI/NON), imputabilité (lien avec l'étude : nul, possible, fort) et action prise.
* Ajoute une note de rappel sur l'obligation légale de déclarer tout EIG sous 7 jours maximum au Ministère de la Santé (Algérie, Loi 18-11).

Rédige le CRF complet en français, avec une mise en page très soignée et académique, en utilisant des tableaux Markdown et des champs vides [____] facilitant l'usage pratique en clinique.`;

    if (!apiKey) {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateCrf(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Ce CRF a été généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ crf: formattedOllamaReply });
        }
      }

      const mockCrf = getStaticFallbackCrf(title, acronym, question, design, population, inclusion, exclusion, primaryEndpoint, secondaryEndpoints, intervention, methodologyName, benefitTypeName, preferredProvider, false);
      return NextResponse.json({ crf: mockCrf });
    }

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
        console.log(`🤖 [CRF API] Appel à ${currentModel} (Tentative ${attempt + 1}/${maxAttempts})...`);
        response = await withTimeout(
          ai.models.generateContent({
            model: currentModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              temperature: 0.3,
            }
          }),
          90000 // 90 secondes
        );
        console.log(`✅ [CRF API] Réponse obtenue avec succès via le modèle ${currentModel}`);
        break;
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée avec le modèle ${currentModel} :`, err.message || err);
        
        if (checkIsOffline(err) || attempt >= maxAttempts) {
          throw err;
        }

        let waitTime = Math.pow(2, attempt) * 2000;
        if (checkIsQuotaOrRateLimit(err)) {
          const delaySeconds = getRetryDelay(err);
          console.log(`⏳ [CRF API] Quota dépassé pour ${currentModel}. Attente de ${delaySeconds}s avant la tentative suivante...`);
          waitTime = delaySeconds * 1000;
        } else if (err.message === 'TIMEOUT_EXCEEDED') {
          console.log(`⏳ [CRF API] Timeout dépassé pour ${currentModel}. Attente de 3s avant la tentative suivante...`);
          waitTime = 3000;
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    const crfText = response?.text || "La génération du CRF a échoué.";
    return NextResponse.json({ crf: crfText });

  } catch (error: any) {
    console.error('Erreur API Générateur de CRF, bascule vers le secours local:', error);

    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = headerOllamaModel || process.env.OLLAMA_MODEL || 'gemma4:latest';

      const studyCategories = recifKb.algerian_regulation.study_categories;
      const resolvedMethodologyName = methodologyName !== 'Non spécifiée' ? methodologyName : (studyCategories[methodology as keyof typeof studyCategories] || 'Non spécifiée');
      const resolvedBenefitTypeName = benefitTypeName !== 'Non spécifié' ? benefitTypeName : (studyCategories[benefitType as keyof typeof studyCategories] || 'Non spécifié');

      const prompt = `Tu es un méthodologiste et gestionnaire de données cliniques expert. Tu devez concevoir un Cahier d'Observation Clinique (CRF / Case Report Form) formel, structuré, rigoureux et prêt à l'emploi (pour impression ou saisie) en français sous forme de Markdown, basé sur les détails et le contenu du protocole de recherche clinique ci-dessous.

Le CRF final doit être composé de 5 fiches distinctes, structurées avec des cases à cocher [ ] et des lignes de saisie vide [____] pour permettre un recueil propre.

Données simplifiées du projet :
- Titre : ${title}
- Acronyme : ${acronym}
- Question de recherche : ${question}
- Schéma d'étude : ${design}
- Type de recherche (Méthodologie) : ${methodology} (${resolvedMethodologyName})
- Bénéfice individuel (Loi 18-11) : ${benefitType} (${resolvedBenefitTypeName})
- Description de l'intervention ou exposition : ${intervention || 'Non spécifiée'}
- Population cible : ${population || 'Non spécifiée'}
- Critères d'inclusion : ${inclusion || 'Non spécifiés'}
- Critères d'exclusion : ${exclusion || 'Non spécifiés'}
- Stratégie d'échantillonnage : ${samplingStrategy || 'Non spécifiée'}
- Critère de jugement principal (Endpoint) : ${primaryEndpoint}
- Critères de jugement secondaires : ${secondaryEndpoints || 'Non spécifiés'}
- Biais à contrôler : ${bias || 'Non spécifiés'}
- Collecte des données : ${dataCollection || 'Non spécifiée'}
- Analyse des données : ${dataAnalysis || 'Non spécifiée'}

${protocolContent ? `
[PROTOCOLE GÉNÉRÉ DE RÉFÉRENCE]
---
${protocolContent}
---
` : ''}

CONSIGNES DE PERSONNALISATION CRITIQUES :
1. Analyse très attentivement le protocole clinique complet ci-dessus. Le CRF doit correspondre PARFAITEMENT à ce protocole spécifique, sans être générique.
2. Si le protocole étudie une pathologie spécifique (comme le diabète, la toxicité au plomb, etc.), adapte les questions de la Fiche 2 (Antécédents et caractéristiques démographiques spécifiques à cette population) et la Fiche 3 (Examen clinique et biologique baseline spécifique) pour inclure précisément les signes cliniques, examens biologiques, questionnaires ou scores et paramètres décrits dans le protocole.
3. Les critères de jugement (Fiche 4) doivent mesurer EXACTEMENT le critère principal et les critères secondaires détaillés dans le protocole (ex. taux de plomb sanguin, HbA1c à 6 mois, scores cliniques réels, délais).
4. L'intervention ou l'exposition (Fiche 2) doit refléter les bras de traitement ou le mode d'exposition réels décrits dans le protocole.

Structure obligatoire du CRF en 5 fiches :

### Fiche 1 : Éligibilité et Inclusion
* Génère une checklist de critères d'inclusion et d'exclusion saisis par le chercheur.
* Consentement écrit, signature et validation de l'éligibilité finale.

### Fiche 2 : Caractéristiques Démographiques et Exposition
* Âge, sexe, date d'inclusion.
* Section pour quantifier l'exposition ou l'intervention.

### Fiche 3 : État Initial (Baseline)
* Constantes cliniques initiales.
* Relevé des examens cliniques et dosages biologiques initiaux.

### Fiche 4 : Évaluation des Critères de Jugement (Endpoints)
* Grille de recueil pour le critère principal et les critères secondaires.

### Fiche 5 : Pharmacovigilance et Tolérance (Événements Indésirables)
* Déclaration des EI, tableau de gravité/imputabilité.
* Rappel de l'obligation de déclaration de tout EIG sous 7 jours au Ministère (Algérie, Loi 18-11).

Rédige le CRF en français en Markdown, hautement structuré et professionnel.`;

      const resolvedModel = await getAvailableOllamaModel(ollamaUrl, ollamaModel);
      if (resolvedModel) {
        const ollamaReply = await tryOllamaGenerateCrf(prompt, ollamaUrl, resolvedModel);
        if (ollamaReply) {
          const formattedOllamaReply = ollamaReply + `\n\n---\n*Note : Impossible de joindre le service Google Cloud. CRF généré localement par l'IA (${resolvedModel}) via Ollama.*`;
          return NextResponse.json({ crf: formattedOllamaReply });
        }
      }
    } catch (ollamaErr) {
      console.warn("⚠️ Échec du secours Ollama pour le CRF:", ollamaErr);
    }

    try {
      const mockCrf = getStaticFallbackCrf(title, acronym, question, design, population, inclusion, exclusion, primaryEndpoint, secondaryEndpoints, intervention, methodologyName, benefitTypeName, preferredProvider, true, error.message || String(error));
      return NextResponse.json({ crf: mockCrf });
    } catch (fallbackErr) {
      const status = error.status || error.statusCode || 500;
      let userMessage = 'Erreur lors de la génération du Cahier d\'Observation (CRF).';
      return NextResponse.json({ error: userMessage }, { status });
    }
  }
}
