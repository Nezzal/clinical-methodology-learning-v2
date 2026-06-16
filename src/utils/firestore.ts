import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where,
  onSnapshot,
  deleteDoc, 
  serverTimestamp,
  getDocsFromCache,
  getDocFromCache,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, isFirebaseEnabled, auth, firebaseConfig } from './firebase';
import { LocalStats } from './storage';

const isOfflineAdmin = (): boolean => {
  return typeof window !== 'undefined' && window.localStorage.getItem('offline_admin_active') === 'true';
};

// Fonction utilitaire pour récupérer des documents Firestore avec repli immédiat sur le cache s'il est offline
async function getDocsWithCacheFallback(q: any): Promise<QuerySnapshot<any, any>> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    try {
      return await getDocsFromCache(q);
    } catch (e) {
      console.warn("⚠️ Échec de la récupération des documents depuis le cache Firestore:", e);
      throw e;
    }
  }
  try {
    const serverPromise = getDocs(q);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );
    return await Promise.race([serverPromise, timeoutPromise]);
  } catch (error) {
    console.warn("⚠️ Échec ou timeout de la connexion serveur Firestore, bascule vers le cache local...", error);
    try {
      return await getDocsFromCache(q);
    } catch (cacheError) {
      console.warn("⚠️ Impossible de lire les documents Firestore (Serveur & Cache):", cacheError);
      throw cacheError;
    }
  }
}

// Fonction utilitaire pour récupérer un document unique Firestore avec repli immédiat sur le cache s'il est offline
async function getDocWithCacheFallback(docRef: any): Promise<DocumentSnapshot<any, any>> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    try {
      return await getDocFromCache(docRef);
    } catch (e) {
      console.warn("⚠️ Échec de la récupération du document depuis le cache Firestore:", e);
      throw e;
    }
  }
  try {
    const serverPromise = getDoc(docRef);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );
    return await Promise.race([serverPromise, timeoutPromise]);
  } catch (error) {
    console.warn("⚠️ Échec ou timeout de la connexion serveur Firestore pour le document, bascule vers le cache local...", error);
    try {
      return await getDocFromCache(docRef);
    } catch (cacheError) {
      console.warn("⚠️ Impossible de lire le document Firestore (Serveur & Cache):", cacheError);
      throw cacheError;
    }
  }
}

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
  lastActive?: any;
  role?: 'admin' | 'teacher' | 'student';
  assignedTeacherUid?: string;
  assignedTeacherName?: string;
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
  createdAt?: any;
  crfContent?: string | null;
  formData?: any;
}

export interface FirestoreArticle {
  id: string;
  title: string;
  studyType: 'cohort' | 'case-control' | 'cross-sectional';
  date: string;
  content: string;
  createdAt?: any;
  formData?: any; // Contient les réponses aux 22 critères STROBE
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
  if (!isFirebaseEnabled || !db || !auth || (!auth.currentUser && !isOfflineAdmin())) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDocWithCacheFallback(userDocRef);
    if (snap && snap.exists()) {
      return snap.data() as FirestoreUser;
    }
  } catch (error) {
    console.warn('⚠️ Erreur loadUserProfile (mode hors-ligne ou problème cache/réseau):', error);
  }
  return null;
}

