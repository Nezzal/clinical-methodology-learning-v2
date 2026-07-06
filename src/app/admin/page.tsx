'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  getAllUsers, 
  loadFirestoreProtocols, 
  loadFirestoreChats, 
  loadFirestoreArticles,
  updateUserDisplayName,
  assignStudentToTeacher,
  getAccessRequests,
  deleteAccessRequest,
  AccessRequest,
  FirestoreUser, 
  FirestoreProtocol,
  sendSupportMessage,
  replyToSupportMessage,
  markMessageReadState,
  loadSupportMessages,
  FirestoreSupportMessage
} from '@/utils/firestore';
import styles from './page.module.css';

// Simple markdown formatter helper for protocol preview
function renderMarkdown(text: string): string {
  if (!text) return '';
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Headers
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3 style="margin-top: 1.25rem; margin-bottom: 0.5rem; color: var(--accent-secondary); font-size:1.1rem;">$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2 style="margin-top: 1.75rem; margin-bottom: 0.75rem; color: var(--accent-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.25rem; font-size:1.25rem;">$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--text-primary); font-size:1.5rem; text-align:center;">$1</h1>');

  // Horizontal rules
  formatted = formatted.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid var(--border-glass); margin: 1.5rem 0;" />');

  // List items
  formatted = formatted.replace(/^\s*[-*]\s+(.*?)$/gm, '<li style="margin-left: 1.25rem; list-style-type: disc; margin-bottom: 0.35rem;">$1</li>');

  // Double newlines to paragraphs
  formatted = formatted.split('\n').join('<br />');

  // Cleanup redundant br tags
  formatted = formatted.replace(/(<\/h1>|<\/h2>|<\/h3>|<\/li>|<hr \/>)<br \/>/g, '$1');

  return formatted;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin: authIsAdmin, role } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const getCleanLoginUrl = () => {
    if (typeof window === 'undefined') return 'https://clinical-methodology-learning.vercel.app/login';
    const origin = window.location.origin;
    if (origin.includes('clinical-methodology-learning') && origin.includes('vercel.app')) {
      return 'https://clinical-methodology-learning.vercel.app/login';
    }
    return `${origin}/login`;
  };
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [students, setStudents] = useState<FirestoreUser[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online'>('all');

  const isUserOnline = (lastActive: any): boolean => {
    if (!lastActive) return false;
    
    let date: Date;
    if (lastActive.seconds) {
      date = new Date(lastActive.seconds * 1000);
    } else if (lastActive instanceof Date) {
      date = lastActive;
    } else if (typeof lastActive === 'string') {
      date = new Date(lastActive);
    } else if (typeof lastActive === 'number') {
      date = new Date(lastActive);
    } else {
      return false;
    }
    
    const diffMs = Date.now() - date.getTime();
    return diffMs < 3 * 60 * 1000; // 3 minutes
  };

  const formatLastActive = (lastActive: any): string => {
    if (!lastActive) return 'Aucune activité récente';
    
    let date: Date;
    if (lastActive.seconds) {
      date = new Date(lastActive.seconds * 1000);
    } else if (lastActive instanceof Date) {
      date = lastActive;
    } else if (typeof lastActive === 'string') {
      date = new Date(lastActive);
    } else if (typeof lastActive === 'number') {
      date = new Date(lastActive);
    } else {
      return 'Activité inconnue';
    }
    
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Actif à l\'instant';
    if (diffMins < 60) return `Actif il y a ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Actif il y a ${diffHours} h`;
    
    return `Actif le ${date.toLocaleDateString('fr-FR')}`;
  };

  // Selected Student Detailed Supervision
  const [selectedStudent, setSelectedStudent] = useState<FirestoreUser | null>(null);
  const [studentProtocols, setStudentProtocols] = useState<FirestoreProtocol[]>([]);
  const [studentChats, setStudentChats] = useState<any[]>([]);
  const [studentArticles, setStudentArticles] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'protocols' | 'chats' | 'ai-report' | 'articles'>('stats');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAiReport, setLoadingAiReport] = useState(false);

  // Preview modals
  const [activeProtocol, setActiveProtocol] = useState<FirestoreProtocol | null>(null);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [activeArticle, setActiveArticle] = useState<any | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [modalPreviewMode, setModalPreviewMode] = useState<'protocol' | 'crf'>('protocol');

  // States pour les demandes d'accès et renommage
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [leftTab, setLeftTab] = useState<'students' | 'requests' | 'messages'>('students');

  // States pour la messagerie
  const [teachers, setTeachers] = useState<FirestoreUser[]>([]);
  const [supportMessages, setSupportMessages] = useState<FirestoreSupportMessage[]>([]);
  const [activeSupportMessage, setActiveSupportMessage] = useState<FirestoreSupportMessage | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [targetTeacherUid, setTargetTeacherUid] = useState('');
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [newMsgContent, setNewMsgContent] = useState('');
  const [isSendingNewMsg, setIsSendingNewMsg] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagingError, setMessagingError] = useState('');
  const [messagingSuccess, setMessagingSuccess] = useState('');
  const [adminMessageFilter, setAdminMessageFilter] = useState<'admin' | 'all'>('admin');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  // Modal de succès création compte et copie invitation
  const [successModalData, setSuccessModalData] = useState<{
    name: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [invitationCopied, setInvitationCopied] = useState(false);

  // States pour le rejet avec motif
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);

  const handleToggleSuspension = async (uid: string, newStatus: 'active' | 'suspended') => {
    const confirmMsg = newStatus === 'suspended'
      ? "Êtes-vous sûr de vouloir suspendre temporairement l'activité de cet étudiant ? Il ne pourra plus accéder à l'application."
      : "Êtes-vous sûr de vouloir réactiver l'activité de cet étudiant ?";
    if (!window.confirm(confirmMsg)) return;

    setActionPending(true);
    try {
      if (!user) throw new Error("Utilisateur non connecté");
      const idToken = await user.getIdToken(true);
      
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur lors de la mise à jour du statut.");
      }
      
      setSelectedStudent(prev => prev ? { ...prev, status: newStatus } : null);
      setStudents(prev => prev.map(s => s.uid === uid ? { ...s, status: newStatus } : s));
    } catch (e) {
      alert("Erreur lors de la mise à jour du statut : " + (e as Error).message);
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteStudentData = async (uid: string) => {
    const confirm1 = window.confirm("ATTENTION : Cette action supprimera définitivement le profil, les statistiques de quiz, l'historique de chat et les protocoles de cet étudiant dans la base de données ainsi que son compte d'authentification. Cette opération est IRRÉVERSIBLE. Voulez-vous continuer ?");
    if (!confirm1) return;

    const confirm2 = window.confirm("Confirmation finale de sécurité : Êtes-vous absolument sûr de vouloir détruire TOUTES les données et le compte de cet étudiant ?");
    if (!confirm2) return;

    setActionPending(true);
    try {
      if (!user) throw new Error("Utilisateur non connecté");
      const idToken = await user.getIdToken(true);

      const res = await fetch(`/api/admin/users/${uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur serveur lors de la suppression.");
      }
      
      setSelectedStudent(null);
      setStudents(prev => prev.filter(s => s.uid !== uid));
      
      alert("Le compte de l'étudiant et toutes ses données associées (profil, discussions et protocoles) ont été supprimés définitivement.");
    } catch (e) {
      alert("Erreur lors de la suppression des données : " + (e as Error).message);
    } finally {
      setActionPending(false);
    }
  };

  const handleSaveName = async () => {
    if (!selectedStudent || !newName.trim()) return;
    setActionPending(true);
    try {
      await updateUserDisplayName(selectedStudent.uid, newName.trim());
      setSelectedStudent(prev => prev ? { ...prev, displayName: newName.trim() } : null);
      setStudents(prev => prev.map(s => s.uid === selectedStudent.uid ? { ...s, displayName: newName.trim() } : s));
      setIsRenaming(false);
    } catch (e) {
      alert("Erreur lors de la mise à jour du nom : " + (e as Error).message);
    } finally {
      setActionPending(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await getAccessRequests();
      let finalData = data;
      if (data && data.length > 0) {
        localStorage.setItem('recif_offline_requests', JSON.stringify(data));
      } else {
        localStorage.setItem('recif_offline_requests', JSON.stringify([]));
        if (typeof window !== 'undefined' && localStorage.getItem('offline_admin_active') === 'true') {
          const cached = localStorage.getItem('recif_offline_requests');
          if (cached) {
            finalData = JSON.parse(cached);
          }
        }
      }
      setAccessRequests(finalData);
    } catch (e) {
      console.warn("Erreur chargement demandes d'accès, tentative de repli cache:", e);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('recif_offline_requests');
        if (cached) {
          setAccessRequests(JSON.parse(cached));
        }
      }
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleDeleteRequest = async (id: string, email: string) => {
    if (!window.confirm(`Voulez-vous rejeter et supprimer la demande d'accès de ${email} ?`)) return;
    setActionPending(true);
    try {
      await deleteAccessRequest(id);
      setAccessRequests(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert("Erreur lors de la suppression de la demande : " + (e as Error).message);
    } finally {
      setActionPending(false);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    alert(`E-mail "${email}" copié !\n\nAllez dans la console Firebase Authentication pour créer ce compte.`);
  };

  const handleCopyPassword = (password: string) => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    alert(`Mot de passe "${password}" copié !`);
  };

  const handleCopyInvitation = (data?: { name: string; email: string; tempPassword: string }) => {
    const modalData = data || successModalData;
    if (!modalData) return;
    const loginUrl = getCleanLoginUrl();
    const text = `Bonjour ${modalData.name},

Votre demande d'inscription sur la plateforme Methodo Clinique Méthodologie a été validée par votre superviseur.

Voici vos identifiants de connexion provisoires :
- E-mail : ${modalData.email}
- Mot de passe temporaire : ${modalData.tempPassword}

Vous pouvez vous connecter dès maintenant sur : ${loginUrl}
Important : Pour des raisons de sécurité, vous serez invité(e) à modifier ce mot de passe temporaire dès votre premier accès.

Cordialement,
Votre superviseur`;

    navigator.clipboard.writeText(text);
    setInvitationCopied(true);
    setTimeout(() => {
      setInvitationCopied(false);
    }, 2000);
  };

  const handleAcceptRequest = async (req: AccessRequest) => {
    // Vérifier que le paiement a été marqué comme reçu
    if (req.status !== 'payment_received') {
      alert("Le paiement n'a pas encore été confirmé pour cette demande.\n\nVeuillez d'abord cliquer sur « Paiement reçu » avant de valider l'inscription.");
      return;
    }

    const confirmMsg = `Confirmez la création du compte pour :\n\n${req.firstName} ${req.lastName}\n${req.email}\n${req.profession} — ${req.institution}\n\nUn mot de passe temporaire sera généré et envoyé par e-mail.`;
    if (!window.confirm(confirmMsg)) return;

    setActionPending(true);
    try {
      if (!user) throw new Error("Utilisateur non connecté");
      const idToken = await user.getIdToken(true);

      // 1. Créer le compte via l'API serveur sécurisée
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          name: `${req.firstName} ${req.lastName}`, 
          email: req.email 
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur serveur lors de la création du compte.");
      }

      const accountData = await res.json();
      const generatedTempPassword = accountData.tempPassword;
      
      // 2. Supprimer la demande traitée de Firestore
      await deleteAccessRequest(req.id);

      // 3. Envoyer l'email de confirmation contenant le mot de passe temporaire
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: req.email,
            subject: "Vos identifiants de connexion - Plateforme Methodo Clinique",
            html: `
              <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fafbfc;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #0d9488; margin: 0; font-size: 1.5rem;">Plateforme Methodo Clinique</h1>
                  <p style="color: #64748b; margin: 4px 0 0;">Méthodologie de Recherche Clinique</p>
                </div>
                <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #166534; font-weight: 600;">Votre paiement a été confirmé et votre compte est activé</p>
                </div>
                <p>Bonjour <strong>${req.firstName} ${req.lastName}</strong>,</p>
                <p>Votre abonnement à la plateforme Methodo Clinique a été activé. Voici vos identifiants de connexion :</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0; font-family: monospace;">
                  <p style="margin: 0 0 8px;"><strong>E-mail :</strong> ${req.email}</p>
                  <p style="margin: 0;"><strong>Mot de passe temporaire :</strong> <span style="color: #0d9488; font-weight: bold; font-size: 1.1rem;">${generatedTempPassword}</span></p>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin: 16px 0;">
                  <p style="margin: 0; color: #991b1b; font-size: 0.88rem;">
                    <strong>Sécurité :</strong> Vous devez modifier ce mot de passe temporaire dès votre première connexion.
                  </p>
                </div>
                <p style="text-align: center; margin: 24px 0;">
                  <a href="${getCleanLoginUrl()}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Se connecter</a>
                </p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 0.78rem; color: #94a3b8; margin: 0;">Message automatique — Ne pas répondre directement.</p>
              </div>
            `
          })
        });
      } catch (mailErr) {
        console.error("Erreur lors de l'envoi de l'email d'activation:", mailErr);
      }

      // 4. Mettre à jour localement les listes
      setAccessRequests(prev => prev.filter(r => r.id !== req.id));
      await fetchStudents();

      // Afficher le modal avec les identifiants
      setSuccessModalData({
        name: `${req.firstName} ${req.lastName}`,
        email: req.email,
        tempPassword: generatedTempPassword
      });
    } catch (e: any) {
      alert("Erreur lors de la création du compte : " + (e?.message || e));
    } finally {
      setActionPending(false);
    }
  };

  const handleMarkPaymentReceived = async (req: AccessRequest) => {
    if (!window.confirm(`Marquer le paiement comme reçu pour ${req.firstName} ${req.lastName} (${req.email}) ?`)) return;
    setActionPending(true);
    try {
      if (!user) throw new Error("Non connecté");
      const docId = req.email.replace(/[^a-z0-9]/g, '_');
      const idToken = await user.getIdToken(true);
      
      await fetch('/api/access-requests/payment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          docId,
          paymentReceivedBy: user.uid 
        })
      });

      setAccessRequests(prev => prev.map(r => 
        r.id === req.id 
          ? { ...r, status: 'payment_received' as const, paymentReceivedAt: new Date(), paymentReceivedBy: user.uid }
          : r
      ));
    } catch (e: any) {
      alert("Erreur : " + (e?.message || e));
    } finally {
      setActionPending(false);
    }
  };

  const handleRejectWithReason = async (req: AccessRequest) => {
    if (!rejectionReason.trim()) {
      alert("Veuillez saisir le motif de rejet.");
      return;
    }
    if (!window.confirm(`Rejeter la demande de ${req.firstName} ${req.lastName} ?`)) return;
    
    setActionPending(true);
    try {
      if (!user) throw new Error("Non connecté");
      const docId = req.email.replace(/[^a-z0-9]/g, '_');
      const idToken = await user.getIdToken(true);

      await fetch('/api/access-requests/payment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          docId,
          status: 'rejected',
          rejectedBy: user.uid,
          rejectionReason: rejectionReason.trim()
        })
      });

      setAccessRequests(prev => prev.filter(r => r.id !== req.id));
      setRejectingRequestId(null);
      setRejectionReason('');
    } catch (e: any) {
      alert("Erreur : " + (e?.message || e));
    } finally {
      setActionPending(false);
    }
  };

  // Check admin rights & set up auto-refresh
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!authIsAdmin) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setCheckingAdmin(false);
    } else {
      setIsAdmin(true);
      setIsSuperAdmin(role === 'admin');
      setCheckingAdmin(false);
      fetchStudents();
      fetchRequests();

      const interval = setInterval(() => {
        fetchStudents();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user, authLoading, authIsAdmin, role]);

  // Synchroniser l'onglet sélectionné avec les paramètres de l'URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'messages') {
        setLeftTab('messages');
      } else if (tab === 'requests') {
        setLeftTab('requests');
      } else if (tab === 'students') {
        setLeftTab('students');
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    const interval = setInterval(handleUrlChange, 250);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  const fetchSupportMessages = async () => {
    if (!user || authLoading || !authIsAdmin) return;
    setLoadingMessages(true);
    setMessagingError('');
    try {
      let filters: any = {};
      if (role === 'teacher') {
        filters = { recipientRole: 'teacher', recipientUid: user.uid, includeSentBy: user.uid };
      } else if (role === 'admin') {
        if (adminMessageFilter === 'admin') {
          filters = { recipientRole: 'admin', includeSentBy: user.uid };
        } else {
          filters = {};
        }
      }
      
      const msgs = await loadSupportMessages(filters);
      setSupportMessages(msgs);
      
      if (activeSupportMessage) {
        const updated = msgs.find(m => m.id === activeSupportMessage.id);
        if (updated) setActiveSupportMessage(updated);
      }
    } catch (e: any) {
      setMessagingError("Erreur chargement messages : " + (e.message || e));
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (user && authIsAdmin && leftTab === 'messages') {
      fetchSupportMessages();
      const interval = setInterval(fetchSupportMessages, 15000);
      return () => clearInterval(interval);
    }
  }, [user, authIsAdmin, leftTab, role, adminMessageFilter]);

  const handleSelectSupportMessage = async (msg: FirestoreSupportMessage) => {
    setActiveSupportMessage(msg);
    setReplyContent('');
    setMessagingError('');
    setMessagingSuccess('');
    
    const supervisorRole = role === 'admin' ? 'admin' : 'teacher';
    const isUnread = (role === 'admin' && !msg.adminRead && msg.recipientRole === 'admin') || 
                     (role === 'teacher' && !msg.teacherRead && msg.recipientRole === 'teacher');
    if (isUnread) {
      try {
        await markMessageReadState(msg.id, supervisorRole);
        setSupportMessages(prev => prev.map(m => m.id === msg.id ? { 
          ...m, 
          adminRead: role === 'admin' ? true : m.adminRead,
          teacherRead: role === 'teacher' ? true : m.teacherRead,
          status: 'read'
        } : m));
        window.dispatchEvent(new Event('progress_changed'));
      } catch (e) {
        console.error("Erreur marquage message lu:", e);
      }
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupportMessage || !replyContent.trim()) return;
    
    setMessagingError('');
    setMessagingSuccess('');
    try {
      const replierRole = role === 'admin' ? 'admin' : 'teacher';
      await replyToSupportMessage(activeSupportMessage.id, replyContent, replierRole);
      setReplyContent('');
      setMessagingSuccess('Réponse envoyée avec succès !');
      await fetchSupportMessages();
    } catch (e: any) {
      setMessagingError("Erreur d'envoi de la réponse : " + (e.message || e));
    }
  };

  const handleSendNewMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setMessagingError('');
    setMessagingSuccess('');
    
    if (role === 'teacher') {
      if (!newMsgSubject.trim() || !newMsgContent.trim()) {
        setMessagingError('Veuillez remplir tous les champs.');
        return;
      }
      try {
        await sendSupportMessage(
          user.uid,
          user.displayName || 'Enseignant',
          user.email || '',
          'teacher',
          'admin',
          undefined,
          newMsgSubject,
          newMsgContent
        );
        setNewMsgSubject('');
        setNewMsgContent('');
        setIsSendingNewMsg(false);
        setMessagingSuccess('Message envoyé avec succès à l\'administrateur !');
        await fetchSupportMessages();
      } catch (e: any) {
        setMessagingError("Erreur d'envoi : " + (e.message || e));
      }
    } else if (role === 'admin') {
      if (!targetTeacherUid) {
        setMessagingError('Veuillez sélectionner un enseignant.');
        return;
      }
      if (!newMsgSubject.trim() || !newMsgContent.trim()) {
        setMessagingError('Veuillez remplir tous les champs.');
        return;
      }
      
      const selectedTeacher = teachers.find(t => t.uid === targetTeacherUid);
      if (!selectedTeacher) {
        setMessagingError('Enseignant introuvable.');
        return;
      }
      
      try {
        await sendSupportMessage(
          user.uid,
          user.displayName || 'Administrateur',
          user.email || '',
          'teacher',
          'teacher',
          selectedTeacher.uid,
          newMsgSubject,
          newMsgContent
        );
        setNewMsgSubject('');
        setNewMsgContent('');
        setTargetTeacherUid('');
        setIsSendingNewMsg(false);
        setMessagingSuccess(`Message envoyé avec succès à ${selectedTeacher.displayName || selectedTeacher.email} !`);
        await fetchSupportMessages();
      } catch (e: any) {
        setMessagingError("Erreur d'envoi : " + (e.message || e));
      }
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await getAllUsers();
      
      let finalData = data;
      if (data && data.length > 0) {
        localStorage.setItem('recif_offline_students', JSON.stringify(data));
      } else {
        localStorage.setItem('recif_offline_students', JSON.stringify([]));
        if (typeof window !== 'undefined' && localStorage.getItem('offline_admin_active') === 'true') {
          const cached = localStorage.getItem('recif_offline_students');
          if (cached) {
            finalData = JSON.parse(cached);
            console.log("Chargement des étudiants depuis le cache local (LocalStorage)");
          }
        }
      }

      const onlyStudents = finalData.filter(u => {
        const email = (u.email || '').toLowerCase();
        const displayName = (u.displayName || '').toLowerCase();
        
        if (u.role === 'admin' || u.role === 'teacher') {
          return false;
        }

        if (email.endsWith('@recif.dz') || displayName.endsWith('@recif.dz')) {
          return false;
        }
        
        if (
          email.includes('admin') || 
          email.includes('enseignant') || 
          email.includes('superviseur') ||
          email.includes('supervisor')
        ) {
          return false;
        }
        
        if (
          displayName.includes('admin') || 
          displayName.includes('enseignant') || 
          displayName.includes('superviseur') ||
          displayName.includes('supervisor')
        ) {
          return false;
        }
        
        if (user && (email === user.email?.toLowerCase() || u.uid === user.uid)) {
          return false;
        }
        
        return true;
      });
      setStudents(onlyStudents);
      
      const onlyTeachers = finalData.filter(u => {
        const email = (u.email || '').toLowerCase();
        return u.role === 'teacher' || 
               (email.endsWith('@recif.dz') && email !== 'admin@recif.dz') ||
               (email.includes('enseignant') && email !== 'admin@recif.dz');
      });
      setTeachers(onlyTeachers);
    } catch (e) {
      console.warn('Erreur lors de la récupération des étudiants, tentative de repli cache:', e);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('recif_offline_students');
        if (cached) {
          const onlyStudents = JSON.parse(cached).filter((u: any) => {
            const email = (u.email || '').toLowerCase();
            const displayName = (u.displayName || '').toLowerCase();
            if (u.role === 'admin' || u.role === 'teacher') return false;
            if (email.endsWith('@recif.dz') || displayName.endsWith('@recif.dz')) return false;
            if (email.includes('admin') || email.includes('enseignant') || email.includes('superviseur') || email.includes('supervisor')) return false;
            if (displayName.includes('admin') || displayName.includes('enseignant') || displayName.includes('superviseur') || displayName.includes('supervisor')) return false;
            if (user && (email === user.email?.toLowerCase() || u.uid === user.uid)) return false;
            return true;
          });
          setStudents(onlyStudents);
        }
      }
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectStudent = async (student: FirestoreUser) => {
    setSelectedStudent(student);
    setLoadingDetails(true);
    setStudentProtocols([]);
    setStudentChats([]);
    setStudentArticles([]);
    setActiveProtocol(null);
    setActiveChat(null);
    setActiveArticle(null);
    setActiveTab('stats');
    setAiReport(null);
    setLoadingAiReport(false);

    try {
      let protos = [];
      let chats = [];
      let arts = [];
      
      try {
        [protos, chats, arts] = await Promise.all([
          loadFirestoreProtocols(student.uid),
          loadFirestoreChats(student.uid),
          loadFirestoreArticles(student.uid)
        ]);
        
        localStorage.setItem(`recif_offline_student_protos_${student.uid}`, JSON.stringify(protos));
        localStorage.setItem(`recif_offline_student_chats_${student.uid}`, JSON.stringify(chats));
        localStorage.setItem(`recif_offline_student_articles_${student.uid}`, JSON.stringify(arts));
      } catch (err) {
        console.warn("Impossible de lire les détails de l'étudiant sur Firestore, bascule vers le cache local...", err);
        const cachedProtos = localStorage.getItem(`recif_offline_student_protos_${student.uid}`);
        const cachedChats = localStorage.getItem(`recif_offline_student_chats_${student.uid}`);
        const cachedArts = localStorage.getItem(`recif_offline_student_articles_${student.uid}`);
        if (cachedProtos) protos = JSON.parse(cachedProtos);
        if (cachedChats) chats = JSON.parse(cachedChats);
        if (cachedArts) arts = JSON.parse(cachedArts);
      }
      
      setStudentProtocols(protos);
      setStudentChats(chats);
      setStudentArticles(arts);
    } catch (e) {
      console.warn('Erreur globale lors de la récupération des détails de l\'étudiant:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleGenerateAiReport = async () => {
    if (!selectedStudent) return;
    setLoadingAiReport(true);
    setAiReport(null);
    try {
      const payload = {
        questionsAsked: selectedStudent.stats?.questionsAsked || 0,
        protocolsGenerated: selectedStudent.stats?.protocolsGenerated || 0,
        quizScore: {
          correct: selectedStudent.stats?.quizCorrect || 0,
          total: selectedStudent.stats?.quizTotal || 0
        },
        flashcardsMastered: {
          mastered: selectedStudent.stats?.flashcardsMastered?.length || 0,
          total: 12
        },
        recentQuestions: selectedStudent.stats?.recentQuestions || [],
        recentProtocols: (selectedStudent.stats?.recentProtocols || []).map((p: any) => p.title || p.titleProtocol || ''),
        synthetic: true
      };
      const response = await fetch('/api/pedagogical-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': localStorage.getItem('recif_ai_provider') || 'gemini',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Échec de la communication avec le serveur API.");
      const data = await response.json();
      setAiReport(data.report || "Aucun bilan généré.");
    } catch (err: any) {
      setAiReport(`Erreur : ${err.message || err}`);
    } finally {
      setLoadingAiReport(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!aiReport || !selectedStudent) return;
    const blob = new Blob([aiReport], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const studentName = selectedStudent.displayName || selectedStudent.email || 'etudiant';
    const cleanName = studentName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `bilan_ia_${cleanName}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!aiReport || !selectedStudent) return;
    const studentName = selectedStudent.displayName || selectedStudent.email || 'Étudiant';
    
    const htmlContent = renderMarkdown(aiReport);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres contextuelles pour imprimer le bilan.");
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Bilan Pédagogique - ${studentName}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #333;
              line-height: 1.6;
              padding: 2rem;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              font-size: 1.8rem;
              color: #0d9488;
              border-bottom: 2px solid #0d9488;
              padding-bottom: 0.5rem;
              margin-bottom: 1.5rem;
              text-align: center;
            }
            h2 {
              font-size: 1.3rem;
              color: #0f766e;
              margin-top: 1.5rem;
              border-bottom: 1px solid #ddd;
              padding-bottom: 0.25rem;
            }
            h3 {
              font-size: 1.1rem;
              color: #115e59;
              margin-top: 1.25rem;
            }
            p, li {
              font-size: 0.95rem;
            }
            li {
              margin-bottom: 0.5rem;
            }
            hr {
              border: 0;
              border-top: 1px solid #eee;
              margin: 1.5rem 0;
            }
            .footer {
              margin-top: 3rem;
              font-size: 0.8rem;
              color: #666;
              text-align: center;
              border-top: 1px solid #eee;
              padding-top: 1rem;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Bilan Pédagogique Synthétique IA</h1>
          <div style="margin-bottom: 1.5rem; font-size: 0.9rem; color: #555; background: #f9f9f9; padding: 1rem; border-radius: 6px;">
            <strong>Étudiant :</strong> ${studentName}<br/>
            <strong>Adresse e-mail :</strong> ${selectedStudent.email || 'Non renseignée'}<br/>
            <strong>Date de génération :</strong> ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
          </div>
          <div>
            ${htmlContent}
          </div>
          <div class="footer">
            Plateforme d'Apprentissage de la Méthodologie de Recherche Clinique — Methodo Clinique
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getRecipientLabel = (msg: FirestoreSupportMessage) => {
    if (msg.recipientRole === 'admin') return 'Admin';
    if (msg.recipientRole === 'teacher') {
      const found = teachers.find(t => t.uid === msg.recipientUid);
      return found ? (found.displayName || found.email || 'Enseignant') : 'Enseignant';
    }
    return '';
  };

  // Si l'utilisateur connecté est un enseignant, on restreint la liste à ses étudiants affectés
  const visibleStudents = role === 'teacher'
    ? students.filter(s => s.assignedTeacherUid === user?.uid)
    : students;

  // Filtrer les étudiants
  const filteredStudents = visibleStudents
    .filter(s => {
      const name = (s.displayName || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = name.includes(query) || email.includes(query);
      
      if (presenceFilter === 'online') {
        return matchesSearch && isUserOnline(s.lastActive);
      }
      return matchesSearch;
    })
    .sort((a, b) => {
      const aOnline = isUserOnline(a.lastActive);
      const bOnline = isUserOnline(b.lastActive);
      
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      
      const aTime = a.lastActive?.seconds ? a.lastActive.seconds * 1000 : (a.lastActive ? new Date(a.lastActive).getTime() : 0);
      const bTime = b.lastActive?.seconds ? b.lastActive.seconds * 1000 : (b.lastActive ? new Date(b.lastActive).getTime() : 0);
      
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      
      const aName = a.displayName || '';
      const bName = b.displayName || '';
      return aName.localeCompare(bName);
    });

  // Calculs statistiques collectifs
  const totalStudents = visibleStudents.length;
  const totalProtocols = visibleStudents.reduce((acc, curr) => acc + (curr.stats?.protocolsGenerated || 0), 0);
  const totalQuestions = visibleStudents.reduce((acc, curr) => acc + (curr.stats?.questionsAsked || 0), 0);
  const unreadMessagesCount = supportMessages.filter(m => 
    (role === 'admin' && !m.adminRead) || (role === 'teacher' && !m.teacherRead)
  ).length;
  
  const totalQuizCorrect = visibleStudents.reduce((acc, curr) => acc + (curr.stats?.quizCorrect || 0), 0);
  const totalQuizTotal = visibleStudents.reduce((acc, curr) => acc + (curr.stats?.quizTotal || 0), 0);
  const classroomQuizAverage = totalQuizTotal > 0 ? Math.round((totalQuizCorrect / totalQuizTotal) * 100) : 0;

  if (authLoading || checkingAdmin) {
    return (
      <div className={styles.loadingContainer}>
        <svg className={styles.spinner} xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span>Vérification de vos habilitations de supervision...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`${styles.deniedCard} glass-card`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-danger)" strokeWidth="1.5">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <h2>Accès Restreint</h2>
        <p>Cet espace est exclusivement réservé aux enseignants et superviseurs de la plateforme Methodo Clinique.</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Pour y accéder, veuillez vous connecter avec un compte email se terminant par <strong>@recif.dz</strong>.
        </p>
        <button className="btn btn-primary" onClick={() => router.push('/')}>
          Retour au Tableau de bord Étudiant
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className={styles.title}>Espace Superviseur</h1>
            <p className={styles.subtitle}>
              Suivi pédagogique en temps réel, monitoring des protocoles et supervision des sessions de tutorat.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => { fetchStudents(); fetchRequests(); }} disabled={loadingStudents || loadingRequests} style={{ fontSize: '0.85rem' }}>
            {loadingStudents || loadingRequests ? 'Actualisation...' : 'Actualiser les données'}
          </button>
        </div>
      </header>

      {/* Cartes KPI Collectifs */}
      <section className={styles.kpiGrid}>
        <div className="glass-card styles.kpiCard" style={{ padding: '1.25rem' }}>
          <span className={styles.kpiLabel}>Étudiants inscrits</span>
          <span className={styles.kpiValue} style={{ color: 'var(--accent-primary)' }}>{totalStudents}</span>
        </div>
        <div className="glass-card styles.kpiCard" style={{ padding: '1.25rem' }}>
          <span className={styles.kpiLabel}>Moyenne globale Quiz</span>
          <span className={styles.kpiValue} style={{ color: 'var(--accent-success)' }}>{classroomQuizAverage}%</span>
        </div>
        <div className="glass-card styles.kpiCard" style={{ padding: '1.25rem' }}>
          <span className={styles.kpiLabel}>Protocoles IA rédigés</span>
          <span className={styles.kpiValue} style={{ color: 'var(--accent-secondary)' }}>{totalProtocols}</span>
        </div>
        <div className="glass-card styles.kpiCard" style={{ padding: '1.25rem' }}>
          <span className={styles.kpiLabel}>Interactions Tuteur</span>
          <span className={styles.kpiValue} style={{ color: 'var(--accent-warning)' }}>{totalQuestions}</span>
        </div>
      </section>

      <div className={styles.layout}>
        {/* Liste des étudiants / Demandes d'accès (Gauche) */}
        <div className={`${styles.studentListCard} glass-card`}>
          {/* Onglets Gauche */}
          <div className={styles.tabs} style={{ marginBottom: '1.25rem' }}>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'students' ? styles.activeTab : ''}`}
              onClick={() => setLeftTab('students')}
            >
              Élèves inscrits ({visibleStudents.length})
            </button>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'requests' ? styles.activeTab : ''}`}
              onClick={() => setLeftTab('requests')}
            >
              Demandes ({accessRequests.length})
            </button>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'messages' ? styles.activeTab : ''}`}
              onClick={() => setLeftTab('messages')}
              style={{ position: 'relative' }}
            >
              Messagerie {unreadMessagesCount > 0 && <span className={styles.tabRedDot} />}
            </button>
          </div>

          {leftTab === 'students' ? (
            <>
              <div className={styles.filterContainer}>
                <div className={styles.searchBar} style={{ flex: 1 }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Rechercher un étudiant par nom ou email..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <select
                    className={styles.presenceSelect}
                    value={presenceFilter}
                    onChange={(e) => setPresenceFilter(e.target.value as 'all' | 'online')}
                  >
                    <option value="all">Tous les élèves</option>
                    <option value="online">En ligne uniquement 🟢</option>
                  </select>
                </div>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nom / Email</th>
                      <th>Niveau</th>
                      <th>Quiz</th>
                      <th>Fiches</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          {loadingStudents ? 'Chargement de la liste des étudiants...' : 'Aucun étudiant trouvé.'}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => {
                        const isSelected = selectedStudent?.uid === student.uid;
                        const quizCorrect = student.stats?.quizCorrect || 0;
                        const quizTotal = student.stats?.quizTotal || 0;
                        const quizPct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
                        const level = student.level || 'Débutant';
                        
                        let levelClass = styles.badgeDeb;
                        if (level === 'Avancé') levelClass = styles.badgeAdv;
                        else if (level === 'Intermédiaire') levelClass = styles.badgeInt;

                        const online = isUserOnline(student.lastActive);
                        const lastActiveStr = formatLastActive(student.lastActive);

                        return (
                          <tr key={student.uid} className={isSelected ? styles.selectedRow : ''}>
                            <td>
                              <div className={styles.studentInfo}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <span className={`${styles.statusDot} ${online ? styles.statusDotOnline : styles.statusDotOffline}`} title={online ? "En ligne" : "Hors ligne"} />
                                  <span className={styles.studentName}>{student.displayName || 'Étudiant'}</span>
                                  {student.status === 'suspended' && (
                                    <span className={styles.miniSuspendedBadge}>Suspendu</span>
                                  )}
                                  {online && (
                                    <span className={styles.miniOnlineBadge}>En ligne</span>
                                  )}
                                </div>
                                <span className={styles.studentEmail}>{student.email}</span>
                                <span className={styles.lastActiveTime}>{lastActiveStr}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`${styles.levelBadge} ${levelClass}`}>{level}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{quizPct}%</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{quizCorrect}/{quizTotal} rps.</span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: '600' }}>{student.stats?.protocolsGenerated || 0}</span>
                            </td>
                            <td>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => handleSelectStudent(student)}
                              >
                                Superviser
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : leftTab === 'requests' ? (
            // Demandes d'accès
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Demandeur</th>
                    <th>Profil</th>
                    <th>Localisation</th>
                    <th>Statut</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {loadingRequests ? 'Chargement des demandes...' : 'Aucune demande d\'accès en attente.'}
                      </td>
                    </tr>
                  ) : (
                    accessRequests.map((req) => {
                      const fullName = `${req.firstName} ${req.lastName}`;
                      const isPending = req.status === 'pending';
                      const isPaymentReceived = req.status === 'payment_received';
                      const isRejecting = rejectingRequestId === req.id;

                      return (
                        <tr key={req.id} style={{ 
                          background: isPaymentReceived ? 'rgba(16, 185, 129, 0.05)' : 'transparent' 
                        }}>
                          <td>
                            <div style={{ marginBottom: '4px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fullName}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{req.email}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{req.institution}</div>
                            {req.phone && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{req.phone}</div>
                            )}
                          </td>
                          <td>
                            <span style={{ 
                              display: 'inline-block', 
                              background: 'rgba(255,255,255,0.05)', 
                              padding: '3px 10px', 
                              borderRadius: '12px', 
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)'
                            }}>
                              {req.profession}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {req.city}, {req.country}
                          </td>
                          <td>
                            {isPending && (
                              <span style={{ 
                                display: 'inline-block', 
                                background: 'rgba(251, 191, 36, 0.1)', 
                                color: '#f59e0b', 
                                padding: '3px 10px', 
                                borderRadius: '12px', 
                                fontSize: '0.78rem',
                                fontWeight: 600 
                              }}>
                                En attente de paiement
                              </span>
                            )}
                            {isPaymentReceived && (
                              <span style={{ 
                                display: 'inline-block', 
                                background: 'rgba(16, 185, 129, 0.1)', 
                                color: '#10b981', 
                                padding: '3px 10px', 
                                borderRadius: '12px', 
                                fontSize: '0.78rem',
                                fontWeight: 600 
                              }}>
                                Paiement reçu ✓
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {req.createdAt?.seconds 
                              ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('fr-FR')
                              : '—'
                            }
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                              {isPending && (
                                <>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                                    onClick={() => handleMarkPaymentReceived(req)}
                                    disabled={actionPending}
                                  >
                                    💰 Paiement reçu
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                    onClick={() => { setRejectingRequestId(req.id); setRejectionReason(''); }}
                                    disabled={actionPending}
                                  >
                                    ✕ Rejeter
                                  </button>
                                </>
                              )}
                              {isPaymentReceived && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%', background: 'rgba(13,148,136,0.15)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.4)', fontWeight: 600 }}
                                  onClick={() => handleAcceptRequest(req)}
                                  disabled={actionPending}
                                >
                                  ✓ Valider & créer le compte
                                </button>
                              )}
                              {isRejecting && (
                                <div style={{ marginTop: '4px', width: '100%' }}>
                                  <textarea
                                    placeholder="Motif du rejet..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    style={{
                                      width: '100%',
                                      background: 'rgba(255,255,255,0.05)',
                                      border: '1px solid rgba(239,68,68,0.3)',
                                      borderRadius: '6px',
                                      padding: '6px 8px',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.78rem',
                                      resize: 'vertical',
                                      minHeight: '50px',
                                      outline: 'none'
                                    }}
                                  />
                                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', flex: 1, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                      onClick={() => handleRejectWithReason(req)}
                                      disabled={actionPending || !rejectionReason.trim()}
                                    >
                                      Confirmer
                                    </button>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', flex: 1 }}
                                      onClick={() => setRejectingRequestId(null)}
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            // Onglet Messagerie
            <div style={{ padding: '0.5rem 0' }}>
              {messagingError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#ef4444', fontSize: '0.85rem' }}>{messagingError}</div>}
              {messagingSuccess && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#10b981', fontSize: '0.85rem' }}>{messagingSuccess}</div>}
              
              {role === 'admin' && (
                <div style={{ marginBottom: '12px' }}>
                  <select
                    value={adminMessageFilter}
                    onChange={(e) => setAdminMessageFilter(e.target.value as 'admin' | 'all')}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  >
                    <option value="admin" style={{ background: '#1a1a2e' }}>Messages pour moi (Admin)</option>
                    <option value="all" style={{ background: '#1a1a2e' }}>Tous les messages</option>
                  </select>
                </div>
              )}

              {loadingMessages ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chargement des messages...</p>
              ) : supportMessages.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun message.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
                  {supportMessages.map((msg) => {
                    const isActive = activeSupportMessage?.id === msg.id;
                    const isUnread = (role === 'admin' && !msg.adminRead && msg.recipientRole === 'admin') || (role === 'teacher' && !msg.teacherRead && msg.recipientRole === 'teacher');
                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectSupportMessage(msg)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: isActive ? 'rgba(13,148,136,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isActive ? 'rgba(13,148,136,0.3)' : 'transparent'}`,
                          cursor: 'pointer',
                          transition: '0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: isUnread ? 700 : 500, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{msg.senderName}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('fr-FR') : ''}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: isUnread ? 600 : 400, color: 'var(--text-secondary)', marginBottom: '2px' }}>{msg.subject}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeSupportMessage && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>{activeSupportMessage.subject}</h4>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{activeSupportMessage.senderName} ({activeSupportMessage.senderEmail})</p>
                    <p>{activeSupportMessage.content}</p>
                  </div>
                  {activeSupportMessage.reply && (
                    <div style={{ background: 'rgba(13,148,136,0.05)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.85rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '4px' }}>Votre réponse :</p>
                      <p style={{ color: 'var(--text-secondary)' }}>{activeSupportMessage.reply}</p>
                    </div>
                  )}
                  <form onSubmit={handleSendReply}>
                    <textarea
                      placeholder="Écrire une réponse..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical', outline: 'none', marginBottom: '8px' }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem' }} disabled={!replyContent.trim()}>
                      Envoyer la réponse
                    </button>
                  </form>
                </div>
              )}

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Nouveau message</h4>
                <form onSubmit={handleSendNewMessage}>
                  {role === 'admin' && (
                    <select
                      value={targetTeacherUid}
                      onChange={(e) => setTargetTeacherUid(e.target.value)}
                      required
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '8px' }}
                    >
                      <option value="" disabled style={{ background: '#1a1a2e' }}>Sélectionner un enseignant</option>
                      {teachers.map(t => (
                        <option key={t.uid} value={t.uid} style={{ background: '#1a1a2e' }}>{t.displayName || t.email}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    placeholder="Sujet"
                    value={newMsgSubject}
                    onChange={(e) => setNewMsgSubject(e.target.value)}
                    required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '8px', outline: 'none' }}
                  />
                  <textarea
                    placeholder="Votre message..."
                    value={newMsgContent}
                    onChange={(e) => setNewMsgContent(e.target.value)}
                    required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical', outline: 'none', marginBottom: '8px' }}
                  />
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }} disabled={isSendingNewMsg}>
                    {isSendingNewMsg ? 'Envoi...' : 'Envoyer le message'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Panneau de détail étudiant (Droite) */}
        {selectedStudent ? (
          <div className={`${styles.detailCard} glass-card`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                {isRenaming ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--accent-primary)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                      autoFocus
                    />
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={handleSaveName}>OK</button>
                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setIsRenaming(false)}>✕</button>
                  </div>
                ) : (
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setNewName(selectedStudent.displayName || ''); setIsRenaming(true); }}>
                    {selectedStudent.displayName || 'Étudiant'}
                  </h3>
                )}
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{selectedStudent.email}</span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { setSelectedStudent(null); setActiveProtocol(null); setActiveChat(null); setActiveArticle(null); }}>
                ✕ Fermer
              </button>
            </div>

            {/* Onglets de détail */}
            <div className={styles.tabs} style={{ marginBottom: '1rem' }}>
              <button className={`${styles.tabBtn} ${activeTab === 'stats' ? styles.activeTab : ''}`} onClick={() => setActiveTab('stats')}>Stats</button>
              <button className={`${styles.tabBtn} ${activeTab === 'protocols' ? styles.activeTab : ''}`} onClick={() => setActiveTab('protocols')}>Protocoles ({studentProtocols.length})</button>
              <button className={`${styles.tabBtn} ${activeTab === 'chats' ? styles.activeTab : ''}`} onClick={() => setActiveTab('chats')}>Tuteur ({studentChats.length})</button>
              <button className={`${styles.tabBtn} ${activeTab === 'ai-report' ? styles.activeTab : ''}`} onClick={() => setActiveTab('ai-report')}>Bilan IA</button>
              <button className={`${styles.tabBtn} ${activeTab === 'articles' ? styles.activeTab : ''}`} onClick={() => setActiveTab('articles')}>Articles ({studentArticles.length})</button>
            </div>

            {loadingDetails ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chargement des détails...</p>
            ) : activeTab === 'stats' ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{selectedStudent.stats?.questionsAsked || 0}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Questions tuteur</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>{selectedStudent.stats?.protocolsGenerated || 0}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Protocoles générés</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-success)' }}>
                      {selectedStudent.stats?.quizTotal ? Math.round(((selectedStudent.stats.quizCorrect || 0) / selectedStudent.stats.quizTotal) * 100) : 0}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Score Quiz ({selectedStudent.stats?.quizCorrect || 0}/{selectedStudent.stats?.quizTotal || 0})</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-warning)' }}>{selectedStudent.stats?.flashcardsMastered?.length || 0}/12</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Flashcards maîtrisées</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => handleToggleSuspension(selectedStudent.uid, selectedStudent.status === 'suspended' ? 'active' : 'suspended')} disabled={actionPending}>
                    {selectedStudent.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => handleDeleteStudentData(selectedStudent.uid)} disabled={actionPending}>
                    Supprimer définitivement
                  </button>
                </div>
              </div>
            ) : activeTab === 'protocols' ? (
              <div>
                {studentProtocols.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun protocole généré.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentProtocols.map((proto) => (
                      <div key={proto.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', cursor: 'pointer', border: '1px solid transparent', transition: '0.2s' }} onClick={() => { setActiveProtocol(proto); setModalPreviewMode('protocol'); }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>{proto.title || 'Sans titre'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{proto.date} {proto.acronym ? `• ${proto.acronym}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'chats' ? (
              <div>
                {studentChats.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucune discussion avec le tuteur.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentChats.map((chat) => (
                      <div key={chat.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', cursor: 'pointer' }} onClick={() => setActiveChat(chat)}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>{chat.title || 'Discussion'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chat.messages?.length || 0} messages</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'ai-report' ? (
              <div>
                {!aiReport && !loadingAiReport && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Générer un bilan pédagogique synthétique basé sur l'activité de l'étudiant.</p>
                    <button className="btn btn-primary" onClick={handleGenerateAiReport}>Générer le bilan IA</button>
                  </div>
                )}
                {loadingAiReport && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <svg className={styles.spinner} xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Analyse en cours par l'IA...</p>
                  </div>
                )}
                {aiReport && (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={handleDownloadMarkdown}>Markdown</button>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={handleDownloadPdf}>PDF / Imprimer</button>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => { setAiReport(null); }}>Nouveau bilan</button>
                    </div>
                    <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(aiReport) }} />
                  </div>
                )}
              </div>
            ) : activeTab === 'articles' ? (
              <div>
                {studentArticles.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun article rédigé.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentArticles.map((article) => (
                      <div key={article.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', cursor: 'pointer' }} onClick={() => setActiveArticle(article)}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>{article.title || 'Sans titre'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{article.date} • {article.studyType}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`${styles.detailCard} glass-card`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sélectionnez un étudiant pour voir ses détails.</p>
          </div>
        )}
      </div>

      {/* Modal de prévisualisation Protocole */}
      {activeProtocol && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setActiveProtocol(null)}>
          <div style={{ background: 'var(--bg-card, #1a222c)', borderRadius: '12px', maxWidth: '800px', width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>{activeProtocol.title}</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setActiveProtocol(null)}>✕</button>
            </div>
            {activeProtocol.crfContent && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '8px' }}>
                  <button className={`btn btn-secondary ${modalPreviewMode === 'protocol' ? 'activeTab' : ''}`} style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }} onClick={() => setModalPreviewMode('protocol')}>Protocole</button>
                  <button className={`btn btn-secondary ${modalPreviewMode === 'crf' ? 'activeTab' : ''}`} style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }} onClick={() => setModalPreviewMode('crf')}>CRF</button>
                </div>
              </div>
            )}
            <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(modalPreviewMode === 'crf' && activeProtocol.crfContent ? activeProtocol.crfContent : activeProtocol.content) }} />
          </div>
        </div>
      )}

      {/* Modal de prévisualisation Chat */}
      {activeChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setActiveChat(null)}>
          <div style={{ background: 'var(--bg-card, #1a222c)', borderRadius: '12px', maxWidth: '700px', width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>{activeChat.title || 'Discussion'}</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setActiveChat(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(activeChat.messages || []).map((msg: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', lineHeight: 1.6, background: msg.role === 'user' ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation Article */}
      {activeArticle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setActiveArticle(null)}>
          <div style={{ background: 'var(--bg-card, #1a222c)', borderRadius: '12px', maxWidth: '800px', width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>{activeArticle.title}</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setActiveArticle(null)}>✕</button>
            </div>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(activeArticle.content) }} />
          </div>
        </div>
      )}

      {/* Modal de succès création compte */}
      {successModalData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setSuccessModalData(null)}>
          <div style={{ background: 'var(--bg-card, #1a222c)', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '28px', border: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Compte créé avec succès</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Les identifiants ont été envoyés par e-mail.</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nom</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{successModalData.name}</div>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>E-mail</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{successModalData.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mot de passe temporaire</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{successModalData.tempPassword}</code>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} onClick={() => handleCopyPassword(successModalData.tempPassword)} title="Copier le mot de passe">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.85rem' }} onClick={() => handleCopyInvitation()}>
                {invitationCopied ? 'Copié !' : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    Copier l'invitation
                  </>
                )}
              </button>
              <button className="btn btn-secondary" onClick={() => setSuccessModalData(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}