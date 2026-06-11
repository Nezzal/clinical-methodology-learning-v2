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

async function check() {
  try {
    const email = process.argv[2] || 'thesismemoire@gmail.com';
    const user = await admin.auth().getUserByEmail(email);
    console.log(`👤 Utilisateur : ${user.displayName} (${email})`);
    console.log(`🆔 UID : ${user.uid}`);
    console.log(`🔑 Claims Personnalisés :`, user.customClaims);
    
    const docSnap = await admin.firestore().collection('users').doc(user.uid).get();
    if (docSnap.exists) {
      console.log(`📄 Document Firestore :`, docSnap.data());
    } else {
      console.log(`❌ Aucun document trouvé dans la collection 'users' de Firestore pour cet UID.`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
}
check();
