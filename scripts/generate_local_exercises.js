const fs = require('fs');
const path = require('path');

// 20 Chapters from RECIF TOC & Algerian law references
const RECIF_CHAPTERS = [
  "Loi algérienne n° 18-11 relative à la santé",
  "Rôle du Comité d'éthique médicale algérien (Art. 382)",
  "Calcul du nombre de sujets nécessaires (NSN)",
  "Biais de sélection, de mesure et de confusion",
  "Choix du critère de jugement principal",
  "Chapitre I : Question de recherche, hypothèse",
  "Chapitre II : La revue de la littérature",
  "Chapitre III : Ethique de la recherche",
  "Chapitre IV : Les études transversales",
  "Chapitre V : Les études cas-témoins",
  "Chapitre VI : Les études de cohorte",
  "Chapitre VII : Les essais cliniques",
  "Chapitre VIII : La méta-analyse",
  "Chapitre IX : Les études de stratégies diagnostiques",
  "Chapitre X : Les études économiques",
  "Chapitre XI : Les analyses de décision",
  "Chapitre XII : Biais et facteurs confondants",
  "Chapitre XIII : La rédaction du protocole",
  "Chapitre XIV : Les outils de mesure & questionnaires",
  "Chapitre XV : La mesure de la qualité de vie",
  "Chapitre XVI : Notions de statistiques pour le clinicien",
  "Chapitre XVIII : La rédaction médicale",
  "Chapitre XIX : Applicabilité et valorisation"
];

// Read GEMINI_API_KEY from .env.local
let apiKey = process.env.GEMINI_API_KEY;
try {
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\n\r]+)/);
    if (match && match[1]) {
      apiKey = match[1].trim().replace(/['"]/g, '');
    }
  }
} catch (e) {
  console.warn("⚠️ Impossible de lire .env.local", e.message);
}

if (!apiKey) {
  console.error("❌ Erreur : GEMINI_API_KEY non trouvée dans l'environnement ni dans .env.local");
  process.exit(1);
}

console.log("🔑 Clé API Gemini chargée avec succès.");

// Function to call Gemini REST API
async function generateFromGemini(prompt, schema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error [${response.status}]: ${text}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('No content returned in candidates.');
  }

  return JSON.parse(textContent);
}

// Schemas for QCM and Flashcards
const quizSchema = {
  type: 'ARRAY',
  description: "Liste des questions de quiz générées",
  items: {
    type: 'OBJECT',
    properties: {
      question: { type: 'STRING', description: "La question posée" },
      options: { 
        type: 'ARRAY', 
        items: { type: 'STRING' }, 
        description: "Les 4 choix possibles (exactement 4)" 
      },
      answerIndex: { type: 'INTEGER', description: "L'index de la bonne réponse (0, 1, 2 ou 3)" },
      explanation: { type: 'STRING', description: "L'explication détaillée de la réponse" }
    },
    required: ["question", "options", "answerIndex", "explanation"]
  }
};

const flashcardsSchema = {
  type: 'ARRAY',
  description: "Liste des flashcards générées",
  items: {
    type: 'OBJECT',
    properties: {
      question: { type: 'STRING', description: "La question ou concept au recto" },
      answer: { type: 'STRING', description: "La réponse ou définition au verso" }
    },
    required: ["question", "answer"]
  }
};

// Prompts
const getQuizPrompt = (chapter) => `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère un questionnaire d'évaluation (QCM) de 5 questions uniques, réalistes et intimement liées au sujet médical ou méthodologique suivant : "${chapter}".
Les questions ne doivent pas être génériques, mais doivent s'apparenter à de petits cas cliniques ou scénarios pratiques de recherche clinique.

Répartition thématique des 5 questions (à respecter impérativement) :
1. **Objectif & Critère de jugement** : Choix ou formulation du critère de jugement principal (endpoint) le plus adapté et pertinent pour évaluer "${chapter}".
2. **Schéma d'étude** : Sélection du design de l'étude (essai randomisé, cohorte, cas-témoins, transversale) le plus adapté aux contraintes de "${chapter}".
3. **Biais de recherche** : Scénario décrivant un biais potentiel spécifique (sélection, mesure, confusion, attrition) inhérent à "${chapter}" et comment le minimiser.
4. **Dimensionnement & Statistique** : Aspect statistique lié à "${chapter}" (choix de la puissance, ajustement sur variables de confusion, calcul du NSN ou test statistique).
5. **Réglementation & Éthique (Algérie)** : Mise en situation éthique ou administrative régie par la Loi algérienne n° 18-11 relative à la santé (consentement écrit, comité d'éthique médicale locale, pénalités) dans le cadre de "${chapter}".

Pour chaque question, fournis 4 options de réponse (dont une seule est correcte), l'index de la réponse correcte (0 à 3) et une explication claire.`;

