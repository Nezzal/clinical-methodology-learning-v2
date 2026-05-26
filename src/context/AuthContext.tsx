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
  FirestoreUser
} from '@/utils/firestore';

interface AuthContextType {
  user: User | null;
  profile: FirestoreUser | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  isSuspended: boolean;
  requirePasswordChange: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isFirebaseConfigured: false,
  isSuspended: false,
  requirePasswordChange: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logout: async () => {},
  changePassword: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);

  useEffect(() => {
    if (!isFirebaseEnabled || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
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
          if (firestoreProtos.length > 0) {
            saveProgress({
              ...mergedStats,
              recentProtocols: firestoreProtos
            });
          }
        } else {
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

  const logout = async () => {
    if (!isFirebaseEnabled || !auth) return;
    await signOut(auth);
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
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      changePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
