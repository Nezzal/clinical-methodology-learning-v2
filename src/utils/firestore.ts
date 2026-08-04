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
import { UserSubscription, UserType, SubscriptionTier, QuotaUsage, TIER_LIMITS } from '@/types/subscription';

export function createInitialSubscription(): UserSubscription {
  const now = new Date();
  const validUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 jours d'essai gratuit
  const todayStr = now.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  return {
    tier: 'découverte',
    status: 'trialing',
    startDate: now.toISOString(),
    validUntil: validUntil.toISOString(),
    paymentVerified: false,
    quotas: {
      questionsToday: 0,
      lastQuestionDate: todayStr,
      protocolsThisMonth: 0,
      strobeThisMonth: 0,
      synthesesThisMonth: 0,
      reportsThisMonth: 0,
      lastResetMonth: monthStr,
    }
  };
}

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
  role?: 'superadmin' | 'admin' | 'teacher' | 'student';
  userType?: UserType;
  subscription?: UserSubscription;
  assignedTeacherUid?: string;
  assignedTeacherName?: string;
  country?: string;
  residence?: string;
  phone?: string;
  institution?: string;
  profession?: string;
  city?: string;
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
  formData?: any;
}

export interface FirestoreSynthesis {
  id: string;
  query: string;
  title: string;
  date: string;
  articlesCount: number;
  content: string;
  articles: any[];
  provider?: string;
  createdAt?: any;
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
  if (!isFirebaseEnabled || !db || !uid) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDocWithCacheFallback(userDocRef);
    if (snap && snap.exists()) {
      const data = snap.data() as FirestoreUser;
      if (!data.subscription) {
        data.subscription = createInitialSubscription();
      }
      return data;
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
  if (!isFirebaseEnabled || !db || !uid) return;
  try {
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    
    const chatHeader: any = {
      id: chatId,
      title,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };
    if (mode) {
      chatHeader.mode = mode;
    }
    
    await setDoc(chatDocRef, chatHeader, { merge: true });

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
  if (!isFirebaseEnabled || !db || !uid) return [];
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
  if (!isFirebaseEnabled || !db || !uid) return;
  try {
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    await deleteDoc(chatDocRef);
  } catch (error) {
    console.error('❌ Erreur deleteFirestoreChat:', error);
  }
}

// 3. Protocoles
export async function saveFirestoreProtocol(uid: string, protocol: { id: string; title: string; acronym: string; date: string; content: string; crfContent?: string | null; formData?: any }) {
  if (!isFirebaseEnabled || !db || !uid) return;
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
  if (!isFirebaseEnabled || !db || !uid) return [];
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
  if (!isFirebaseEnabled || !db || !uid) return;
  try {
    const protoDocRef = doc(db, 'users', uid, 'protocols', protocolId);
    await deleteDoc(protoDocRef);
  } catch (error) {
    console.error('❌ Erreur deleteFirestoreProtocol:', error);
  }
}

// Articles STROBE
export async function saveFirestoreArticle(uid: string, article: FirestoreArticle) {
  if (!isFirebaseEnabled || !db || !uid) return;
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
  if (!isFirebaseEnabled || !db || !uid) return [];
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
  if (!isFirebaseEnabled || !db || !uid) return;
  try {
    const articleDocRef = doc(db, 'users', uid, 'articles', articleId);
    await deleteDoc(articleDocRef);
  } catch (error) {
    console.error('❌ Erreur deleteFirestoreArticle:', error);
  }
}

// Synthèses Bibliographiques
export async function saveFirestoreSynthesis(uid: string, synthesis: FirestoreSynthesis) {
  if (!isFirebaseEnabled || !db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'syntheses', synthesis.id);
    await setDoc(docRef, {
      ...synthesis,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('❌ Erreur saveFirestoreSynthesis:', error);
  }
}

export async function loadFirestoreSyntheses(uid: string): Promise<FirestoreSynthesis[]> {
  if (!isFirebaseEnabled || !db || !uid) return [];
  try {
    const synthesesRef = collection(db, 'users', uid, 'syntheses');
    const q = query(synthesesRef, orderBy('createdAt', 'desc'));
    const snap = await getDocsWithCacheFallback(q);
    return snap.docs.map(d => d.data() as FirestoreSynthesis);
  } catch (error) {
    console.warn('⚠️ Erreur loadFirestoreSyntheses:', error);
    return [];
  }
}

export async function deleteFirestoreSynthesis(uid: string, synthesisId: string) {
  if (!isFirebaseEnabled || !db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'syntheses', synthesisId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('❌ Erreur deleteFirestoreSynthesis:', error);
  }
}

// 4. Mode Enseignant (Supervision de tous les étudiants)
export async function getAllUsers(): Promise<FirestoreUser[]> {
  if (!isFirebaseEnabled || !db) return [];
  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocsWithCacheFallback(usersRef);
    return snap.docs
      .map(d => {
        const data = d.data() as FirestoreUser;
        return {
          ...data,
          uid: data.uid || d.id
        };
      })
      .filter(u => u.uid && (u.email || (u.displayName && u.displayName !== 'Utilisateur') || u.role === 'admin' || u.role === 'teacher'));
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
  if (!uid || typeof uid !== 'string' || !isFirebaseEnabled || !db || !auth || !auth.currentUser) return;
  try {
    const chatsRef = collection(db, 'users', uid, 'chats');
    const chatsSnap = await getDocsWithCacheFallback(chatsRef);
    for (const chatDoc of chatsSnap.docs) {
      await deleteDoc(doc(db, 'users', uid, 'chats', chatDoc.id));
    }

    const protosRef = collection(db, 'users', uid, 'protocols');
    const protosSnap = await getDocsWithCacheFallback(protosRef);
    for (const protoDoc of protosSnap.docs) {
      await deleteDoc(doc(db, 'users', uid, 'protocols', protoDoc.id));
    }

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
  firstName: string;
  lastName: string;
  institution: string;
  profession: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  requestedRole?: 'student' | 'teacher';
  requestedTier?: 'découverte' | 'pro' | 'expert' | 'ultra' | 'institution';
  status: 'pending' | 'payment_received' | 'accepted' | 'rejected' | 'quote_sent';
  createdAt: any;
  expiresAt?: any;
  paymentReceiptRef?: string;
  paymentReceiptImage?: string;
  paymentReceivedAt: any;
  paymentReceivedBy: string | null;
  rejectedAt: any;
  rejectedBy: string | null;
  rejectionReason: string;
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
  
  const tempAppName = `temp_creator_${Date.now()}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = getAuth(tempApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(tempAuth, email, tempPassword);
    const newUid = userCredential.user.uid;

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
  senderRole: 'student' | 'teacher' | 'admin';
  recipientRole: 'teacher' | 'admin' | 'student';
  recipientUid?: string;
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
  senderRole: 'student' | 'teacher' | 'admin',
  recipientRole: 'teacher' | 'admin' | 'student',
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
    const newDocRef = doc(messagesRef);
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
      studentRead: finalRecipientRole !== 'student', // Non lu pour l'étudiant s'il est destinataire
      teacherRead: finalRecipientRole !== 'teacher', // Non lu pour l'enseignant s'il est destinataire
      adminRead: finalRecipientRole !== 'admin'      // Non lu pour l'administrateur s'il est destinataire
    };
    await setDoc(newDocRef, messageData);

    // Déclenchement de la notification e-mail asynchrone
    try {
      let recipientEmail = '';
      if (finalRecipientRole === 'teacher' && finalRecipientUid) {
        const teacherProfile = await loadUserProfile(finalRecipientUid);
        if (teacherProfile?.email) {
          recipientEmail = teacherProfile.email;
        }
      } else if (finalRecipientRole === 'student' && finalRecipientUid) {
        const studentProfile = await loadUserProfile(finalRecipientUid);
        if (studentProfile?.email) {
          recipientEmail = studentProfile.email;
        }
      } else if (finalRecipientRole === 'admin') {
        recipientEmail = process.env.NEXT_PUBLIC_ADMIN_NOTIFICATION_EMAIL || '';
      }

      if (recipientEmail) {
        const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const isToStudent = finalRecipientRole === 'student';
        const emailSubject = isToStudent 
          ? `[RECIF] Nouveau message de l'administration : ${subject}`
          : `[RECIF] Nouvelle question de ${senderName} : ${subject}`;

        const emailHtml = isToStudent 
          ? `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fafbfc; color: #334155;">
              <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #e6fffa; border-radius: 12px; font-size: 24px; margin-bottom: 8px;">
                  ✉️
                </div>
                <h2 style="color: #1e293b; margin: 0; font-size: 1.25rem; font-weight: 600;">Plateforme Methodo&Clinique</h2>
                <p style="color: #64748b; margin: 4px 0 0; font-size: 0.85rem;">Vous avez reçu un nouveau message de supervision</p>
              </div>
              
              <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">Bonjour,</p>
              <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">L'administration (ou votre enseignant référent) vous a adressé un message sur la plateforme :</p>
              
              <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0; border-left-width: 4px;">
                <strong style="color: #1e293b; display: block; margin-bottom: 8px; font-size: 0.95rem;">Objet : ${subject}</strong>
                <p style="margin: 0; color: #475569; font-style: italic; font-size: 0.92rem; line-height: 1.6; white-space: pre-wrap;">"${content}"</p>
              </div>
              
              <p style="font-size: 0.95rem; line-height: 1.5; color: #334155; margin-bottom: 24px;">Vous pouvez consulter ce message et y répondre directement depuis votre espace d'aide.</p>
              
              <div style="text-align: center; margin: 28px 0;">
                <a href="${appUrl || 'https://clinical-methodology-learning.vercel.app'}/contact" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                  Consulter mes Messages / Support
                </a>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
              <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center;">Cet e-mail a été envoyé automatiquement par la Plateforme Methodo&Clinique.</p>
            </div>
          `
          : `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fafbfc; color: #334155;">
              <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #edf2f7; border-radius: 12px; font-size: 24px; margin-bottom: 8px;">
                  💬
                </div>
                <h2 style="color: #1e293b; margin: 0; font-size: 1.25rem; font-weight: 600;">Plateforme Methodo&Clinique</h2>
                <p style="color: #64748b; margin: 4px 0 0; font-size: 0.85rem;">Nouveau message de support reçu</p>
              </div>
              
              <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">Bonjour,</p>
              <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">L'étudiant <strong>${senderName}</strong> (${senderEmail}) a posé une question méthodologique ou technique sur la plateforme :</p>
              
              <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0; border-left-width: 4px;">
                <strong style="color: #1e293b; display: block; margin-bottom: 8px; font-size: 0.95rem;">Objet : ${subject}</strong>
                <p style="margin: 0; color: #475569; font-style: italic; font-size: 0.92rem; line-height: 1.6; white-space: pre-wrap;">"${content}"</p>
              </div>
              
              <p style="font-size: 0.95rem; line-height: 1.5; color: #334155; margin-bottom: 24px;">Vous pouvez consulter ce message et y répondre directement depuis votre espace de supervision.</p>
              
              <div style="text-align: center; margin: 28px 0;">
                <a href="${appUrl || 'https://clinical-methodology-learning.vercel.app'}/admin" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);">
                  Accéder au Tableau de Bord Enseignant
                </a>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
              <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center;">Cet e-mail a été envoyé automatiquement par la Plateforme Methodo&Clinique.</p>
            </div>
          `;

        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipientEmail,
            subject: emailSubject,
            html: emailHtml
          })
        }).catch(err => console.error("⚠️ Échec d'envoi de la notification e-mail :", err));
      }
    } catch (mailErr) {
      console.warn("⚠️ Impossible d'initier l'envoi d'e-mail :", mailErr);
    }

    return newDocRef.id;
  } catch (error) {
    console.error('❌ Erreur sendSupportMessage:', error);
    throw error;
  }
}

