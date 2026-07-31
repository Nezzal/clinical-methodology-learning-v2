/* eslint-disable @typescript-eslint/no-require-imports */
import type * as AdminTypes from 'firebase-admin';

let adminModuleInstance: unknown = null;

function getAdminModule() {
  if (adminModuleInstance !== null) return adminModuleInstance as typeof AdminTypes;
  try {
    const mod = require('firebase-admin');
    adminModuleInstance = mod.default || mod;
  } catch (err) {
    console.warn("⚠️ [Firebase Admin] Impossible de charger le module firebase-admin:", err);
    adminModuleInstance = false;
  }
  return adminModuleInstance as typeof AdminTypes | false;
}

function initAdminSDK() {
  const adminSDK = getAdminModule();
  if (!adminSDK) return null;

  if (!adminSDK.apps || !adminSDK.apps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const isServiceAccountConfigured = !!(clientEmail && privateKey);

    if (isServiceAccountConfigured) {
      try {
        adminSDK.initializeApp({
          credential: adminSDK.credential.cert({
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
        adminSDK.initializeApp({
          projectId: projectId || 'clinical-methodology-learning'
        });
      } catch (e) {
        console.warn('⚠️ [Firebase Admin] Mode hors-ligne/local sans identifiants GCP:', e);
      }
    }
  }
  return adminSDK;
}

const adminApp = initAdminSDK();

function safeGetAdminAuth() {
  try {
    if (adminApp && adminApp.apps && adminApp.apps.length) {
      return adminApp.auth();
    }
  } catch (e) {
    console.warn("⚠️ [Firebase Admin] Erreur lors de l'obtention de adminAuth:", e);
  }
  return null;
}

function safeGetAdminDb() {
  try {
    if (adminApp && adminApp.apps && adminApp.apps.length) {
      return adminApp.firestore();
    }
  } catch (e) {
    console.warn("⚠️ [Firebase Admin] Erreur lors de l'obtention de adminDb:", e);
  }
  return null;
}

export const admin = adminApp as typeof AdminTypes;
export const adminAuth = safeGetAdminAuth() as AdminTypes.auth.Auth;
export const adminDb = safeGetAdminDb() as AdminTypes.firestore.Firestore;

/**
 * Valide l'authentification et l'état actif (non suspendu) de l'utilisateur.
 * S'adapte en toute transparence au mode local, hors-ligne et Ollama.
 */
export async function verifyUserAuth(req: Request) {
  const providerHeader = req.headers.get('x-ai-provider');
  const isOfflineProvider = providerHeader === 'ollama';

  const authHeader = req.headers.get('Authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const isServiceAccountConfigured = !!(clientEmail && privateKey);

  // En mode Ollama, ou sans compte de service Firebase, ou avec jeton hors-ligne : autoriser la requête
  if (
    isOfflineProvider ||
    !isServiceAccountConfigured ||
    !adminAuth ||
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
    if (adminDb) {
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
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Échec de vérification du jeton utilisateur:", errMsg);
    if (isOfflineProvider) {
      return { decodedToken: { uid: idToken || 'offline_user_uid', role: 'teacher' } };
    }
    return { error: "Session invalide ou expirée", status: 401 };
  }
}
