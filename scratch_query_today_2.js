const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

// Initialize Firebase Admin
try {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  };

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore();

  async function queryToday2() {
    console.log('Querying users...');
    const usersSnap = await db.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
      const u = userDoc.data();
      const protocolsSnap = await db.collection('users').doc(userDoc.id).collection('protocols').get();
      if (!protocolsSnap.empty) {
        protocolsSnap.forEach(pDoc => {
          const p = pDoc.data();
          const pDate = new Date(p.date || p.createdAt);
          if (pDate.getDate() === 14 && pDate.getMonth() === 5 && pDate.getFullYear() === 2026) {
            console.log(`User: ${u.email} | ID: ${pDoc.id} | Date: ${pDate.toISOString()}`);
            console.log(`  Title: ${p.title}`);
            console.log(`  Is Fallback Protocol: ${p.content && p.content.includes('algorithme local') ? 'YES' : 'NO'}`);
            console.log(`  Is Fallback CRF: ${p.crfContent && p.crfContent.includes('algorithme local') ? 'YES' : 'NO'}`);
            console.log(`  CRF Content starts with: ${p.crfContent ? p.crfContent.substring(0, 100) : 'NULL'}`);
          }
        });
      }
    }
  }

  queryToday2();
} catch (error) {
  console.error('Error:', error);
}
