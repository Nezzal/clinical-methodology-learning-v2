async function testProtocolOllama() {
  console.log('Sending request to http://localhost:3001/api/generate-protocol...');
  try {
    const response = await fetch('http://localhost:3001/api/generate-protocol', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-provider': 'ollama',
        'x-ollama-model': 'gemma4:latest'
      },
      body: JSON.stringify({
        title: 'Imprégnation mercurielle et polyexposition dans l\'orpaillage artisanal informel : étude clinique et biométrologique chez des travailleurs de la wilaya de Batna',
        acronym: 'MERGOLD-BATNA',
        methodology: 'observational',
        benefitType: 'sbid',
        question: 'Quelle est la prévalence de l\'imprégnation mercurielle ?',
        design: 'Étude transversale descriptive',
        population: 'Orpailleurs artisanaux',
        inclusion: 'Âge > 18 ans\nConsentement écrit',
        exclusion: 'Antécédents rénaux',
        primaryEndpoint: 'Taux de mercure urinaire',
        secondaryEndpoints: 'Fonction rénale',
        intervention: 'Exposition au mercure',
        objectives: 'Évaluer l\'imprégnation mercurielle',
        bias: 'Biais de sélection',
        justification: 'Justification de l\'étude',
        hypothesis: 'Hypothèse de recherche',
        logistics: 'Logistique locale',
        personnel: 'Personnel de recherche',
        budget: 'Budget de l\'étude',
        calendar: 'Calendrier de l\'étude',
        ethics: 'Considérations éthiques',
        references: 'Références bibliographiques',
        annexes: 'Annexes de l\'étude',
        samplingStrategy: 'Échantillonnage de convenance',
        dataCollection: 'Collecte sur fiches',
        dataAnalysis: 'Analyse descriptive'
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testProtocolOllama();