export async function replyToSupportMessage(
  messageId: string,
  replyContent: string,
  replierRole: 'teacher' | 'admin' | 'student'
) {
  if (!isFirebaseEnabled || !db) return;
  try {
    const docRef = doc(db, 'support_messages', messageId);
    await setDoc(docRef, {
      status: 'replied',
      studentRead: replierRole === 'student',
      teacherRead: replierRole === 'teacher',
      adminRead: replierRole === 'admin',
      reply: replyContent,
      repliedAt: serverTimestamp()
    }, { merge: true });

    // Déclenchement de la notification e-mail asynchrone
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const msgData = snap.data();
        const studentEmail = msgData.senderEmail;
        const studentName = msgData.senderName;
        const subject = msgData.subject;

        if (replierRole === 'student') {
          // Notify the supervisor (sender of the original message)
          let supervisorEmail = '';
          const senderUid = msgData.senderUid;
          const recipientRole = msgData.recipientRole;

          if (recipientRole === 'teacher' || recipientRole === 'admin') {
            const supervisorProfile = await loadUserProfile(senderUid);
            if (supervisorProfile?.email) {
              supervisorEmail = supervisorProfile.email;
            }
          } else {
            supervisorEmail = process.env.NEXT_PUBLIC_ADMIN_NOTIFICATION_EMAIL || '';
          }

          if (supervisorEmail) {
            const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
            fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: supervisorEmail,
                subject: `[RECIF] Nouvelle réponse de l'étudiant ${studentName} : ${subject}`,
                html: `
                  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fafbfc; color: #334155;">
                    <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
                      <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #edf2f7; border-radius: 12px; font-size: 24px; margin-bottom: 8px;">
                        💬
                      </div>
                      <h2 style="color: #1e293b; margin: 0; font-size: 1.25rem; font-weight: 600;">Plateforme Methodo&Clinique</h2>
                      <p style="color: #64748b; margin: 4px 0 0; font-size: 0.85rem;">Réponse d'étudiant reçue</p>
                    </div>
                    
                    <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">Bonjour,</p>
                    <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">L'étudiant <strong>${studentName}</strong> a répondu à votre message concernant le sujet suivant :</p>
                    
                    <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0; border-left-width: 4px;">
                      <strong style="color: #1e293b; display: block; margin-bottom: 8px; font-size: 0.95rem;">Sujet : ${subject}</strong>
                      <p style="margin: 0; color: #475569; font-style: italic; font-size: 0.92rem; line-height: 1.6; white-space: pre-wrap;">"${replyContent}"</p>
                    </div>
                    
                    <p style="font-size: 0.95rem; line-height: 1.5; color: #334155; margin-bottom: 24px;">Vous pouvez consulter la discussion complète sur votre espace de supervision.</p>
                    
                    <div style="text-align: center; margin: 28px 0;">
                      <a href="${appUrl || 'https://clinical-methodology-learning.vercel.app'}/admin" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);">
                        Accéder au Tableau de Bord Enseignant
                      </a>
                    </div>
                    
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
                    <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center;">Cet e-mail a été envoyé automatiquement par la Plateforme Methodo&Clinique.</p>
                  </div>
                `
              })
            }).catch(err => console.error("⚠️ Échec d'envoi de la notification e-mail à l'enseignant :", err));
          }
        } else {
          // Notify student
          if (studentEmail) {
            const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
            const replierTitle = replierRole === 'admin' ? "L'administration" : "Votre enseignant référent";

            fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: studentEmail,
                subject: `[RECIF] Réponse à votre question : ${subject}`,
                html: `
                  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fafbfc; color: #334155;">
                    <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
                      <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #e6fffa; border-radius: 12px; font-size: 24px; margin-bottom: 8px;">
                        ✉️
                      </div>
                      <h2 style="color: #1e293b; margin: 0; font-size: 1.25rem; font-weight: 600;">Plateforme Methodo&Clinique</h2>
                      <p style="color: #64748b; margin: 4px 0 0; font-size: 0.85rem;">Une réponse a été apportée à votre question</p>
                    </div>
                    
                    <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">Bonjour <strong>${studentName}</strong>,</p>
                    <p style="font-size: 0.95rem; line-height: 1.5; color: #334155;">${replierTitle} a répondu à votre message de support :</p>
                    
                    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 6px; border: 1px solid #e6f4ea; border-left-width: 4px;">
                      <strong style="color: #137333; display: block; margin-bottom: 8px; font-size: 0.95rem;">Réponse :</strong>
                      <p style="margin: 0; color: #3c4043; font-style: italic; font-size: 0.92rem; line-height: 1.6; white-space: pre-wrap;">"${replyContent}"</p>
                    </div>
                    
                    <p style="font-size: 0.95rem; line-height: 1.5; color: #334155; margin-bottom: 24px;">Vous pouvez consulter la discussion complète dans votre espace d'aide.</p>
                    
                    <div style="text-align: center; margin: 28px 0;">
                      <a href="${appUrl || 'https://clinical-methodology-learning.vercel.app'}/contact" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                        Consulter l'Historique Support
                      </a>
                    </div>
                    
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
                    <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center;">Cet e-mail a été envoyé automatiquement par la Plateforme Methodo&Clinique.</p>
                  </div>
                `
              })
            }).catch(err => console.error("⚠️ Échec d'envoi de la notification e-mail à l'étudiant :", err));
          }
        }
      }
    } catch (err) {
      console.warn("⚠️ Impossible d'envoyer la notification e-mail :", err);
    }
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

    messages.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    if (filters.senderUid) {
      messages = messages.filter(m => m.senderUid === filters.senderUid);
    }
    if (filters.recipientRole) {
      messages = messages.filter(m => {
        if (
          (filters.includeSentBy && (m.senderUid === filters.includeSentBy || m.senderRole === 'admin')) ||
          m.senderRole === 'admin'
        ) {
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

export async function deleteSupportMessage(messageId: string) {
  if (!isFirebaseEnabled || !db) return;
  try {
    const docRef = doc(db, 'support_messages', messageId);
    await deleteDoc(docRef);
    console.log(`✅ Message support ${messageId} supprimé avec succès.`);
  } catch (error) {
    console.error('❌ Erreur deleteSupportMessage:', error);
    throw error;
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

export async function activateUserSubscriptionInFirestore(
  targetUid: string,
  tier: SubscriptionTier,
  durationMonths: number
) {
  if (!isFirebaseEnabled || !db) return;
  try {
    const userDocRef = doc(db, 'users', targetUid);
    const now = new Date();
    
    // Calculer jours bonus (7j pour pro, 14j pour ultra)
    let bonusDays = 0;
    if (tier === 'pro') bonusDays = 7;
    if (tier === 'ultra') bonusDays = 14;

    const expiry = new Date(now.getTime());
    expiry.setMonth(expiry.getMonth() + durationMonths);
    expiry.setDate(expiry.getDate() + bonusDays);

    const todayStr = now.toISOString().split('T')[0];
    const monthStr = todayStr.substring(0, 7);

    const newSubscription: UserSubscription = {
      tier,
      status: 'active',
      startDate: now.toISOString(),
      validUntil: expiry.toISOString(),
      durationMonths,
      bonusDaysAdded: bonusDays,
      paymentVerified: true,
      quotas: {
        questionsToday: 0,
        lastQuestionDate: todayStr,
        protocolsThisMonth: 0,
        strobeThisMonth: 0,
        synthesesThisMonth: 0,
        reportsThisMonth: 0,
        lastResetMonth: monthStr,
      }
    };

    await setDoc(userDocRef, { subscription: newSubscription }, { merge: true });
    return newSubscription;
  } catch (error) {
    console.error('❌ Erreur activateUserSubscriptionInFirestore:', error);
    throw error;
  }
}