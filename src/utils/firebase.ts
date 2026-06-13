import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Vérifie si les clés Firebase sont configurées
export const isFirebaseEnabled = !!(
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

// Nettoyer les clés Firestore obsolètes de localStorage au démarrage pour libérer le quota (évite QuotaExceededError)
if (typeof window !== 'undefined') {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('firestore_') || key.startsWith('@firebase/'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      console.log(`🧹 Nettoyage de ${keysToRemove.length} clé(s) Firestore obsolète(s) dans localStorage.`);
    }
  } catch (e) {
    console.warn('⚠️ Échec du nettoyage de localStorage:', e);
  }
}

let app;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseEnabled) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    
    // Initialise Firestore avec le cache persistant multi-onglet (évite les conflits d'accès exclusif IndexedDB)
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });

    // Gérer l'état réseau de Firestore de manière transparente pour éviter le spam de connexion en console
    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        if (db) {
          enableNetwork(db)
            .then(() => console.log('⚡ Connexion Firestore restaurée (Online)'))
            .catch(err => console.warn('⚠️ Erreur enableNetwork Firestore:', err));
        }
      };
      const handleOffline = () => {
        if (db) {
          disableNetwork(db)
            .then(() => console.log('🔌 Firestore configuré en mode déconnecté (Offline)'))
            .catch(err => console.warn('⚠️ Erreur disableNetwork Firestore:', err));
        }
      };

      // Si le navigateur est déjà hors-ligne au chargement
      if (!navigator.onLine) {
        disableNetwork(db)
          .then(() => console.log('🔌 Firestore démarré en mode déconnecté (Offline)'))
          .catch(err => console.warn('⚠️ Erreur disableNetwork initial:', err));
      }

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
  } catch (error) {
    console.error('❌ Échec de l\'initialisation de Firebase client:', error);
  }
}

export { app, auth, db };

