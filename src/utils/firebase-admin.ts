import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    console.log('🔌 [Firebase Admin] Initialisation du SDK avec compte de service.');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    console.log('🔌 [Firebase Admin] Initialisation avec les identifiants GCP par défaut.');
    admin.initializeApp();
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export { admin };

/**
 * Valide l'authentification et l'état actif (non suspendu) de l'utilisateur
 * s'appuyant sur Firebase Auth et Firestore. S'adapte au mode local.
 */
export async function verifyUserAuth(req: Request) {
  // Détecter si Firebase Admin est configuré (évite les erreurs en local pur sans configuration)
  const isFirebaseConfigured = !!(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID
  );
  
  if (!isFirebaseConfigured) {
    // Mode local pur "Zéro configuration", bypasser l'authentification
    return { decodedToken: { uid: 'offline_admin_uid', role: 'teacher' } };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: "Non autorisé (Token manquant)", status: 401 };
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Vérifier si l'utilisateur est suspendu dans Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.status === 'suspended') {
        return { error: "Votre compte est suspendu. Accès interdit aux services d'IA.", status: 403 };
      }
    }
    
    return { decodedToken };
  } catch (err: any) {
    console.error("❌ Échec de vérification du jeton utilisateur:", err.message);
    return { error: "Session invalide ou expirée", status: 401 };
  }
}
