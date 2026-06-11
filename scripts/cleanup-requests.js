const fs = require('fs');
const path = require('path');

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
          const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
}
loadEnv();

const admin = require('firebase-admin');
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

async function run() {
  try {
    const db = admin.firestore();
    
    // Les deux e-mails à nettoyer de la collection 'access_requests'
    const emailsToCleanup = ['amnezzal@yahoo.fr', 'thesismemoire@gmail.com'];
    
    for (const email of emailsToCleanup) {
      const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const docRef = db.collection('access_requests').doc(docId);
      
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        await docRef.delete();
        console.log(`🗑️ Demande d'accès supprimée pour : ${email} (ID: ${docId})`);
      } else {
        console.log(`ℹ️ Aucune demande d'accès en attente trouvée pour : ${email}`);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
}
run();
