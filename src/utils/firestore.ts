import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, isFirebaseEnabled, auth, firebaseConfig } from './firebase';
import { LocalStats } from './storage';

export interface FirestoreUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  level: string;
  stats: Partial<LocalStats>;
  updatedAt: any;
  status?: 'active' | 'suspended';
  requirePasswordChange?: boolean;
}

export interface FirestoreChat {
  id: string;
  title: string;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FirestoreProtocol {
  id: string;
  title: string;
  acronym: string;
  date: string;
  content: string;
  createdAt: any;
}

// 1. Profil utilisateur et Statistiques
export async function syncUserProfile(
  uid: string, 
  email: string | null, 
  displayName: string | null, 
  photoURL: string | null, 
  stats: LocalStats,
  requirePasswordChange?: boolean
) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    
    // Déterminer le niveau
    let level = 'Débutant';
    const totalQuiz = stats.quizTotal || 0;
    const correctQuiz = stats.quizCorrect || 0;
    const quizPct = totalQuiz > 0 ? (correctQuiz / totalQuiz) * 100 : 0;
    const fcMastered = stats.flashcardsMastered?.length || 0;
    
    if (quizPct >= 80 && fcMastered >= 10) {
      level = 'Avancé';
    } else if (quizPct >= 50 || fcMastered >= 4 || stats.protocolsGenerated > 0) {
      level = 'Intermédiaire';
    }

    const payload: any = {
      uid,
      email,
      displayName,
      photoURL,
      level,
      stats: {
        questionsAsked: stats.questionsAsked,
        protocolsGenerated: stats.protocolsGenerated,
        quizCorrect: stats.quizCorrect,
        quizTotal: stats.quizTotal,
        flashcardsMastered: stats.flashcardsMastered || [],
        quizHistory: stats.quizHistory || []
      },
      updatedAt: serverTimestamp()
    };

    if (requirePasswordChange !== undefined) {
      payload.requirePasswordChange = requirePasswordChange;
    }

    await setDoc(userDocRef, payload, { merge: true });
  } catch (error) {
    console.error('❌ Erreur syncUserProfile:', error);
  }
}

export async function loadUserProfile(uid: string): Promise<FirestoreUser | null> {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as FirestoreUser;
    }
  } catch (error) {
    console.error('❌ Erreur loadUserProfile:', error);
  }
  return null;
}

// 2. Historique des chats
export async function saveFirestoreChat(
  uid: string, 
  chatId: string, 
  title: string, 
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>
) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    
    // Enregistrer l'en-tête du chat
    await setDoc(chatDocRef, {
      id: chatId,
      title,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp() // merge: true protégera la date de création
    }, { merge: true });

    // Enregistrer les messages (nous écrasons ou ajoutons à une sous-collection de messages)
    // Pour rester simple et efficace, nous pouvons stocker les messages directement dans le document de chat sous forme de tableau, 
    // ou dans une sous-collection. Un tableau de messages est très performant et économique pour le tuteur !
    const messagesClean = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }));

    await setDoc(chatDocRef, { messages: messagesClean }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur saveFirestoreChat:', error);
  }
}

export async function loadFirestoreChats(uid: string): Promise<any[]> {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return [];
  try {
    const chatsRef = collection(db, 'users', uid, 'chats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (error) {
    console.error('❌ Erreur loadFirestoreChats:', error);
    return [];
  }
}

export async function deleteFirestoreChat(uid: string, chatId: string) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    await deleteDoc(chatDocRef);
  } catch (error) {
    console.error('❌ Erreur deleteFirestoreChat:', error);
  }
}

// 3. Protocoles
export async function saveFirestoreProtocol(uid: string, protocol: { id: string; title: string; acronym: string; date: string; content: string }) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const protoDocRef = doc(db, 'users', uid, 'protocols', protocol.id);
    await setDoc(protoDocRef, {
      ...protocol,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur saveFirestoreProtocol:', error);
  }
}

export async function loadFirestoreProtocols(uid: string): Promise<FirestoreProtocol[]> {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return [];
  try {
    const protosRef = collection(db, 'users', uid, 'protocols');
    const q = query(protosRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as FirestoreProtocol);
  } catch (error) {
    console.error('❌ Erreur loadFirestoreProtocols:', error);
    return [];
  }
}

export async function deleteFirestoreProtocol(uid: string, protocolId: string) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const protoDocRef = doc(db, 'users', uid, 'protocols', protocolId);
    await deleteDoc(protoDocRef);
  } catch (error) {
    console.error('❌ Erreur deleteFirestoreProtocol:', error);
  }
}

