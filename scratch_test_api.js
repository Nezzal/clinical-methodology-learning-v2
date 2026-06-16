async function testApi() {
  console.log('Sending request to http://localhost:3001/api/generate-crf...');
  try {
    const response = await fetch('http://localhost:3001/api/generate-crf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-provider': 'gemini'
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
        protocolContent: 'Protocole de recherche clinique détaillé pour MERGOLD-BATNA...'
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testApi();
