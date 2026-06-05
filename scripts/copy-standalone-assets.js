const fs = require('fs');
const path = require('path');

const srcPublic = path.join(__dirname, '../public');
const srcStatic = path.join(__dirname, '../.next/static');

const destStandalone = path.join(__dirname, '../.next/standalone');
const destPublic = path.join(destStandalone, 'public');
const destStatic = path.join(destStandalone, '.next/static');

console.log('📦 Début de la copie des ressources statiques pour Next.js Standalone...');

// Fonction récursive de copie de dossier compatible toutes versions Node
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Source non trouvée : ${src}`);
    return;
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  if (!fs.existsSync(destStandalone)) {
    console.error(`❌ Le dossier standalone n'existe pas (${destStandalone}). Avez-vous exécuté 'npm run build' ?`);
    process.exit(1);
  }

  console.log(`- Copie de 'public' vers '${destPublic}'...`);
  copyDir(srcPublic, destPublic);

  console.log(`- Copie de '.next/static' vers '${destStatic}'...`);
  copyDir(srcStatic, destStatic);

  console.log('✅ Copie des ressources statiques terminée avec succès !');
} catch (error) {
  console.error('❌ Erreur lors de la copie des ressources statiques :', error);
  process.exit(1);
}