const getFlashcardsPrompt = (chapter) => `Tu es un tuteur expert en méthodologie de recherche clinique RECIF.
Génère 5 flashcards d'apprentissage (recto-verso) uniques et stimulantes spécifiquement adaptées au sujet suivant : "${chapter}".
Chaque flashcard doit interroger un enjeu méthodologique, statistique ou réglementaire (Loi n° 18-11 relative à la santé en Algérie) concret lié à ce sujet.`;

async function main() {
  const outputPath = path.join(__dirname, '../src/data/pregenerated-exercises.json');
  let database = {};

  // Load existing database if exists, to allow resume
  if (fs.existsSync(outputPath)) {
    try {
      database = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log(`📦 Base existante chargée avec ${Object.keys(database).length} chapitres.`);
    } catch (e) {
      console.warn("⚠️ Impossible de lire la base existante, création d'une nouvelle.");
    }
  }

  for (let i = 0; i < RECIF_CHAPTERS.length; i++) {
    const chapter = RECIF_CHAPTERS[i];
    console.log(`\n---------------------------------------------`);
    console.log(`🚀 [${i + 1}/${RECIF_CHAPTERS.length}] Chapitre : "${chapter}"`);

    if (database[chapter] && database[chapter].quiz && database[chapter].quiz.length === 5 && database[chapter].flashcards && database[chapter].flashcards.length === 5) {
      console.log(`✅ Chapitre déjà complet dans la base locale. Passage au suivant.`);
      continue;
    }

    database[chapter] = database[chapter] || {};

    // 1. Generate Quiz (QCM)
    let quizGenerated = false;
    let attempts = 0;
    while (!quizGenerated && attempts < 3) {
      try {
        console.log(`   - Génération du Quiz...`);
        const quiz = await generateFromGemini(getQuizPrompt(chapter), quizSchema);
        if (quiz && quiz.length === 5) {
          database[chapter].quiz = quiz;
          quizGenerated = true;
          console.log(`     ✓ Quiz généré avec succès !`);
        } else {
          throw new Error(`Invalid number of questions generated: ${quiz ? quiz.length : 0}`);
        }
      } catch (err) {
        attempts++;
        console.warn(`   ⚠️ Échec QCM (essai ${attempts}/3) : ${err.message}`);
        await new Promise(r => setTimeout(r, 6000 * attempts)); // wait before retry
      }
    }

    // Delay to avoid rate limit (free tier limit is 15 RPM)
    await new Promise(r => setTimeout(r, 4000));

    // 2. Generate Flashcards
    let flashcardsGenerated = false;
    attempts = 0;
    while (!flashcardsGenerated && attempts < 3) {
      try {
        console.log(`   - Génération des Flashcards...`);
        const flashcards = await generateFromGemini(getFlashcardsPrompt(chapter), flashcardsSchema);
        if (flashcards && flashcards.length === 5) {
          database[chapter].flashcards = flashcards;
          flashcardsGenerated = true;
          console.log(`     ✓ Flashcards générées avec succès !`);
        } else {
          throw new Error(`Invalid number of flashcards generated: ${flashcards ? flashcards.length : 0}`);
        }
      } catch (err) {
        attempts++;
        console.warn(`   ⚠️ Échec Flashcards (essai ${attempts}/3) : ${err.message}`);
        await new Promise(r => setTimeout(r, 6000 * attempts)); // wait before retry
      }
    }

    // Save database progress after each chapter
    fs.writeFileSync(outputPath, JSON.stringify(database, null, 2), 'utf8');
    console.log(`💾 Base de données sauvegardée.`);

    // Delay to avoid rate limit
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log(`\n🎉 Génération terminée pour l'ensemble des 23 chapitres !`);
}

main().catch(err => {
  console.error("❌ Exception fatale dans le script :", err);
  process.exit(1);
});
