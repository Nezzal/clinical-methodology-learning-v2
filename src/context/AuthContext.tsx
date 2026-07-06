'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  deleteUser,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, isFirebaseEnabled, db } from '@/utils/firebase';
import { getProgress, saveProgress, resetProgress } from '@/utils/storage';
import { 
  loadUserProfile, 
  syncUserProfile, 
  loadFirestoreProtocols, 
  saveFirestoreProtocol,
  updateUserLastActive,
  FirestoreUser
} from '@/utils/firestore';

interface AuthContextType {
  user: User | null;
  profile: FirestoreUser | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  isSuspended: boolean;
  requirePasswordChange: boolean;
  guestMode: boolean;
  isAdmin: boolean;
  role: 'admin' | 'teacher' | 'student' | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  enableGuestMode: () => void;
  disableGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isFirebaseConfigured: false,
  isSuspended: false,
  requirePasswordChange: false,
  guestMode: false,
  isAdmin: false,
  role: null,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logout: async () => {},
  changePassword: async () => {},
  sendPasswordReset: async () => {},
  enableGuestMode: () => {},
  disableGuestMode: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Charger les modes hors-ligne depuis localStorage au montage (côté client)
  useEffect(() => {
    const savedGuest = localStorage.getItem('guest_mode_active') === 'true';
    if (savedGuest) {
      setGuestMode(true);
    }
    
    const savedOfflineAdmin = localStorage.getItem('offline_admin_active') === 'true';
    if (savedOfflineAdmin) {
      const cachedEmail = localStorage.getItem('offline_admin_email') || 'admin@recif.dz';
      const isSuperAdmin = cachedEmail === 'admin@recif.dz';
      
      setUser({
        uid: 'offline_admin_uid',
        email: cachedEmail,
        displayName: isSuperAdmin ? 'Superviseur RECIF (Hors-ligne)' : 'Enseignant RECIF (Hors-ligne)',
        photoURL: null,
        getIdTokenResult: async () => ({
          claims: { role: isSuperAdmin ? 'admin' : 'teacher' }
        })
      } as any);
      setRole(isSuperAdmin ? 'admin' : 'teacher');
      setIsAdmin(true);
      setGuestMode(false);
      setProfile({
        uid: 'offline_admin_uid',
        email: cachedEmail,
        displayName: isSuperAdmin ? 'Superviseur RECIF (Hors-ligne)' : 'Enseignant RECIF (Hors-ligne)',
        photoURL: null,
        level: 'Avancé',
        role: isSuperAdmin ? 'admin' : 'teacher',
        stats: {},
        updatedAt: new Date()
      } as any);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseEnabled || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Interception pour la session admin hors-ligne persistante
      if (typeof window !== 'undefined' && localStorage.getItem('offline_admin_active') === 'true') {
        const cachedEmail = localStorage.getItem('offline_admin_email') || 'admin@recif.dz';
        const isSuperAdmin = cachedEmail === 'admin@recif.dz';
        
        setUser({
          uid: 'offline_admin_uid',
          email: cachedEmail,
          displayName: isSuperAdmin ? 'Superviseur RECIF (Hors-ligne)' : 'Enseignant RECIF (Hors-ligne)',
          photoURL: null,
          getIdTokenResult: async () => ({
            claims: { role: isSuperAdmin ? 'admin' : 'teacher' }
          })
        } as any);
        setRole(isSuperAdmin ? 'admin' : 'teacher');
        setIsAdmin(true);
        setGuestMode(false);
        setProfile({
          uid: 'offline_admin_uid',
          email: cachedEmail,
          displayName: isSuperAdmin ? 'Superviseur RECIF (Hors-ligne)' : 'Enseignant RECIF (Hors-ligne)',
          photoURL: null,
          level: 'Avancé',
          role: isSuperAdmin ? 'admin' : 'teacher',
          stats: {},
          updatedAt: new Date()
        } as any);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      if (currentUser) {
        // Si un utilisateur Firebase se connecte, désactiver le mode invité
        setGuestMode(false);
        localStorage.removeItem('guest_mode_active');

        try {
          // Force le rafraîchissement du token pour obtenir les derniers Custom Claims
          const tokenResult = await currentUser.getIdTokenResult(true);
          const claimRole = tokenResult.claims.role as 'admin' | 'teacher' | 'student' | null;
          setRole(claimRole || 'student');
          setIsAdmin(claimRole === 'admin' || claimRole === 'teacher');
        } catch (err) {
          console.error("❌ Erreur lors du chargement des Custom Claims:", err);
          setRole('student');
          setIsAdmin(false);
        }
      } else {
        setProfile(null);
        setRole(null);
        setIsAdmin(false);
        setIsSuspended(false);
        setRequirePasswordChange(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Écoute en temps réel du profil Firestore de l'utilisateur connecté
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }

    // Si on est en mode admin hors-ligne, ne pas écouter Firestore via onSnapshot (qui échouerait)
    if (typeof window !== 'undefined' && localStorage.getItem('offline_admin_active') === 'true') {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data() as FirestoreUser;
        setProfile(profileData);
        setIsSuspended(profileData.status === 'suspended');
        setRequirePasswordChange(!!profileData.requirePasswordChange);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.warn("⚠️ Information : Erreur onSnapshot profil (fonctionnement hors-ligne possible):", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Synchronisation automatique après connexion
  useEffect(() => {
    if (!user) return;

    // Si on est en mode admin hors-ligne, ne pas tenter de synchronisation Firestore
    if (typeof window !== 'undefined' && localStorage.getItem('offline_admin_active') === 'true') {
      return;
    }

    const syncOnLogin = async () => {
      try {
        const profileData = await loadUserProfile(user.uid);
        if (profileData) {
          // L'utilisateur existe déjà dans Firestore -> Télécharger ses données
          const localStats = getProgress();
          const mergedStats = {
            ...localStats,
            ...profileData.stats,
            // Garder les protocoles récents locaux au cas où, mais fusionner ou recharger
            recentProtocols: localStats.recentProtocols || []
          };
          saveProgress(mergedStats);

          const firestoreProtos = await loadFirestoreProtocols(user.uid);
          const finalStats = firestoreProtos.length > 0 ? {
            ...mergedStats,
            recentProtocols: firestoreProtos
          } : mergedStats;
          
          saveProgress(finalStats);

          // Si l'e-mail enregistré dans Firestore est différent de l'e-mail Firebase Auth (ex: e-mail changé dans la console)
          if (user.email && profileData.email !== user.email) {
            console.log(`🔄 Mise à jour de l'e-mail Firestore (${profileData.email} -> ${user.email})`);
            await syncUserProfile(user.uid, user.email, profileData.displayName, profileData.photoURL, finalStats, profileData.requirePasswordChange);
          }
        } else {
          // Si le profil n'existe pas dans Firestore, on vérifie si l'e-mail se termine par @recif.dz (compte enseignant/admin officiel)
          const email = (user.email || '').toLowerCase();
          const isOfficialEmail = email.endsWith('@recif.dz');

          if (!isOfficialEmail) {
            console.warn("🚫 Tentative d'accès non autorisée : Aucun profil Firestore trouvé et email non officiel.");
            alert("Accès refusé. Votre inscription n'a pas encore été validée par un administrateur.");
            try {
              // Supprime immédiatement le compte créé dans Firebase Auth pour éviter de laisser un compte orphelin
              await deleteUser(user);
              console.log("🗑️ Compte non autorisé supprimé de Firebase Authentication avec succès.");
            } catch (deleteErr) {
              console.error("Erreur lors de la suppression du compte Auth:", deleteErr);
              if (auth) {
                await signOut(auth);
              }
            }
            return;
          }

          // Si c'est un compte officiel @recif.dz, on lui crée son profil Firestore automatiquement
          const currentLocalStats = getProgress();
          await syncUserProfile(user.uid, user.email, user.displayName || 'Superviseur RECIF', user.photoURL, currentLocalStats, false);
        }

        // Déclencher un événement de mise à jour de l'UI
        window.dispatchEvent(new Event('progress_changed'));
      } catch (error) {
        console.warn('⚠️ Synchronisation au login (utilisation du cache local/mode hors-ligne) :', error);
      }
    };

    syncOnLogin();
  }, [user]);

  // Écoute de l'activité pour mettre à jour la présence (heartbeat toutes les 60s)
  useEffect(() => {
    if (!user || !role) return;

    if (role === 'admin' || role === 'teacher') return; // Ne pas tracker les administrateurs/enseignants

    // Si on est en mode admin hors-ligne, ne pas tracker l'activité
    if (typeof window !== 'undefined' && localStorage.getItem('offline_admin_active') === 'true') {
      return;
    }

    // Mettre à jour immédiatement
    updateUserLastActive(user.uid).catch(err => console.warn("⚠️ Heartbeat error (mode hors-ligne ou réseau) :", err));

    // Puis périodiquement toutes les 60 secondes
    const interval = setInterval(() => {
      updateUserLastActive(user.uid).catch(err => console.warn("⚠️ Heartbeat error (mode hors-ligne ou réseau) :", err));
    }, 60000);

    return () => clearInterval(interval);
  }, [user, role]);

  const signInWithGoogle = async () => {
    if (!isFirebaseEnabled || !auth) throw new Error('Firebase non configuré');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const isOfficialEmail = cleanEmail === 'admin@recif.dz' || cleanEmail === 'enseignant@recif.dz' || cleanEmail.endsWith('@recif.dz');

    const tryOfflineLogin = async () => {
      const response = await fetch('/api/auth/offline-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('offline_admin_active', 'true');
        localStorage.setItem('offline_admin_email', cleanEmail);
        
        const mockUser = {
          uid: data.uid || 'offline_admin_uid',
          email: cleanEmail,
          displayName: data.displayName || 'Superviseur RECIF (Hors-ligne)',
          photoURL: null,
          getIdTokenResult: async () => ({
            claims: { role: data.role || 'admin' }
          })
        };
        
        setUser(mockUser as any);
        setRole(data.role || 'admin');
        setIsAdmin(data.role === 'admin' || data.role === 'teacher');
        setGuestMode(false);
        localStorage.removeItem('guest_mode_active');
        
        setProfile({
          uid: 'offline_admin_uid',
          email: cleanEmail,
          displayName: data.displayName || 'Superviseur RECIF (Hors-ligne)',
          photoURL: null,
          level: 'Avancé',
          role: data.role || 'admin',
          stats: {},
          updatedAt: new Date()
        } as any);
        
        return;
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Mot de passe hors-ligne incorrect.');
      }
    };

    if (typeof window !== 'undefined' && !navigator.onLine && isOfficialEmail) {
      return await tryOfflineLogin();
    }

    if (!isFirebaseEnabled || !auth) throw new Error('Firebase non configuré');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed' && isOfficialEmail) {
        console.log("🔌 Détection de serveurs Firebase injoignables. Tentative de connexion admin hors-ligne...");
        return await tryOfflineLogin();
      }
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    if (!isFirebaseEnabled || !auth) throw new Error('Firebase non configuré');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
  };

  const enableGuestMode = () => {
    setGuestMode(true);
    localStorage.setItem('guest_mode_active', 'true');
  };

  const disableGuestMode = () => {
    setGuestMode(false);
    localStorage.removeItem('guest_mode_active');
  };

  const logout = async () => {
    setGuestMode(false);
    localStorage.removeItem('guest_mode_active');
    localStorage.removeItem('offline_admin_active');
    localStorage.removeItem('offline_admin_email');
    
    if (isFirebaseEnabled && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("Erreur signOut:", err);
      }
    }
    
    setUser(null);
    setProfile(null);
    setRole(null);
    setIsAdmin(false);
    setIsSuspended(false);
    setRequirePasswordChange(false);
    resetProgress();
    window.dispatchEvent(new Event('progress_changed'));
  };

  const changePassword = async (newPassword: string) => {
    if (!isFirebaseEnabled || !auth || !auth.currentUser || !db) {
      throw new Error('Firebase non configuré ou utilisateur non connecté');
    }
    // Mettre à jour dans Firebase Auth
    await updatePassword(auth.currentUser, newPassword);
    // Mettre à jour dans Firestore
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await setDoc(userDocRef, { requirePasswordChange: false, updatedAt: serverTimestamp() }, { merge: true });
    setRequirePasswordChange(false);
  };

  const sendPasswordReset = async (email: string) => {
    if (!isFirebaseEnabled || !auth) {
      throw new Error('Firebase non configuré');
    }
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isFirebaseConfigured: isFirebaseEnabled,
      isSuspended,
      requirePasswordChange,
      guestMode,
      isAdmin,
      role,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      changePassword,
      sendPasswordReset,
      enableGuestMode,
      disableGuestMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
