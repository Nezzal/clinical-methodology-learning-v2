const fs = require('fs');
const path = require('path');
const { generateKeyPairSync, createPrivateKey, createSign } = require('crypto');

const keysDir = path.join(__dirname, 'license-keys');
const privateKeyPath = path.join(keysDir, 'private.json');
const publicKeyPath = path.join(__dirname, '../src/utils/license-public-key.json');

// Assurer l'existence du dossier de clés
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

// Initialisation des clés si nécessaire
function initKeys() {
  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    console.log('✅ Paire de clés cryptographiques existante détectée.');
    return;
  }

  console.log('🔑 Génération d\'une nouvelle paire de clés ECDSA (P-256)...');
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'jwk' },
    privateKeyEncoding: { type: 'pkcs8', format: 'jwk' }
  });

  fs.writeFileSync(privateKeyPath, JSON.stringify(privateKey, null, 2), 'utf8');
  fs.writeFileSync(publicKeyPath, JSON.stringify(publicKey, null, 2), 'utf8');
  console.log('✅ Clé privée secrète sauvegardée dans : scripts/license-keys/private.json (A NE JAMAIS DISTRIBUER !)');
  console.log('✅ Clé publique sauvegardée dans : src/utils/license-public-key.json (Sera compilée dans l\'application client)');
}

// Génération d'un code de licence
function generateLicense(email, expiresAt, tier = 'pro') {
  initKeys();

  const cleanEmail = email.toLowerCase().trim();
  const expiresTimestamp = new Date(expiresAt).getTime();
  
  if (isNaN(expiresTimestamp)) {
    console.error('❌ Date d\'expiration invalide. Format attendu : AAAA-MM-JJ (ex: 2027-07-26)');
    process.exit(1);
  }

  const licenseData = {
    email: cleanEmail,
    expiresAt: expiresTimestamp,
    tier: tier.toLowerCase(),
    generatedAt: Date.now()
  };

  const privateKeyJWK = JSON.parse(fs.readFileSync(privateKeyPath, 'utf8'));
  const privateKeyObj = createPrivateKey({ key: privateKeyJWK, format: 'jwk' });

  // Nous signons la chaîne JSON exacte sans aucun formatage (espaces, sauts de lignes)
  const dataString = JSON.stringify(licenseData);
  const sign = createSign('SHA256');
  sign.update(dataString);
  
  // Utilisation de dsaEncoding: 'ieee-p1363' pour être compatible avec l'API Web Crypto du navigateur (Raw R+S)
  const signature = sign.sign({
    key: privateKeyObj,
    dsaEncoding: 'ieee-p1363'
  }, 'base64');

  const licenseTokenObj = {
    data: dataString, // Passage de la chaîne brute pour éviter des soucis de ré-ordonnancement JSON sur le client
    sig: signature
  };

  // Encodage en base64 pour avoir une seule chaîne de caractères facile à copier/coller
  const licenseKey = Buffer.from(JSON.stringify(licenseTokenObj)).toString('base64');

  console.log('\n================================================================');
  console.log('🎉 NOUVELLE LICENCE HORS-LIGNE CRÉÉE AVEC SUCCÈS');
  console.log('================================================================');
  console.log(`👤 Utilisateur : ${cleanEmail}`);
  console.log(`📅 Expiration : ${new Date(expiresTimestamp).toLocaleDateString('fr-FR')}`);
  console.log(`👑 Formule     : ${tier.toUpperCase()}`);
  console.log('----------------------------------------------------------------');
  console.log('🔑 CODE DE LICENCE (Copier tout le bloc ci-dessous) :');
  console.log('----------------------------------------------------------------\n');
  console.log(licenseKey);
  console.log('\n================================================================\n');
}

// Analyse des arguments en ligne de commande
const args = process.argv.slice(2);
if (args[0] === 'init') {
  initKeys();
} else if (args[0] === 'generate' && args.length >= 3) {
  const email = args[1];
  const expiresAt = args[2];
  const tier = args[3] || 'pro';
  generateLicense(email, expiresAt, tier);
} else {
  console.log(`
📚 Générateur de Licences RECIF Methodo&Clinique
------------------------------------------------
Usage :
  Générer une paire de clés :
    node scripts/generate-license.js init

  Générer un code de licence :
    node scripts/generate-license.js generate <email> <expiration_date> [tier]

Exemple :
  node scripts/generate-license.js generate docteur@hopital.dz 2027-07-26 expert
  `);
}
