import * as admin from 'firebase-admin';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

const isServiceAccountConfigured = !!(clientEmail && privateKey);

if (!admin.apps.length) {
  if (isServiceAccountConfigured) {
    console.log('🔌 [Firebase Admin] Initialisation du SDK avec compte de service.');
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } catch (e) {
      console.warn("⚠️ [Firebase Admin] Erreur d'initialisation du compte de service:", e);
    }
  } else {
    try {
      console.log('🔌 [Firebase Admin] Essai d\'initialisation avec identifiants GCP par défaut...');
      admin.initializeApp();
    } catch (e) {
      console.warn('⚠️ [Firebase Admin] Mode hors-ligne/local sans identifiants GCP.');
    }
  }
}

export const adminAuth = (admin.apps.length ? admin.auth() : null) as admin.auth.Auth;
export const adminDb = (admin.apps.length ? admin.firestore() : null) as admin.firestore.Firestore;
export { admin };

/**
 * Valide l'authentification et l'état actif (non suspendu) de l'utilisateur.
 * S'adapte en toute transparence au mode local, hors-ligne et Ollama.
 */
export async function verifyUserAuth(req: Request) {
  const providerHeader = req.headers.get('x-ai-provider');
  const isOfflineProvider = providerHeader === 'ollama';

  const authHeader = req.headers.get('Authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

  // En mode Ollama, ou sans compte de service Firebase, ou avec jeton hors-ligne : autoriser la requête
  if (
    isOfflineProvider ||
    !isServiceAccountConfigured ||
    !admin.apps.length ||
    !idToken ||
    idToken.startsWith('offline_') ||
    idToken === 'null' ||
    idToken === 'undefined'
  ) {
    return {
      decodedToken: {
        uid: idToken || 'offline_user_uid',
        role: 'teacher'
      }
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Vérifier si l'utilisateur est suspendu dans Firestore (si la DB est disponible)
    if (adminDb && admin.apps.length) {
      try {
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.status === 'suspended') {
            return { error: "Votre compte est suspendu. Accès interdit aux services d'IA.", status: 403 };
          }
        }
      } catch (dbErr) {
        console.warn("⚠️ [Firebase Admin] Impossible d'interroger Firestore pour la suspension:", dbErr);
      }
    }
    
    return { decodedToken };
  } catch (err: any) {
    console.error("❌ Échec de vérification du jeton utilisateur:", err.message);
    if (isOfflineProvider) {
      return { decodedToken: { uid: idToken || 'offline_user_uid', role: 'teacher' } };
    }
    return { error: "Session invalide ou expirée", status: 401 };
  }
}
