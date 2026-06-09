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
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, isFirebaseEnabled, db } from '@/utils/firebase';
import { getProgress, saveProgress, resetProgress } from '@/utils/storage';
import { 
  loadUserProfile, 
  syncUserProfile, 
  loadFirestoreProtocols, 
  saveFirestoreProtocol,
  findAccessRequestByEmail,
  deleteAccessRequest,
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

  // Charger le mode invité depuis localStorage au montage (côté client)
  useEffect(() => {
    const saved = localStorage.getItem('guest_mode_active') === 'true';
    if (saved) {
      setGuestMode(true);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseEnabled || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
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
      console.error("Erreur onSnapshot profil:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Synchronisation automatique après connexion
  useEffect(() => {
    if (!user) return;

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
          // Vérification de sécurité : si le document n'existe pas et que le compte est ancien (plus de 10 minutes),
          // cela signifie que le compte a été supprimé par l'administrateur de la base de données.
          const creationTime = user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
          const isNewAccount = (Date.now() - creationTime) < 10 * 60 * 1000; // 10 minutes
          
          if (!isNewAccount) {
            console.warn("🚫 Compte Firebase Auth actif mais profil Firestore inexistant -> Compte supprimé par l'administrateur.");
            alert("Votre compte a été supprimé par l'administrateur de la plateforme.");
            if (auth) {
              await signOut(auth);
            }
            return;
          }

          // Nouvel utilisateur sur Firestore -> Tenter de récupérer son nom d'affichage à partir d'une demande d'accès
          let finalDisplayName = user.displayName;
          let reqPassChange = false;
          if (user.email) {
            try {
              const accessReq = await findAccessRequestByEmail(user.email);
              if (accessReq) {
                finalDisplayName = accessReq.name;
                reqPassChange = true;
                // Supprimer la demande d'accès puisqu'elle a été traitée avec succès
                await deleteAccessRequest(accessReq.id);
              }
            } catch (err) {
              console.error("Erreur récupération demande d'accès lors de l'initialisation:", err);
            }
          }

          const currentLocalStats = getProgress();
          await syncUserProfile(user.uid, user.email, finalDisplayName, user.photoURL, currentLocalStats, reqPassChange);

          // Pousser également ses protocoles créés localement
          if (currentLocalStats.recentProtocols && currentLocalStats.recentProtocols.length > 0) {
            for (const proto of currentLocalStats.recentProtocols) {
              await saveFirestoreProtocol(user.uid, proto);
            }
          }
        }
        // Déclencher un événement de mise à jour de l'UI
        window.dispatchEvent(new Event('progress_changed'));
      } catch (error) {
        console.error('❌ Erreur lors de la synchronisation au login:', error);
      }
    };

    syncOnLogin();
  }, [user]);

  // Écoute de l'activité pour mettre à jour la présence (heartbeat toutes les 60s)
  useEffect(() => {
    if (!user || !profile) return;

    if (role === 'admin' || role === 'teacher') return; // Ne pas tracker les administrateurs/enseignants

    // Mettre à jour immédiatement
    updateUserLastActive(user.uid).catch(err => console.error("Heartbeat error:", err));

    // Puis périodiquement toutes les 60 secondes
    const interval = setInterval(() => {
      updateUserLastActive(user.uid).catch(err => console.error("Heartbeat error:", err));
    }, 60000);

    return () => clearInterval(interval);
  }, [user, profile]);

  const signInWithGoogle = async () => {
    if (!isFirebaseEnabled || !auth) throw new Error('Firebase non configuré');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!isFirebaseEnabled || !auth) throw new Error('Firebase non configuré');
    await signInWithEmailAndPassword(auth, email, password);
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
    
    if (isFirebaseEnabled && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("Erreur signOut:", err);
      }
    }
    
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
      enableGuestMode,
      disableGuestMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
