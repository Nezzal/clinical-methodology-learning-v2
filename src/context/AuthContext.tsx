'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
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
  recordAccessLog,
  updateAccessLogPing,
  closeAccessLog,
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

interface InitialOfflineState {
  user: any;
  profile: any;
  role: 'admin' | 'teacher' | 'student';
  isAdmin: boolean;
}

const getInitialOfflineState = (): InitialOfflineState | null => {
  if (typeof window === 'undefined') return null;
  const savedLicenseStr = localStorage.getItem('recif_offline_license');
  if (savedLicenseStr) {
    try {
      const license = JSON.parse(savedLicenseStr);
      const licenseData = license?.data || license;
      if (licenseData && licenseData.email) {
        const email = licenseData.email;
        const tier = licenseData.tier || 'pro';
        const expiresAt = licenseData.expiresAt || licenseData.validUntil;
        const expTime = expiresAt ? (typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime()) : Date.now() + 86400000;

        if (expTime > Date.now()) {
          const cleanEmail = (email || '').toLowerCase();
          const isOfflineAdmin = cleanEmail === 'admin@recif.dz' || cleanEmail === 'nezzal.abdelmalek@gmail.com';
          const userRole: 'admin' | 'teacher' | 'student' = isOfflineAdmin ? 'admin' : (tier === 'ultra' ? 'teacher' : 'student');
          const uid = 'offline_license_uid_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
          const displayName = isOfflineAdmin ? 'Superviseur Methodo&Clinique (Pr Nezzal Abdelmalek)' : `Utilisateur RECIF (${tier.toUpperCase()} - Hors-ligne)`;
          
          const userObj = {
            uid,
            email: cleanEmail,
            displayName,
            photoURL: null,
            getIdToken: async () => uid,
            getIdTokenResult: async () => ({
              claims: { role: userRole }
            })
          };

          const profileObj = {
            uid,
            email: cleanEmail,
            displayName,
            photoURL: null,
            level: isOfflineAdmin ? 'Expert' : 'Intermédiaire',
            role: userRole,
            subscription: {
              tier,
              status: 'active',
              validUntil: new Date(expTime).toISOString()
            },
            stats: {},
            updatedAt: new Date()
          };

          return { user: userObj, profile: profileObj, role: userRole, isAdmin: isOfflineAdmin };
        }
      }
    } catch {
      // Ignore
    }
  }
  return null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => (getInitialOfflineState()?.user as any) || null);
  const [profile, setProfile] = useState<FirestoreUser | null>(() => (getInitialOfflineState()?.profile as any) || null);
  const [loading, setLoading] = useState(() => !getInitialOfflineState());
  const [isSuspended, setIsSuspended] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | null>(() => getInitialOfflineState()?.role || null);
  const [isAdmin, setIsAdmin] = useState(() => getInitialOfflineState()?.isAdmin || false);

  // Charger les modes hors-ligne depuis localStorage au montage (côté client)
  useEffect(() => {
    const savedGuest = localStorage.getItem('guest_mode_active') === 'true';
    if (savedGuest) {
      setGuestMode(true);
    }

    const savedLicenseStr = localStorage.getItem('recif_offline_license');
    if (savedLicenseStr) {
      try {
        const license = JSON.parse(savedLicenseStr);
        const licenseData = license?.data || license;
        if (licenseData && licenseData.email) {
          const email = licenseData.email;
          const tier = licenseData.tier || 'pro';
          const expiresAt = licenseData.expiresAt || licenseData.validUntil;
          const expTime = expiresAt ? (typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime()) : Date.now() + 86400000;

          if (expTime > Date.now()) {
            const cleanEmail = (email || '').toLowerCase();
            const isOfflineAdmin = cleanEmail === 'admin@recif.dz' || cleanEmail === 'nezzal.abdelmalek@gmail.com';
            const userRole = isOfflineAdmin ? 'admin' : (tier === 'ultra' ? 'teacher' : 'student');
            const uid = 'offline_license_uid_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
            const displayName = isOfflineAdmin ? 'Superviseur Methodo&Clinique (Pr Nezzal Abdelmalek)' : `Utilisateur RECIF (${tier.toUpperCase()} - Hors-ligne)`;
            
            setUser({
              uid,
              email: cleanEmail,
              displayName,
              photoURL: null,
              getIdToken: async () => uid,
              getIdTokenResult: async () => ({
                claims: { role: userRole }
              })
            } as any);
            setRole(userRole);
            setIsAdmin(isOfflineAdmin);
            setGuestMode(false);
            setProfile({
              uid,
              email: cleanEmail,
              displayName,
              photoURL: null,
              level: isOfflineAdmin ? 'Expert' : 'Intermédiaire',
              role: userRole,
              subscription: {
                tier,
                status: 'active',
                validUntil: new Date(expTime).toISOString()
              },
              stats: {},
              updatedAt: new Date()
            } as any);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("⚠️ Erreur lecture licence locale au montage:", err);
      }
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
        getIdToken: async () => 'offline_admin_uid',
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

    // Si pas connecté à internet, débloquer le chargement rapidement pour éviter l'écran infini
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Timer de sécurité 1.5s pour éviter d'être bloqué sur "Vérification de la session..." si Firebase stagne hors-ligne
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    if (!isFirebaseEnabled || !auth) {
      setLoading(false);
      clearTimeout(safetyTimer);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimer);

      // Si un utilisateur Firebase Auth réel est connecté, il a la priorité absolue sur le mode hors-ligne
      if (currentUser) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('offline_admin_active');
          localStorage.removeItem('offline_admin_email');
        }

        setUser(currentUser);
        setGuestMode(false);
        localStorage.removeItem('guest_mode_active');

        if (typeof window !== 'undefined') {
          const sessionLoggedKey = `recif_logged_session_${currentUser.uid}`;
          if (!sessionStorage.getItem(sessionLoggedKey)) {
            sessionStorage.setItem(sessionLoggedKey, 'true');
            recordAccessLog(currentUser.uid, currentUser.email || '', currentUser.displayName || '');
          }
        }

        try {
          // Force le rafraîchissement du token pour obtenir les derniers Custom Claims
          const tokenResult = await currentUser.getIdTokenResult(true);
          const claimRole = tokenResult.claims.role as 'admin' | 'teacher' | 'student' | null;
          const emailLower = (currentUser.email || '').toLowerCase().trim();
          const isSuperAdminEmail = emailLower === 'nezzal.abdelmalek@gmail.com' || emailLower === 'admin@recif.dz' || emailLower.includes('nezzal');
          const effectiveRole = isSuperAdminEmail ? 'admin' : (claimRole || 'student');
          setRole(effectiveRole);
          setIsAdmin(effectiveRole === 'admin' || effectiveRole === 'teacher');
        } catch (err) {
          console.error("❌ Erreur lors du chargement des Custom Claims:", err);
          const emailLower = (currentUser.email || '').toLowerCase().trim();
          const isSuperAdminEmail = emailLower === 'nezzal.abdelmalek@gmail.com' || emailLower === 'admin@recif.dz' || emailLower.includes('nezzal');
          setRole(isSuperAdminEmail ? 'admin' : 'student');
          setIsAdmin(isSuperAdminEmail);
        }
        setLoading(false);
        return;
      }

      // Si pas de currentUser Firebase, interception pour la licence hors-ligne
      const savedLicenseStr = typeof window !== 'undefined' ? localStorage.getItem('recif_offline_license') : null;
      if (savedLicenseStr) {
        try {
          const license = JSON.parse(savedLicenseStr);
          const licenseData = license?.data || license;
          if (licenseData && licenseData.email) {
            const email = licenseData.email;
            const tier = licenseData.tier || 'pro';
            const expiresAt = licenseData.expiresAt || licenseData.validUntil;
            const expTime = expiresAt ? (typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime()) : Date.now() + 86400000;

            if (expTime > Date.now()) {
              const cleanEmail = (email || '').toLowerCase();
              const isOfflineAdmin = cleanEmail === 'admin@recif.dz' || cleanEmail === 'nezzal.abdelmalek@gmail.com';
              const userRole = isOfflineAdmin ? 'admin' : (tier === 'ultra' ? 'teacher' : 'student');
              const uid = 'offline_license_uid_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
              const displayName = isOfflineAdmin ? 'Superviseur Methodo&Clinique (Pr Nezzal Abdelmalek)' : `Utilisateur RECIF (${tier.toUpperCase()} - Hors-ligne)`;
              
              setUser({
                uid,
                email: cleanEmail,
                displayName,
                photoURL: null,
                getIdToken: async () => uid,
                getIdTokenResult: async () => ({
                  claims: { role: userRole }
                })
              } as any);
              setRole(userRole);
              setIsAdmin(isOfflineAdmin);
              setGuestMode(false);
              setProfile({
                uid,
                email: cleanEmail,
                displayName,
                photoURL: null,
                level: isOfflineAdmin ? 'Expert' : 'Intermédiaire',
                role: userRole,
                subscription: {
                  tier,
                  status: 'active',
                  validUntil: new Date(expTime).toISOString()
                },
                stats: {},
                updatedAt: new Date()
              } as any);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn("⚠️ Erreur lecture licence locale dans AuthChanged:", err);
        }
      }

      // Interception pour la session admin hors-ligne persistante (seulement si pas connecté à Firebase Auth)
      if (typeof window !== 'undefined' && localStorage.getItem('offline_admin_active') === 'true') {
        const cachedEmail = localStorage.getItem('offline_admin_email') || 'admin@recif.dz';
        const isSuperAdmin = cachedEmail === 'admin@recif.dz';
        
        setUser({
          uid: 'offline_admin_uid',
          email: cachedEmail,
          displayName: isSuperAdmin ? 'Superviseur RECIF (Hors-ligne)' : 'Enseignant RECIF (Hors-ligne)',
          photoURL: null,
          getIdToken: async () => 'offline_admin_uid',
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

      setUser(null);
      setProfile(null);
      setRole(null);
      setIsAdmin(false);
      setIsSuspended(false);
      setRequirePasswordChange(false);
      setLoading(false);
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

    // Ne pas écouter Firestore seulement si l'utilisateur utilise un UID factice ET n'est pas en ligne
    const isMockUser = user.uid.startsWith('offline_');
    if (isMockUser && typeof window !== 'undefined' && !navigator.onLine) {
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

    // Ne pas tenter de synchro si UID factice hors-ligne pur sans réseau
    const isMockUser = user.uid.startsWith('offline_');
    if (isMockUser && typeof window !== 'undefined' && !navigator.onLine) {
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

  // Écoute de l'activité pour mettre à jour la présence (heartbeat toutes les 45s) et la durée du journal d'accès
  useEffect(() => {
    if (!user) return;

    let currentLogId: string | null = null;
    const startTimeMs = Date.now();

    // Enregistrer l'activité et le journal de connexion immédiatement
    updateUserLastActive(user.uid).catch(err => console.warn("⚠️ Heartbeat initial error:", err));
    recordAccessLog(user.uid, user.email || '', user.displayName || profile?.displayName || '').then(id => {
      currentLogId = id;
    });

    // Puis périodiquement toutes les 45 secondes
    const interval = setInterval(() => {
      updateUserLastActive(user.uid).catch(err => console.warn("⚠️ Heartbeat error:", err));
      if (currentLogId) {
        updateAccessLogPing(currentLogId, startTimeMs);
      }
    }, 45000);

    return () => {
      clearInterval(interval);
      if (currentLogId) {
        closeAccessLog(currentLogId, startTimeMs);
      }
    };
  }, [user]);

  const signInWithGoogle = async () => {
    if (!isFirebaseEnabled || !auth) throw new Error('Firebase non configuré');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (popupErr: any) {
      console.warn("⚠️ signInWithPopup échoué:", popupErr?.code || popupErr?.message);
      if (
        popupErr?.code === 'auth/popup-blocked' || 
        popupErr?.code === 'auth/cancelled-popup-request' ||
        popupErr?.code === 'auth/popup-closed-by-user'
      ) {
        console.log("🔄 Tentative de connexion via redirection...");
        await signInWithRedirect(auth, provider);
      } else {
        throw popupErr;
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const isOfficialEmail = cleanEmail === 'admin@recif.dz' || cleanEmail === 'enseignant@recif.dz' || cleanEmail === 'nezzal.abdelmalek@gmail.com' || cleanEmail.endsWith('@recif.dz');

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
    localStorage.removeItem('recif_offline_license');
    
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
    const cleanEmail = email.trim();
    if (!cleanEmail) throw new Error("Adresse e-mail requise.");

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible d'envoyer l'e-mail de réinitialisation.");
      }
      return;
    } catch (apiErr: any) {
      console.warn("⚠️ API réinitialisation SMTP échouée, tentative via Firebase Client SDK:", apiErr?.message);
      if (isFirebaseEnabled && auth) {
        await sendPasswordResetEmail(auth, cleanEmail);
      } else {
        throw apiErr;
      }
    }
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