// 4. Mode Enseignant (Supervision de tous les étudiants)
export async function getAllUsers(): Promise<FirestoreUser[]> {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return [];
  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocs(usersRef);
    return snap.docs.map(d => d.data() as FirestoreUser);
  } catch (error) {
    console.error('❌ Erreur getAllUsers:', error);
    return [];
  }
}

// 5. Actions Administratives (Suspension & Suppression)
export async function updateUserStatus(uid: string, status: 'active' | 'suspended') {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, { status, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur updateUserStatus:', error);
    throw error;
  }
}

export async function deleteUserFully(uid: string) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    // 1. Supprimer tous les documents de chat de l'utilisateur
    const chatsRef = collection(db, 'users', uid, 'chats');
    const chatsSnap = await getDocs(chatsRef);
    for (const chatDoc of chatsSnap.docs) {
      await deleteDoc(doc(db, 'users', uid, 'chats', chatDoc.id));
    }

    // 2. Supprimer tous les protocoles de l'utilisateur
    const protosRef = collection(db, 'users', uid, 'protocols');
    const protosSnap = await getDocs(protosRef);
    for (const protoDoc of protosSnap.docs) {
      await deleteDoc(doc(db, 'users', uid, 'protocols', protoDoc.id));
    }

    // 3. Supprimer le profil de l'utilisateur principal
    const userDocRef = doc(db, 'users', uid);
    await deleteDoc(userDocRef);
  } catch (error) {
    console.error('❌ Erreur deleteUserFully:', error);
    throw error;
  }
}

// 6. Demandes d'Accès
export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  tempPassword?: string;
  createdAt: any;
}

export async function submitAccessRequest(name: string, email: string) {
  if (!isFirebaseEnabled || !db) return;
  try {
    // Générer un mot de passe temporaire unique de type RECIF-XXXXXX
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let tempPassword = 'RECIF-';
    for (let i = 0; i < 6; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const docRef = doc(db, 'access_requests', docId);
    await setDoc(docRef, {
      name,
      email: email.toLowerCase(),
      tempPassword,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('❌ Erreur submitAccessRequest:', error);
    throw error;
  }
}

export async function getAccessRequests(): Promise<AccessRequest[]> {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return [];
  try {
    const requestsRef = collection(db, 'access_requests');
    const q = query(requestsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest));
  } catch (error) {
    console.error('❌ Erreur getAccessRequests:', error);
    return [];
  }
}

export async function findAccessRequestByEmail(email: string): Promise<AccessRequest | null> {
  if (!isFirebaseEnabled || !db) return null;
  try {
    const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const docRef = doc(db, 'access_requests', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as AccessRequest;
    }
  } catch (error) {
    console.error('❌ Erreur findAccessRequestByEmail:', error);
  }
  return null;
}

export async function deleteAccessRequest(requestId: string) {
  if (!isFirebaseEnabled || !db) return;
  try {
    const docRef = doc(db, 'access_requests', requestId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('❌ Erreur deleteAccessRequest:', error);
    throw error;
  }
}

export async function updateUserDisplayName(uid: string, displayName: string) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, { displayName, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur updateUserDisplayName:', error);
    throw error;
  }
}

export async function createStudentAccountDirectly(name: string, email: string, tempPassword: string) {
  if (!isFirebaseEnabled || !db) throw new Error('Firebase non configuré');
  
  // Initialiser une instance temporaire d'authentification pour éviter de déconnecter le compte administrateur actif
  const tempAppName = `temp_creator_${Date.now()}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = getAuth(tempApp);

  try {
    // 1. Créer l'utilisateur dans Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(tempAuth, email, tempPassword);
    const newUid = userCredential.user.uid;

    // 2. Créer le profil initial dans Firestore avec "requirePasswordChange: true" et "status: active"
    const userDocRef = doc(db, 'users', newUid);
    await setDoc(userDocRef, {
      uid: newUid,
      email: email.toLowerCase(),
      displayName: name,
      photoURL: null,
      level: 'Débutant',
      stats: {
        questionsAsked: 0,
        protocolsGenerated: 0,
        quizCorrect: 0,
        quizTotal: 0,
        flashcardsMastered: [],
        quizHistory: []
      },
      requirePasswordChange: true,
      status: 'active',
      updatedAt: serverTimestamp()
    });

    // 3. Se déconnecter de l'instance temporaire
    await signOut(tempAuth);
  } catch (error) {
    console.error('❌ Erreur createStudentAccountDirectly:', error);
    throw error;
  }
}