// 2. Historique des chats
export async function saveFirestoreChat(
  uid: string, 
  chatId: string, 
  title: string, 
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>,
  mode?: 'free' | 'protocol' | 'strobe'
) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    
    const chatHeader: any = {
      id: chatId,
      title,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp() // merge: true protégera la date de création
    };
    if (mode) {
      chatHeader.mode = mode;
    }
    
    // Enregistrer l'en-tête du chat
    await setDoc(chatDocRef, chatHeader, { merge: true });

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
  if (!isFirebaseEnabled || !db || !auth || (!auth.currentUser && !isOfflineAdmin())) return [];
  try {
    const chatsRef = collection(db, 'users', uid, 'chats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));
    const snap = await getDocsWithCacheFallback(q);
    return snap.docs.map(d => d.data());
  } catch (error) {
    console.warn('⚠️ Erreur loadFirestoreChats:', error);
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
export async function saveFirestoreProtocol(uid: string, protocol: { id: string; title: string; acronym: string; date: string; content: string; crfContent?: string | null; formData?: any }) {
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
  if (!isFirebaseEnabled || !db || !auth || (!auth.currentUser && !isOfflineAdmin())) return [];
  try {
    const protosRef = collection(db, 'users', uid, 'protocols');
    const q = query(protosRef, orderBy('createdAt', 'desc'));
    const snap = await getDocsWithCacheFallback(q);
    return snap.docs.map(d => d.data() as FirestoreProtocol);
  } catch (error) {
    console.warn('⚠️ Erreur loadFirestoreProtocols:', error);
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

// Articles STROBE
export async function saveFirestoreArticle(uid: string, article: FirestoreArticle) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const articleDocRef = doc(db, 'users', uid, 'articles', article.id);
    await setDoc(articleDocRef, {
      ...article,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur saveFirestoreArticle:', error);
  }
}

export async function loadFirestoreArticles(uid: string): Promise<FirestoreArticle[]> {
  if (!isFirebaseEnabled || !db || !auth || (!auth.currentUser && !isOfflineAdmin())) return [];
  try {
    const articlesRef = collection(db, 'users', uid, 'articles');
    const q = query(articlesRef, orderBy('createdAt', 'desc'));
    const snap = await getDocsWithCacheFallback(q);
    return snap.docs.map(d => d.data() as FirestoreArticle);
  } catch (error) {
    console.warn('⚠️ Erreur loadFirestoreArticles:', error);
    return [];
  }
}

export async function deleteFirestoreArticle(uid: string, articleId: string) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const articleDocRef = doc(db, 'users', uid, 'articles', articleId);
    await deleteDoc(articleDocRef);
  } catch (error) {
    console.error('❌ Erreur deleteFirestoreArticle:', error);
  }
}

// 4. Mode Enseignant (Supervision de tous les étudiants)
export async function getAllUsers(): Promise<FirestoreUser[]> {
  if (!isFirebaseEnabled || !db || !auth || (!auth.currentUser && !isOfflineAdmin())) return [];
  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocsWithCacheFallback(usersRef);
    return snap.docs.map(d => d.data() as FirestoreUser);
  } catch (error) {
    console.warn('⚠️ Erreur getAllUsers:', error);
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
    const chatsSnap = await getDocsWithCacheFallback(chatsRef);
    for (const chatDoc of chatsSnap.docs) {
      await deleteDoc(doc(db, 'users', uid, 'chats', chatDoc.id));
    }

    // 2. Supprimer tous les protocoles de l'utilisateur
    const protosRef = collection(db, 'users', uid, 'protocols');
    const protosSnap = await getDocsWithCacheFallback(protosRef);
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
  if (!isFirebaseEnabled || !db || !auth || (!auth.currentUser && !isOfflineAdmin())) return [];
  try {
    const requestsRef = collection(db, 'access_requests');
    const q = query(requestsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocsWithCacheFallback(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest));
  } catch (error) {
    console.warn('⚠️ Erreur getAccessRequests:', error);
    return [];
  }
}

export async function findAccessRequestByEmail(email: string): Promise<AccessRequest | null> {
  if (!isFirebaseEnabled || !db) return null;
  try {
    const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const docRef = doc(db, 'access_requests', docId);
    const snap = await getDocWithCacheFallback(docRef);
    if (snap && snap.exists()) {
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

export async function updateUserLastActive(uid: string) {
  if (!isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, { lastActive: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur updateUserLastActive:', error);
  }
}

// 7. Messagerie de Support (Étudiant ↔ Enseignant ↔ Admin)
export interface FirestoreSupportMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderEmail: string;
  senderRole: 'student' | 'teacher';
  recipientRole: 'teacher' | 'admin';
  recipientUid?: string; // Utilisé si un enseignant spécifique est ciblé par l'admin
  subject: string;
  content: string;
  createdAt: any;
  status: 'unread' | 'read' | 'replied';
  studentRead: boolean;
  teacherRead: boolean;
  adminRead: boolean;
  reply?: string;
  repliedAt?: any;
}

export async function assignStudentToTeacher(
  studentUid: string,
  teacherUid: string | null,
  teacherName: string | null
) {
  if (!isFirebaseEnabled || !db) return;
  try {
    const userDocRef = doc(db, 'users', studentUid);
    await setDoc(userDocRef, {
      assignedTeacherUid: teacherUid || null,
      assignedTeacherName: teacherName || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur assignStudentToTeacher:', error);
    throw error;
  }
}

export async function sendSupportMessage(
  senderUid: string,
  senderName: string,
  senderEmail: string,
  senderRole: 'student' | 'teacher',
  recipientRole: 'teacher' | 'admin',
  recipientUid: string | undefined,
  subject: string,
  content: string
) {
  if (!isFirebaseEnabled || !db) return;
  try {
    let finalRecipientRole = recipientRole;
    let finalRecipientUid = recipientUid || '';

    if (senderRole === 'student') {
      const studentProfile = await loadUserProfile(senderUid);
      if (studentProfile?.assignedTeacherUid) {
        finalRecipientRole = 'teacher';
        finalRecipientUid = studentProfile.assignedTeacherUid;
      } else {
        finalRecipientRole = 'admin';
        finalRecipientUid = '';
      }
    }

    const messagesRef = collection(db, 'support_messages');
    const newDocRef = doc(messagesRef); // Génère un ID unique automatiquement
    const messageData: FirestoreSupportMessage = {
      id: newDocRef.id,
      senderUid,
      senderName,
      senderEmail,
      senderRole,
      recipientRole: finalRecipientRole,
      recipientUid: finalRecipientUid,
      subject,
      content,
      createdAt: serverTimestamp(),
      status: 'unread',
      studentRead: true, // L'expéditeur a déjà lu son propre message
      teacherRead: false,
      adminRead: false
    };
    await setDoc(newDocRef, messageData);
    return newDocRef.id;
  } catch (error) {
    console.error('❌ Erreur sendSupportMessage:', error);
    throw error;
  }
}

export async function replyToSupportMessage(
  messageId: string,
  replyContent: string,
  replierRole: 'teacher' | 'admin'
) {
  if (!isFirebaseEnabled || !db) return;
  try {
    const docRef = doc(db, 'support_messages', messageId);
    await setDoc(docRef, {
      status: 'replied',
      studentRead: false, // Nouveau message non lu pour l'étudiant
      teacherRead: replierRole === 'teacher',
      adminRead: replierRole === 'admin',
      reply: replyContent,
      repliedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur replyToSupportMessage:', error);
    throw error;
  }
}

export async function markMessageReadState(
  messageId: string,
  roleToMark: 'student' | 'teacher' | 'admin'
) {
  if (!isFirebaseEnabled || !db) return;
  try {
    const docRef = doc(db, 'support_messages', messageId);
    const updatePayload: any = {};
    if (roleToMark === 'student') {
      updatePayload.studentRead = true;
    } else if (roleToMark === 'teacher') {
      updatePayload.teacherRead = true;
      updatePayload.status = 'read';
    } else if (roleToMark === 'admin') {
      updatePayload.adminRead = true;
      updatePayload.status = 'read';
    }
    await setDoc(docRef, updatePayload, { merge: true });
  } catch (error) {
    console.error('❌ Erreur markMessageReadState:', error);
    throw error;
  }
}

export async function loadSupportMessages(filters: {
  senderUid?: string;
  recipientRole?: 'teacher' | 'admin';
  recipientUid?: string;
  includeSentBy?: string;
}): Promise<FirestoreSupportMessage[]> {
  if (!isFirebaseEnabled || !db || !auth || (!auth.currentUser && !isOfflineAdmin())) return [];
  try {
    const messagesRef = collection(db, 'support_messages');
    let docsData: any[] = [];
    const currentUser = auth.currentUser;

    if (isOfflineAdmin()) {
      const q = query(messagesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocsWithCacheFallback(q);
      docsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (currentUser) {
      const tokenResult = await currentUser.getIdTokenResult();
      const role = tokenResult.claims.role;

      if (role === 'admin') {
        const q = query(messagesRef, orderBy('createdAt', 'desc'));
        const snap = await getDocsWithCacheFallback(q);
        docsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else if (role === 'teacher') {
        // Enseignant : uniquement les messages où il est destinataire ou expéditeur
        const q1 = query(messagesRef, where('recipientUid', '==', currentUser.uid));
        const q2 = query(messagesRef, where('senderUid', '==', currentUser.uid));
        
        const [snap1, snap2] = await Promise.all([
          getDocsWithCacheFallback(q1),
          getDocsWithCacheFallback(q2)
        ]);
        
        const docsMap = new Map<string, any>();
        snap1.docs.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));
        snap2.docs.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));
        docsData = Array.from(docsMap.values());
      } else {
        // Étudiant : uniquement ses propres messages envoyés ou reçus
        const q1 = query(messagesRef, where('senderUid', '==', currentUser.uid));
        const q2 = query(messagesRef, where('recipientUid', '==', currentUser.uid));
        
        const [snap1, snap2] = await Promise.all([
          getDocsWithCacheFallback(q1),
          getDocsWithCacheFallback(q2)
        ]);
        
        const docsMap = new Map<string, any>();
        snap1.docs.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));
        snap2.docs.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));
        docsData = Array.from(docsMap.values());
      }
    }

    let messages = docsData.map(data => {
      return {
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString(),
        repliedAt: data.repliedAt ? (data.repliedAt.toDate ? data.repliedAt.toDate().toISOString() : data.repliedAt) : null
      } as FirestoreSupportMessage;
    });

    // Trier par date décroissante
    messages.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    // Filtrage robuste supplémentaire côté client
    if (filters.senderUid) {
      messages = messages.filter(m => m.senderUid === filters.senderUid);
    }
    if (filters.recipientRole) {
      messages = messages.filter(m => {
        if (filters.includeSentBy && m.senderUid === filters.includeSentBy) {
          return true;
        }

        if (filters.recipientRole === 'teacher') {
          return m.recipientRole === 'teacher' && m.recipientUid === filters.recipientUid;
        }
        return m.recipientRole === filters.recipientRole;
      });
    }

    return messages;
  } catch (error) {
    console.warn('⚠️ Erreur loadSupportMessages:', error);
    return [];
  }
}

export function listenToUnreadMessages(
  uid: string,
  role: 'student' | 'teacher' | 'admin',
  onUpdate: (count: number) => void
): () => void {
  if (!isFirebaseEnabled || !db) {
    onUpdate(0);
    return () => {};
  }
  try {
    const messagesRef = collection(db, 'support_messages');
    let q;
    
    if (role === 'student') {
      q = query(
        messagesRef,
        where('senderUid', '==', uid),
        where('studentRead', '==', false),
        where('status', '==', 'replied')
      );
    } else if (role === 'teacher') {
      q = query(
        messagesRef,
        where('recipientRole', '==', 'teacher'),
        where('recipientUid', '==', uid),
        where('teacherRead', '==', false)
      );
    } else {
      q = query(
        messagesRef,
        where('recipientRole', '==', 'admin'),
        where('adminRead', '==', false)
      );
    }
    
    return onSnapshot(q, (snapshot) => {
      let count = snapshot.size;
      
      if (role === 'teacher') {
        const docs = snapshot.docs.map(d => d.data());
        const filtered = docs.filter(m => m.recipientUid === uid);
        count = filtered.length;
      }
      
      onUpdate(count);
    }, (error) => {
      console.warn("⚠️ listenToUnreadMessages error:", error);
      onUpdate(0);
    });
  } catch (err) {
    console.warn("⚠️ Impossible d'écouter les messages de support en temps réel:", err);
    onUpdate(0);
    return () => {};
  }
}



