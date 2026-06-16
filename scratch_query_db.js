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
  // Parse private key from .env.local formatted string
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

  async function queryStudent() {
    console.log('Querying student profile...');
    const usersRef = db.collection('users');
    const qSnap = await usersRef.where('email', '==', 'bouhidel.wissam@gmail.com').get();
    
    if (qSnap.empty) {
      console.log('❌ Student not found in Firestore.');
      return;
    }

    const studentDoc = qSnap.docs[0];
    const studentData = studentDoc.data();
    console.log('✅ Student found:', studentData.uid, studentData.displayName);

    console.log('Querying student protocols...');
    const protocolsRef = db.collection('users').doc(studentData.uid).collection('protocols');
    const pSnap = await protocolsRef.orderBy('createdAt', 'desc').get();

    console.log(`Found ${pSnap.size} protocols:`);
    pSnap.forEach(doc => {
      const p = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Title: ${p.title}`);
      console.log(`  Acronym: ${p.acronym}`);
      console.log(`  Date: ${p.date}`);
      console.log(`  Has CRF: ${p.crfContent ? 'YES (' + p.crfContent.substring(0, 50) + '...)' : 'NO'}`);
      console.log(`  Is Fallback CRF: ${p.crfContent && p.crfContent.includes('algorithme local') ? 'YES' : 'NO'}`);
    });
  }

  queryStudent();
} catch (error) {
  console.error('Initialization error:', error);
}
