const fs = require('fs');
const path = require('path');
const { pipeline } = require('@xenova/transformers');

const EMBEDDINGS_PATH = path.join(__dirname, '../src/data/recif-embeddings.json');
const MODEL_NAME = 'Xenova/multilingual-e5-base';

async function main() {
  const forceRebuild = process.argv.includes('--force');
  if (forceRebuild) {
    console.log('🔄 Option --force détectée : recalcul complet de tous les embeddings locaux.');
  }

  console.log('📖 Chargement du fichier recif-embeddings.json...');
  if (!fs.existsSync(EMBEDDINGS_PATH)) {
    console.error(`❌ Fichier non trouvé : ${EMBEDDINGS_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(EMBEDDINGS_PATH, 'utf-8');
  const chunks = JSON.parse(rawData);
  const total = chunks.length;
  console.log(`✅ ${total} fragments chargés avec succès.`);

  console.log(`🤖 Chargement du modèle d'embeddings local : ${MODEL_NAME}...`);
  console.log('*(Note : Le téléchargement du modèle de 278 Mo commencera s\'il n\'est pas déjà mis en cache localement)*');
  
  const extractor = await pipeline('feature-extraction', MODEL_NAME);
  console.log('✅ Modèle chargé avec succès.');

  console.log('🚀 Démarrage de la génération des embeddings locaux...');
  const start = Date.now();
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const chunk = chunks[i];
    
    // Si l'embedding local E5 est déjà calculé, on le conserve !
    if (!forceRebuild && chunk.model === 'e5' && chunk.embedding && chunk.embedding.length > 0) {
      skipped++;
      continue;
    }

    // Le modèle E5 requiert le préfixe "passage: " pour les documents à indexer
    const textToEmbed = `passage: ${chunk.text}`;

    try {
      const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
      chunk.embedding = Array.from(output.data);
      chunk.model = 'e5'; // Marquer comme calculé par E5
    } catch (err) {
      console.error(`❌ Erreur lors du calcul du fragment ${i} :`, err);
      process.exit(1);
    }

    if ((i + 1) % 20 === 0 || i === total - 1) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const pct = (((i + 1) / total) * 100).toFixed(1);
      console.log(`⏳ Progression : ${i + 1} / ${total} (${pct}%) traités (passés : ${skipped}) en ${elapsed}s...`);
    }
  }

  console.log('💾 Sauvegarde du nouveau fichier recif-embeddings.json...');
  fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(chunks, null, 2), 'utf-8');
  
  const totalTime = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`🎉 Ré-indexation complétée avec succès en ${totalTime}s ! (${skipped} fragments conservés depuis le cache)`);
}

main().catch(err => {
  console.error('❌ Erreur critique dans le script de ré-indexation :', err);
  process.exit(1);
});
