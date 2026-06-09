const fs = require('fs');
const path = require('path');

// Fonction simple pour charger .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join('=').trim();
          
          // Supprimer les guillemets de début et de fin si présents
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.slice(1, -1);
          }
          
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
    console.log('✅ [Env] .env.local chargé pour le script CLI.');
  } else {
    console.warn('⚠️ [Env] Aucun fichier .env.local trouvé.');
  }
}

loadEnv();

const admin = require('firebase-admin');

const email = process.argv[2];
const role = process.argv[3];

if (!email || !role) {
  console.log('Usage: node scripts/set-admin.js <email> <role>');
  console.log('Roles: admin, teacher, student, null (pour réinitialiser)');
  process.exit(1);
}

const targetRole = role === 'null' ? null : role;

if (targetRole && !['admin', 'teacher', 'student'].includes(targetRole)) {
  console.error('❌ Rôle invalide. Les choix sont : admin, teacher, student, null');
  process.exit(1);
}

// Initialiser le SDK Admin
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!clientEmail || !privateKey) {
  console.error('❌ Erreur : FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY doivent être renseignés dans .env.local');
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
} catch (err) {
  console.error('❌ Échec de l\'initialisation de Firebase Admin:', err.message);
  process.exit(1);
}

async function run() {
  try {
    const user = await admin.auth().getUserByEmail(email.toLowerCase().trim());
    console.log(`User trouvé : ${user.displayName || 'Sans nom'} (UID: ${user.uid})`);
    
    // Attribuer les claims d'authentification
    await admin.auth().setCustomUserClaims(user.uid, targetRole ? { role: targetRole } : null);
    console.log(`✅ Custom Claim { role: "${targetRole}" } appliqué avec succès à ${email}`);
    
    // Mettre également à jour le rôle dans le document de profil Firestore pour cohérence
    const db = admin.firestore();
    const userDocRef = db.collection('users').doc(user.uid);
    const userSnap = await userDocRef.get();
    
    if (userSnap.exists) {
      await userDocRef.set({ role: targetRole || 'student' }, { merge: true });
      console.log(`✅ Profil Firestore mis à jour avec le rôle : "${targetRole || 'student'}"`);
    } else {
      console.log('⚠️ Profil Firestore inexistant, création du profil...');
      await userDocRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Utilisateur',
        role: targetRole || 'student',
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Profil Firestore initialisé.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution du script :', error.message || error);
    process.exit(1);
  }
}

run();
