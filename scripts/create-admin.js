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
    console.log('✅ [Env] .env.local chargé pour le script de création.');
  } else {
    console.warn('⚠️ [Env] Aucun fichier .env.local trouvé.');
  }
}

loadEnv();

const admin = require('firebase-admin');

const email = process.argv[2];
const password = process.argv[3];
const role = process.argv[4] || 'admin';

if (!email || !password) {
  console.log('Usage: node scripts/create-admin.js <email> <password> [role]');
  console.log('Roles: admin, teacher (default: admin)');
  process.exit(1);
}

const targetRole = role.toLowerCase().trim();

if (!['admin', 'teacher'].includes(targetRole)) {
  console.error('❌ Rôle invalide. Les choix sont : admin, teacher');
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
  const cleanEmail = email.toLowerCase().trim();
  
  try {
    let userRecord;
    try {
      // 1. Vérifier si l'utilisateur existe déjà en ligne
      userRecord = await admin.auth().getUserByEmail(cleanEmail);
      console.log(`ℹ️ L'utilisateur ${cleanEmail} existe déjà (UID: ${userRecord.uid}). Mise à jour du mot de passe...`);
      await admin.auth().updateUser(userRecord.uid, { password: password });
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        console.log(`🆕 Création de l'utilisateur ${cleanEmail} dans Firebase Auth...`);
        userRecord = await admin.auth().createUser({
          email: cleanEmail,
          password: password,
          displayName: targetRole === 'admin' ? 'Superviseur RECIF' : 'Enseignant RECIF',
          emailVerified: true
        });
      } else {
        throw authErr;
      }
    }

    // 2. Attribuer le Custom Claim de rôle (admin ou teacher)
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: targetRole });
    console.log(`✅ Rôle "${targetRole}" appliqué aux Custom Claims de l'utilisateur.`);

    // 3. Créer ou mettre à jour le profil Firestore
    const db = admin.firestore();
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      email: cleanEmail,
      displayName: targetRole === 'admin' ? 'Superviseur RECIF' : 'Enseignant RECIF',
      role: targetRole,
      status: 'active',
      level: 'Avancé',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Profil Firestore créé/mis à jour.`);

    console.log(`\n🎉 Compte créé/configuré avec succès en ligne !`);
    console.log(`📧 E-mail : ${cleanEmail}`);
    console.log(`🔑 Mot de passe : ${password}`);
    console.log(`🛡️ Rôle : ${targetRole}`);
    console.log(`\nVous pouvez maintenant vous connecter en LIGNE sur la plateforme avec ces identifiants.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la création du compte :', error.message || error);
    process.exit(1);
  }
}

run();
