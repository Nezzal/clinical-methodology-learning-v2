import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import recifKb from '@/data/recif-kb.json';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      title,
      acronym,
      question,
      design,
      population,
      inclusion,
      exclusion,
      primaryEndpoint,
      secondaryEndpoints,
      intervention,
      riphCategory, // can be 'interventional' | 'observational' | 'sbid' | 'bid'
    } = data;

    const apiKey = process.env.GEMINI_API_KEY;

    // Fetch the category name from the Algerian Health Law dataset in recif-kb.json
    const studyCategories = recifKb.algerian_regulation.study_categories;
    const categoryName = studyCategories[riphCategory as keyof typeof studyCategories] || 'Non spécifiée';

    // Fallback Mock si la clé API n'est pas configurée
    if (!apiKey) {
      const mockProtocol = `# PROTOCOLE DE RECHERCHE CLINIQUE (PROVISOIRE)
*Généré selon les recommandations méthodologiques du manuel RECIF & Loi algérienne n° 18-11*

⚠️ *Note : Ce protocole a été généré localement car la clé API \`GEMINI_API_KEY\` n'est pas configurée. Pour bénéficier d'une rédaction enrichie par IA, configurez votre clé.*

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

      return NextResponse.json({ protocol: mockProtocol });
    }

    // Initialisation du client Google GenAI
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Tu es un méthodologiste expert en recherche clinique. Tu dois rédiger un protocole de recherche clinique formel, structuré et détaillé, en te basant sur le manuel de référence RECIF et la réglementation algérienne (Loi n° 18-11 du 2 juillet 2018 relative à la santé, Articles 377 à 399).

Voici les données soumises par le chercheur :
- Titre : ${title}
- Acronyme : ${acronym}
- Question de recherche : ${question}
- Schéma d'étude : ${design}
- Catégorie de recherche (Loi 18-11) : ${riphCategory} (${categoryName})
- Population cible : ${population}
- Critères d'inclusion : ${inclusion}
- Critères d'exclusion : ${exclusion}
- Critère de jugement principal (Endpoint) : ${primaryEndpoint}
- Critères de jugement secondaires : ${secondaryEndpoints}
- Description de l'intervention : ${intervention}

Instructions de rédaction :
1. Rédige un protocole complet au format Markdown avec les sections standardisées recommandées par le RECIF.
2. Écris une section réglementaire spécifique à l'Algérie détaillant la soumission au Ministère de la Santé (décision sous 3 mois selon l'Art. 381) et l'obtention de l'avis du Comité d'éthique médicale (Art. 382/383).
3. Mentionne l'obligation légale de recueillir le consentement libre, exprès et éclairé par écrit (Art. 386), ainsi que les sanctions pénales strictes (Art. 438 et 439) en cas d'infraction.
4. Donne des conseils précis sur la méthodologie statistique requise pour ce type de protocole (par exemple, le calcul de la taille de l'échantillon ou les tests à envisager pour le critère principal).
5. Le style doit être hautement professionnel, médical, académique et rédigé exclusivement en français.`;

    let response;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.5,
          }
        });
        break; // Succès
      } catch (err: any) {
        attempt++;
        console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée pour generateContent (Protocol):`, err.message || err);
        if (attempt >= maxAttempts) throw err;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    const protocolText = response?.text || "Désolé, la génération du protocole a échoué.";
    return NextResponse.json({ protocol: protocolText });

  } catch (error: any) {
    console.error('Erreur API Générateur de Protocole:', error);
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
