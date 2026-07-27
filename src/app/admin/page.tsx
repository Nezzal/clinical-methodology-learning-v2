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
  deleteSupportMessage,
  FirestoreSupportMessage
} from '@/utils/firestore';
import SubscriptionModal from '@/components/SubscriptionModal';
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

const isUserSuperAdminAccount = (u: any): boolean => {
  if (!u) return false;
  const roleStr = String(u.role || '').toLowerCase();
  const emailStr = String(u.email || '').toLowerCase();
  const tierStr = String(u.subscription?.tier || '').toLowerCase();

  return (
    roleStr === 'superadmin' ||
    tierStr === 'superadmin' ||
    emailStr.includes('nezzal.abdelmalek@gmail.com')
  );
};

const isUserAdminAccount = (u: any): boolean => {
  if (!u) return false;
  if (isUserSuperAdminAccount(u)) return false;
  const roleStr = String(u.role || '').toLowerCase();
  const emailStr = String(u.email || '').toLowerCase();
  const nameStr = String(u.displayName || '').toLowerCase();
  const tierStr = String(u.subscription?.tier || '').toLowerCase();

  return (
    roleStr === 'admin' ||
    tierStr === 'admin' ||
    emailStr.includes('admin') ||
    emailStr.includes('nezzal.abdelmalek@yahoo.fr') ||
    nameStr.includes('admin')
  );
};

const getUserFormulaTier = (u: any): string => {
  if (!u) return 'découverte';
  if (isUserSuperAdminAccount(u)) return 'superadmin';
  if (isUserAdminAccount(u)) return 'admin';

  const searchStr = `${u.displayName || ''} ${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase();
  if (searchStr.includes('bouhidel') || searchStr.includes('wissam') || searchStr.includes('bouzegane') || searchStr.includes('malik')) {
    return 'ultra';
  }

  return (u.subscription?.tier || 'découverte').toLowerCase();
};

const getUserDisplayName = (u: any): string => {
  if (!u) return 'Utilisateur';
  const email = (u.email || '').toLowerCase();
  const name = (u.displayName || '').toLowerCase();

  if (email.includes('nezzal') || email.includes('admin@recif.dz') || name.includes('admin') || u.role === 'admin' || isUserAdminAccount(u)) {
    return 'Nezzal Abdelmalek';
  }

  return u.displayName || (u.firstName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Utilisateur');
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading, isAdmin: authIsAdmin, role } = useAuth();
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
  const [activeTab, setActiveTab] = useState<'stats' | 'profile' | 'protocols' | 'chats' | 'ai-report' | 'articles'>('stats');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAiReport, setLoadingAiReport] = useState(false);

  // Modal de consultation détaillée de demande d'accès
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<AccessRequest | null>(null);

  // States pour la modale d'activation spécifique aux Groupes/Institutions
  const [showActivateGroupModal, setShowActivateGroupModal] = useState(false);
  const [groupRequestToActivate, setGroupRequestToActivate] = useState<AccessRequest | null>(null);
  const [groupQuotaInput, setGroupQuotaInput] = useState(10);
  const [groupDurationInput, setGroupDurationInput] = useState(12);
  const [groupInstallationType, setGroupInstallationType] = useState<'web' | 'offline_local'>('web');

  // Preview modals
  const [activeProtocol, setActiveProtocol] = useState<FirestoreProtocol | null>(null);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [activeArticle, setActiveArticle] = useState<any | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [modalPreviewMode, setModalPreviewMode] = useState<'protocol' | 'crf'>('protocol');

  // States pour les demandes d'accès et renommage
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [leftTab, setLeftTab] = useState<'students' | 'requests_indiv' | 'requests_group' | 'messages'>('students');

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
  const [adminMessageFilter, setAdminMessageFilter] = useState<'admin' | 'all'>('all');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  // States et fonction pour l'édition dynamique du profil utilisateur (Admin)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editProfession, setEditProfession] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    if (!selectedStudent || !user) return;
    setIsSavingProfile(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch(`/api/admin/users/${selectedStudent.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          phone: editPhone.trim(),
          profession: editProfession.trim(),
          institution: editInstitution.trim(),
          city: editCity.trim(),
          country: editCountry.trim(),
          residence: editCountry.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur de mise à jour du profil");
      }

      setSelectedStudent(prev => prev ? ({
        ...prev,
        phone: editPhone.trim(),
        profession: editProfession.trim(),
        institution: editInstitution.trim(),
        city: editCity.trim(),
        country: editCountry.trim(),
        residence: editCountry.trim()
      }) : null);

      setStudents(prev => prev.map(s => s.uid === selectedStudent.uid ? {
        ...s,
        phone: editPhone.trim(),
        profession: editProfession.trim(),
        institution: editInstitution.trim(),
        city: editCity.trim(),
        country: editCountry.trim(),
        residence: editCountry.trim()
      } : s));

      setIsEditingProfile(false);
    } catch (e: any) {
      alert("Erreur lors de la mise à jour du profil : " + e.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

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
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // States pour la gestion des étudiants et réabonnements ULTRA (Enseignant)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentProfession, setStudentProfession] = useState('Étudiant en Médecine');
  const [studentInstitution, setStudentInstitution] = useState('');
  const [studentCity, setStudentCity] = useState('');
  const [studentCountry, setStudentCountry] = useState('Algérie');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');

  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalTxId, setRenewalTxId] = useState('');
  const [renewalMessage, setRenewalMessage] = useState('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);
  const [renewalSuccess, setRenewalSuccess] = useState(false);

  const [showQuotaExtensionModal, setShowQuotaExtensionModal] = useState(false);
  const [extensionTxId, setExtensionTxId] = useState('');
  const [extensionCount, setExtensionCount] = useState(1);
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);
  const [extensionSuccess, setExtensionSuccess] = useState(false);

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFirstName.trim() || !studentLastName.trim() || !studentEmail.trim()) {
      setAddStudentError("Le nom, prénom et e-mail sont obligatoires.");
      return;
    }

    setIsAddingStudent(true);
    setAddStudentError('');

    try {
      if (!user) throw new Error("Session expirée");
      const idToken = await user.getIdToken(true);

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: `${studentFirstName.trim()} ${studentLastName.trim()}`,
          email: studentEmail.trim(),
          role: 'student',
          tier: 'ultra',
          durationMonths: profile?.subscription?.durationMonths || 1,
          assignedTeacherUid: user.uid,
          assignedTeacherName: profile?.displayName || user.email,
          phone: studentPhone.trim(),
          profession: studentProfession.trim(),
          institution: studentInstitution.trim(),
          city: studentCity.trim(),
          country: studentCountry.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible d'inscrire cet étudiant.");
      }

      setSuccessModalData({
        name: data.name,
        email: data.email,
        tempPassword: data.tempPassword
      });

      setStudentFirstName('');
      setStudentLastName('');
      setStudentEmail('');
      setStudentPhone('');
      setStudentProfession('Étudiant en Médecine');
      setStudentInstitution('');
      setStudentCity('');
      setStudentCountry('Algérie');
      setShowAddStudentModal(false);
      fetchStudents();
    } catch (err: any) {
      setAddStudentError(err.message || "Erreur lors de la création du compte étudiant.");
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalTxId.trim()) {
      alert("Veuillez saisir le numéro de reçu ou référence du règlement.");
      return;
    }

    setIsSubmittingRenewal(true);
    try {
      if (!user) throw new Error("Session expirée");

      const userCountry = profile?.country || profile?.residence || '';
      const isDzUser = (!userCountry || userCountry.toLowerCase().includes('algér') || userCountry.toLowerCase().includes('dz') || userCountry.toLowerCase().includes('algerie'));
      const isAfricaUser = !isDzUser && (userCountry.toLowerCase().includes('mali') || userCountry.toLowerCase().includes('sénégal') || userCountry.toLowerCase().includes('senegal') || userCountry.toLowerCase().includes('afrique') || userCountry.toLowerCase().includes('africa') || userCountry.toLowerCase().includes('côte d\'ivoire') || userCountry.toLowerCase().includes('cameroun') || userCountry.toLowerCase().includes('gabon') || userCountry.toLowerCase().includes('togo') || userCountry.toLowerCase().includes('bénin'));

      const perStudentPrice = isDzUser ? 1000 : isAfricaUser ? 17 : 45;
      const baseTeacherPrice = isDzUser ? 2500 : isAfricaUser ? 20 : 59;
      const currencyUnit = isDzUser ? 'DZD' : '€';
      const paymentMethodLabel = isDzUser ? 'BaridiMob' : 'PayPal / Western Union';

      const studentCount = visibleStudents.length || 1;
      const totalPrice = baseTeacherPrice + (studentCount * perStudentPrice);

      await sendSupportMessage(
        user.uid,
        profile?.displayName || user.email || 'Enseignant ULTRA',
        user.email || '',
        'teacher',
        'admin',
        undefined,
        `🔄 Demande de Renouvellement Abonnement ULTRA (${totalPrice} ${currencyUnit})`,
        `Bonjour, je demande le renouvellement de mon abonnement ULTRA Enseignant.\n\n` +
        `• Nom Enseignant : ${profile?.displayName || user.email}\n` +
        `• Pays / Zone : ${userCountry || (isDzUser ? 'Algérie' : 'International')}\n` +
        `• Nombre d'étudiants sous ma responsabilité : ${studentCount}\n` +
        `• Montant total réglé (${paymentMethodLabel}) : ${totalPrice} ${currencyUnit}\n` +
        `• Référence / N° de transaction : ${renewalTxId.trim()}\n` +
        (renewalMessage.trim() ? `• Message additionnel : ${renewalMessage.trim()}` : '')
      );

      setRenewalSuccess(true);
      setTimeout(() => {
        setRenewalSuccess(false);
        setShowRenewalModal(false);
        setRenewalTxId('');
        setRenewalMessage('');
      }, 3000);
    } catch (err: any) {
      alert("Erreur lors de l'envoi de la demande : " + err.message);
    } finally {
      setIsSubmittingRenewal(false);
    }
  };

  const handleExtensionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionTxId.trim()) {
      alert("Veuillez saisir la référence ou numéro de transaction.");
      return;
    }

    setIsSubmittingExtension(true);
    try {
      if (!user) throw new Error("Session expirée");

      const userCountry = profile?.country || profile?.residence || '';
      const isDzUser = (!userCountry || userCountry.toLowerCase().includes('algér') || userCountry.toLowerCase().includes('dz') || userCountry.toLowerCase().includes('algerie'));
      const isAfricaUser = !isDzUser && (userCountry.toLowerCase().includes('mali') || userCountry.toLowerCase().includes('sénégal') || userCountry.toLowerCase().includes('senegal') || userCountry.toLowerCase().includes('afrique') || userCountry.toLowerCase().includes('africa') || userCountry.toLowerCase().includes('côte d\'ivoire') || userCountry.toLowerCase().includes('cameroun') || userCountry.toLowerCase().includes('gabon') || userCountry.toLowerCase().includes('togo') || userCountry.toLowerCase().includes('bénin'));

      const perStudentPrice = isDzUser ? 1000 : isAfricaUser ? 17 : 45;
      const currencyUnit = isDzUser ? 'DZD' : '€';
      const paymentMethodLabel = isDzUser ? 'BaridiMob' : 'PayPal / Western Union';

      const addedPrice = extensionCount * perStudentPrice;

      await sendSupportMessage(
        user.uid,
        profile?.displayName || user.email || 'Enseignant ULTRA',
        user.email || '',
        'teacher',
        'admin',
        undefined,
        `➕ Extension de Quota Étudiants (+${extensionCount} étudiant(s) - ${addedPrice} ${currencyUnit})`,
        `Bonjour, je demande une extension de ma capacité d'encadrement étudiants.\n\n` +
        `• Enseignant : ${profile?.displayName || user.email}\n` +
        `• Pays / Zone : ${userCountry || (isDzUser ? 'Algérie' : 'International')}\n` +
        `• Nombre d'étudiants supplémentaires demandés : +${extensionCount}\n` +
        `• Montant réglé (${paymentMethodLabel}) : ${addedPrice} ${currencyUnit}\n` +
        `• Référence / N° de transaction : ${extensionTxId.trim()}`
      );

      setExtensionSuccess(true);
      setTimeout(() => {
        setExtensionSuccess(false);
        setShowQuotaExtensionModal(false);
        setExtensionTxId('');
      }, 3000);
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setIsSubmittingExtension(false);
    }
  };

  const handleExportUsersCSV = () => {
    if (!students || students.length === 0) {
      alert("Aucun utilisateur à exporter.");
      return;
    }

    const headers = [
      "UID",
      "Nom Complexe",
      "E-mail",
      "Téléphone",
      "Rôle",
      "Profession",
      "Institution",
      "Ville",
      "Pays",
      "Formule Abonnement",
      "Statut Compte",
      "Date Inscription",
      "Date Échéance Expiration",
      "Référence Paiement / Reçu",
      "Enseignant Encadrant",
      "Score Quiz (%)",
      "Protocoles Générés",
      "Questions Tuteur"
    ];

    const rows = students.map(u => {
      const quizCorrect = u.stats?.quizCorrect || 0;
      const quizTotal = u.stats?.quizTotal || 0;
      const quizPct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
      const createdDate = u.subscription?.startDate ? new Date(u.subscription.startDate).toLocaleDateString('fr-FR') : '—';
      const validUntilDate = u.subscription?.validUntil ? new Date(u.subscription.validUntil).toLocaleDateString('fr-FR') : 'Illimité';

      return [
        `"${u.uid || ''}"`,
        `"${(getUserDisplayName(u)).replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.phone || '').replace(/"/g, '""')}"`,
        `"${u.role === 'teacher' ? 'Enseignant' : u.role === 'admin' ? 'Administrateur' : 'Étudiant'}"`,
        `"${(u.profession || u.userType || '').replace(/"/g, '""')}"`,
        `"${(u.institution || '').replace(/"/g, '""')}"`,
        `"${(u.city || '').replace(/"/g, '""')}"`,
        `"${(u.country || u.residence || '').replace(/"/g, '""')}"`,
        `"${getUserFormulaTier(u).toUpperCase()}"`,
        `"${u.status === 'suspended' ? 'Suspendu' : 'Actif'}"`,
        `"${createdDate}"`,
        `"${validUntilDate}"`,
        `"${(u.subscription?.paymentReceiptRef || '').replace(/"/g, '""')}"`,
        `"${(u.assignedTeacherName || '').replace(/"/g, '""')}"`,
        `"${quizPct}%"`,
        `"${u.stats?.protocolsGenerated || 0}"`,
        `"${u.stats?.questionsAsked || 0}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `recif_utilisateurs_inscrits_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportRequestsCSV = () => {
    const headers = [
      "ID Demande",
      "Prénom",
      "Nom",
      "E-mail",
      "Téléphone",
      "Profession",
      "Institution",
      "Ville",
      "Pays",
      "Formule Demandée",
      "Statut Demande",
      "Date & Heure Soumission",
      "Date Expiration Prévisionnelle",
      "Référence Paiement / Reçu BaridiMob"
    ];

    const rows = (accessRequests || []).map(r => {
      const createdStr = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString('fr-FR') : '—';
      const expiryStr = r.expiresAt?.seconds ? new Date(r.expiresAt.seconds * 1000).toLocaleString('fr-FR') : '—';

      return [
        `"${r.id || ''}"`,
        `"${(r.firstName || '').replace(/"/g, '""')}"`,
        `"${(r.lastName || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${(r.phone || '').replace(/"/g, '""')}"`,
        `"${(r.profession || '').replace(/"/g, '""')}"`,
        `"${(r.institution || '').replace(/"/g, '""')}"`,
        `"${(r.city || '').replace(/"/g, '""')}"`,
        `"${(r.country || '').replace(/"/g, '""')}"`,
        `"${(r.requestedTier || 'découverte').toUpperCase()}"`,
        `"${r.status === 'payment_received' ? 'Virement Reçu' : r.status === 'accepted' ? 'Validé' : r.status === 'rejected' ? 'Rejeté' : 'En attente'}"`,
        `"${createdStr}"`,
        `"${expiryStr}"`,
        `"${(r.paymentReceiptRef || '').replace(/"/g, '""')}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `recif_demandes_acces_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    if (!window.confirm(`Voulez-vous supprimer définitivement la demande d'accès de ${email} ?`)) return;
    setActionPending(true);
    try {
      if (user) {
        const docId = email.replace(/[^a-z0-9]/g, '_');
        const idToken = await user.getIdToken(true);
        await fetch('/api/access-requests/payment', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ docId })
        });
      }
      await deleteAccessRequest(id);
      setAccessRequests(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert("Erreur lors de la suppression de la demande : " + (e as Error).message);
    } finally {
      setActionPending(false);
    }
  };

  const handleCleanOldRequests = async () => {
    const oldOrRejected = accessRequests.filter(r => {
      if (r.status === 'rejected') return true;
      if (r.createdAt?.seconds) {
        const ageInDays = (Date.now() - r.createdAt.seconds * 1000) / (1000 * 3600 * 24);
        return ageInDays > 7;
      }
      return false;
    });

    if (oldOrRejected.length === 0) {
      alert("Aucune ancienne demande (+7 jours ou rejetée) à nettoyer.");
      return;
    }

    if (!window.confirm(`Voulez-vous supprimer définitivement ${oldOrRejected.length} demande(s) ancienne(s) ou rejetée(s) ?`)) return;

    setActionPending(true);
    try {
      for (const req of oldOrRejected) {
        if (user) {
          const docId = req.email.replace(/[^a-z0-9]/g, '_');
          const idToken = await user.getIdToken(true);
          await fetch('/api/access-requests/payment', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ docId })
          });
        }
        await deleteAccessRequest(req.id);
      }
      setAccessRequests(prev => prev.filter(r => !oldOrRejected.some(o => o.id === r.id)));
      alert(`${oldOrRejected.length} demande(s) supprimée(s) avec succès !`);
    } catch (e) {
      alert("Erreur lors du nettoyage : " + (e as Error).message);
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

Votre demande d'inscription sur la plateforme Methodo&Clinique a été validée par votre superviseur.

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
          email: req.email,
          role: req.requestedRole || 'student',
          tier: req.requestedTier || (req.requestedRole === 'teacher' ? 'ultra' : 'pro'),
          phone: req.phone || '',
          institution: req.institution || '',
          profession: req.profession || '',
          city: req.city || '',
          country: req.country || '',
          paymentReceiptRef: req.paymentReceiptRef || ''
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
            subject: "Vos identifiants de connexion - Plateforme Methodo&Clinique",
            html: `
              <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fafbfc;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #0d9488; margin: 0; font-size: 1.5rem;">Plateforme Methodo&Clinique</h1>
                  <p style="color: #64748b; margin: 4px 0 0;">Méthodologie de Recherche Clinique</p>
                </div>
                <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #166534; font-weight: 600;">Votre paiement a été confirmé et votre compte est activé</p>
                </div>
                <p>Bonjour <strong>${req.firstName} ${req.lastName}</strong>,</p>
                <p>Votre abonnement à la plateforme Methodo&Clinique a été activé. Voici vos identifiants de connexion :</p>
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

  const handleMarkQuoteSent = async (req: AccessRequest) => {
    if (!window.confirm(`Marquer le devis comme envoyé à ${req.firstName} ${req.lastName} (${req.email}) ?`)) return;
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
          status: 'quote_sent'
        })
      });

      setAccessRequests(prev => prev.map(r => 
        r.id === req.id 
          ? { ...r, status: 'quote_sent' as any }
          : r
      ));
    } catch (e: any) {
      alert("Erreur : " + (e?.message || e));
    } finally {
      setActionPending(false);
    }
  };

  const handleActivateGroupRequest = async () => {
    if (!groupRequestToActivate) return;
    const req = groupRequestToActivate;
    const confirmMsg = `Confirmez l'activation de l'accès ${(req.requestedTier || 'institution').toUpperCase()} pour :\n\n${req.firstName} ${req.lastName}\n${req.email}\nCapacité : ${groupQuotaInput} étudiants\nInstallation : ${groupInstallationType === 'web' ? 'En ligne (Web)' : 'Offline (Local)'}\nDurée : ${groupDurationInput} mois\n\nUn mot de passe temporaire sera généré et envoyé par e-mail.`;
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
          email: req.email,
          role: req.requestedRole || 'teacher',
          tier: req.requestedTier,
          durationMonths: groupDurationInput,
          quotaStudents: groupQuotaInput,
          installationType: groupInstallationType,
          phone: req.phone || '',
          institution: req.institution || '',
          profession: req.profession || '',
          city: req.city || '',
          country: req.country || ''
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
            subject: "Vos identifiants de connexion - Plateforme Methodo&Clinique",
            html: `
              <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fafbfc;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #0d9488; margin: 0; font-size: 1.5rem;">Plateforme Methodo&Clinique</h1>
                  <p style="color: #64748b; margin: 4px 0 0;">Méthodologie de Recherche Clinique</p>
                </div>
                <div style="background: #f0fdfa; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #166534; font-weight: 600;">Votre demande de groupe/institution a été activée et configurée</p>
                </div>
                <p>Bonjour <strong>${req.firstName} ${req.lastName}</strong>,</p>
                <p>Votre abonnement à la formule <strong>${(req.requestedTier || 'institution').toUpperCase()}</strong> a été activé avec les caractéristiques suivantes :</p>
                <ul>
                  <li><strong>Capacité de supervision :</strong> ${groupQuotaInput} étudiant(s) maximum</li>
                  <li><strong>Durée d'accès :</strong> ${groupDurationInput} mois</li>
                  <li><strong>Type d'installation :</strong> ${groupInstallationType === 'web' ? 'En ligne (Web)' : 'Offline (Local exécutable)'}</li>
                </ul>
                <p>Voici vos identifiants de connexion :</p>
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
        console.error("Erreur lors de l'envoi de l'email d'activation de groupe:", mailErr);
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
      setShowActivateGroupModal(false);
      setGroupRequestToActivate(null);
    } catch (e: any) {
      alert("Erreur lors de la création du compte : " + (e?.message || e));
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
      } else if (tab === 'requests_indiv') {
        setLeftTab('requests_indiv');
      } else if (tab === 'requests_group') {
        setLeftTab('requests_group');
      } else if (tab === 'requests') {
        setLeftTab('requests_indiv');
      } else if (tab === 'students') {
        setLeftTab('students');
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
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
    const isUnread = msg.senderUid !== user?.uid && (
      (role === 'admin' && !msg.adminRead) || 
      (role === 'teacher' && !msg.teacherRead)
    );

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

  const handleMarkAllMessagesRead = async () => {
    if (!user || supportMessages.length === 0) return;
    const supervisorRole = role === 'admin' ? 'admin' : 'teacher';
    
    const unreadList = supportMessages.filter(m => {
      if (m.senderUid === user.uid) return false;
      if (role === 'admin') return !m.adminRead;
      return !m.teacherRead;
    });

    if (unreadList.length === 0) return;

    try {
      await Promise.all(unreadList.map(m => markMessageReadState(m.id, supervisorRole)));
      setSupportMessages(prev => prev.map(m => ({
        ...m,
        adminRead: role === 'admin' ? true : m.adminRead,
        teacherRead: role === 'teacher' ? true : m.teacherRead,
        status: 'read'
      })));
      window.dispatchEvent(new Event('progress_changed'));
    } catch (e) {
      console.error("Erreur lors du marquage de tous les messages comme lus:", e);
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
        setMessagingError('Veuillez sélectionner un destinataire.');
        return;
      }
      if (!newMsgSubject.trim() || !newMsgContent.trim()) {
        setMessagingError('Veuillez remplir tous les champs.');
        return;
      }
      
      // Rechercher d'abord s'il s'agit d'un enseignant
      let selectedRecipient = teachers.find(t => t.uid === targetTeacherUid);
      let recipientRole: 'teacher' | 'student' = 'teacher';
      
      // Sinon rechercher parmi les étudiants
      if (!selectedRecipient) {
        selectedRecipient = students.find(s => s.uid === targetTeacherUid);
        recipientRole = 'student';
      }
      
      if (!selectedRecipient) {
        setMessagingError('Destinataire introuvable.');
        return;
      }
      
      try {
        await sendSupportMessage(
          user.uid,
          user.displayName || 'Administrateur',
          user.email || '',
          'admin',
          recipientRole,
          selectedRecipient.uid,
          newMsgSubject,
          newMsgContent
        );
        setNewMsgSubject('');
        setNewMsgContent('');
        setTargetTeacherUid('');
        setIsSendingNewMsg(false);
        setMessagingSuccess(`Message envoyé avec succès à ${selectedRecipient.displayName || selectedRecipient.email} !`);
        await fetchSupportMessages();
      } catch (e: any) {
        setMessagingError("Erreur d'envoi : " + (e.message || e));
      }
    }
  };

  const handleDeleteMessage = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce message ?")) return;
    setMessagingError('');
    setMessagingSuccess('');
    try {
      await deleteSupportMessage(msgId);
      if (activeSupportMessage?.id === msgId) {
        setActiveSupportMessage(null);
      }
      setMessagingSuccess('Message supprimé avec succès.');
      await fetchSupportMessages();
    } catch (err: any) {
      setMessagingError("Erreur lors de la suppression : " + (err.message || err));
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

      // Assurer que le compte SuperAdmin (nezzal.abdelmalek@gmail.com) figure dans la liste
      const hasSuperAdmin = finalData.some(u => (u.email || '').toLowerCase().includes('nezzal.abdelmalek@gmail.com'));
      if (!hasSuperAdmin) {
        finalData.unshift({
          uid: 'superadmin-nezzal-gmail',
          email: 'nezzal.abdelmalek@gmail.com',
          displayName: 'Nezzal Abdelmalek',
          firstName: 'Nezzal',
          lastName: 'Abdelmalek',
          role: 'superadmin',
          userType: 'superadmin',
          profession: 'Super Administrateur / Fondateur',
          institution: 'RECIF MethodoClinique',
          status: 'active',
          subscription: {
            tier: 'superadmin',
            status: 'active',
            startDate: new Date().toISOString()
          },
          stats: {
            protocolsGenerated: 28,
            questionsAsked: 180,
            quizCorrect: 30,
            quizTotal: 30
          }
        } as any);
      }

      const onlyStudents = finalData;

      // Enrichissement automatique des profils si des demandes d'accès correspondantes existent
      const enrichedStudents: FirestoreUser[] = onlyStudents.map(u => {
        const uEmail = (u.email || '').toLowerCase();
        const matchingReq = accessRequests.find(r => (r.email || '').toLowerCase() === uEmail);
        if (matchingReq) {
          const updatedUser: FirestoreUser = {
            ...u,
            phone: u.phone || matchingReq.phone || '',
            profession: u.profession || matchingReq.profession || u.userType || '',
            institution: u.institution || matchingReq.institution || '',
            city: u.city || matchingReq.city || '',
            country: u.country || matchingReq.country || u.residence || '',
            subscription: u.subscription ? {
              ...u.subscription,
              paymentReceiptRef: u.subscription.paymentReceiptRef || matchingReq.paymentReceiptRef || ''
            } : undefined
          };

          // Rétro-sauvegarde en arrière-plan dans Firestore si de nouveaux champs ont été récupérés
          if ((!u.phone && matchingReq.phone) || (!u.institution && matchingReq.institution) || (!u.profession && matchingReq.profession)) {
            user?.getIdToken(true).then(idToken => {
              fetch(`/api/admin/users/${u.uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({
                  phone: matchingReq.phone || '',
                  profession: matchingReq.profession || '',
                  institution: matchingReq.institution || '',
                  city: matchingReq.city || '',
                  country: matchingReq.country || '',
                  paymentReceiptRef: matchingReq.paymentReceiptRef || ''
                })
              }).catch(e => console.warn("Auto-backfill failed for", u.uid, e));
            });
          }

          return updatedUser;
        }
        return u;
      });

      setStudents(enrichedStudents);
      
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
            if (u.role === 'admin' || email === 'admin@recif.dz') return false;
            if (email.endsWith('@recif.dz') && email !== 'admin@recif.dz') return false;
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
    setEditPhone(student.phone || '');
    setEditProfession(student.profession || student.userType || '');
    setEditInstitution(student.institution || '');
    setEditCity(student.city || '');
    setEditCountry(student.country || student.residence || '');
    setIsEditingProfile(false);
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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-ai-provider': localStorage.getItem('recif_ai_provider') || 'gemini',
      };
      if (user) {
        try {
          const idToken = await user.getIdToken(true);
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch (tokenErr) {
          console.warn("Erreur token:", tokenErr);
        }
      }

      const response = await fetch('/api/pedagogical-report', {
        method: 'POST',
        headers,
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
            Plateforme d'Apprentissage de la Méthodologie de Recherche Clinique — Methodo&Clinique
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

  const indivRequests = accessRequests.filter(r => r.requestedTier !== 'institution' && r.requestedTier !== 'ultra');
  const groupRequests = accessRequests.filter(r => r.requestedTier === 'institution' || r.requestedTier === 'ultra');

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
  const unreadMessagesCount = supportMessages.filter(m => {
    if (!user) return false;
    if (m.senderUid === user.uid) return false;
    if (role === 'admin') {
      return !m.adminRead && (m.recipientRole === 'admin' || !m.recipientRole);
    } else {
      return !m.teacherRead && (m.recipientRole === 'teacher' || m.recipientUid === user.uid);
    }
  }).length;
  
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
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '85vh', padding: '2rem' }}>
        <div className={`${styles.deniedCard} glass-card`} style={{ maxWidth: '580px', padding: '2.5rem', textAlign: 'center', borderRadius: '20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👑</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Espace Supervision Réservé aux Formules ULTRA Enseignant & INSTITUTION
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
            L'Espace Supervision est exclusivement réservé aux <strong>Enseignants indépendants, Encadreurs et Institutions</strong> (Formules <strong>ULTRA Enseignant</strong> et <strong>INSTITUTION</strong>) pour inscrire, superviser et valider des groupes d'étudiants.
          </p>
          <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
            Les Formules <strong>DÉCOUVERTE</strong>, <strong>PRO</strong> et <strong>EXPERT</strong> sont destinées à un usage individuel et n'incluent pas l'Espace Supervision.
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => setShowSubscriptionModal(true)}
              style={{ padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#1e1b4b', fontWeight: 800, border: 'none', cursor: 'pointer' }}
            >
              🚀 Découvrir l'Offre ULTRA Enseignant
            </button>
            <button className="btn btn-secondary" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
              Retour au Tableau de bord
            </button>
          </div>
        </div>
        <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />
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

      {/* Widget Supervision Enseignant ULTRA */}
      {role === 'teacher' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(30, 41, 59, 0.6))',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.2rem' }}>👑</span>
              <h3 style={{ color: '#fbbf24', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Espace Encadrement ULTRA — Prof. {profile?.displayName || user?.email}
              </h3>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: 0 }}>
              Capacité d'étudiants encadrés : <strong>{visibleStudents.length} / {profile?.subscription?.quotaStudents || 1}</strong> étudiant(s) inscrit(s)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {visibleStudents.length < (profile?.subscription?.quotaStudents || 1) ? (
              <button
                onClick={() => setShowAddStudentModal(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ➕ Inscrire un Étudiant
              </button>
            ) : (
              <button
                onClick={() => setShowQuotaExtensionModal(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid rgba(251, 191, 36, 0.4)',
                  background: 'rgba(251, 191, 36, 0.15)',
                  color: '#fbbf24',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                ➕ Demander +1 Étudiant (+1 000 DZD/m)
              </button>
            )}

            <button
              onClick={() => setShowRenewalModal(true)}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 Renouveler mon Abonnement ULTRA
            </button>
          </div>
        </div>
      )}

      {/* Cartes KPI Collectifs */}
      <section className={styles.kpiGrid}>
        <div className="glass-card styles.kpiCard" style={{ padding: '1.25rem' }}>
          <span className={styles.kpiLabel}>Utilisateurs inscrits</span>
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
          <div className={styles.tabs} style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'students' ? styles.activeTab : ''}`}
              onClick={() => {
                setLeftTab('students');
                router.push('/admin?tab=students');
              }}
            >
              Utilisateurs inscrits ({visibleStudents.length})
            </button>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'requests_indiv' ? styles.activeTab : ''}`}
              onClick={() => {
                setLeftTab('requests_indiv');
                router.push('/admin?tab=requests_indiv');
              }}
            >
              Demandes Indiv. ({indivRequests.length})
            </button>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'requests_group' ? styles.activeTab : ''}`}
              onClick={() => {
                setLeftTab('requests_group');
                router.push('/admin?tab=requests_group');
              }}
            >
              Groupes & Devis ({groupRequests.length})
            </button>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'messages' ? styles.activeTab : ''}`}
              onClick={() => {
                setLeftTab('messages');
                router.push('/admin?tab=messages');
              }}
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
                    placeholder="Rechercher un utilisateur par nom ou email..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    className={styles.presenceSelect}
                    value={presenceFilter}
                    onChange={(e) => setPresenceFilter(e.target.value as 'all' | 'online')}
                  >
                    <option value="all">Tous les utilisateurs</option>
                    <option value="online">En ligne uniquement 🟢</option>
                  </select>
                  <button
                    className="btn btn-secondary"
                    style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.8rem',
                      background: 'rgba(52, 211, 153, 0.12)',
                      color: '#34d399',
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={handleExportUsersCSV}
                    title="Télécharger la liste complète des utilisateurs au format CSV (Excel)"
                  >
                    📥 Exporter en CSV (Excel)
                  </button>
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
                                  <span className={styles.studentName}>{getUserDisplayName(student)}</span>
                                  {student.role === 'superadmin' || isUserSuperAdminAccount(student) ? (
                                    <span style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(245, 158, 11, 0.25))', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.5)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                      👑 Super Administrateur
                                    </span>
                                  ) : student.role === 'admin' || isUserAdminAccount(student) ? (
                                    <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                      🛡️ Administrateur
                                    </span>
                                  ) : student.role === 'teacher' ? (
                                    <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                      👨‍🏫 Enseignant
                                    </span>
                                  ) : null}
                                  {student.status === 'suspended' && (
                                    <span className={styles.miniSuspendedBadge}>Suspendu</span>
                                  )}
                                  {online && (
                                    <span className={styles.miniOnlineBadge}>En ligne</span>
                                  )}
                                </div>
                                <span className={styles.studentEmail}>{student.email}</span>
                                {(() => {
                                  const tier = getUserFormulaTier(student);
                                  const isSuperAdminTier = tier === 'superadmin';
                                  const isAdminTier = tier === 'admin';
                                  const isUltra = tier === 'ultra';
                                  const isExpert = tier === 'expert';
                                  const isInst = tier === 'institution';
                                  const isPro = tier === 'pro';

                                  return (
                                    <div style={{ marginTop: '2px' }}>
                                      <span style={{ 
                                        display: 'inline-block', 
                                        background: isSuperAdminTier ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(245, 158, 11, 0.25))' : isAdminTier ? 'rgba(239, 68, 68, 0.15)' : isUltra ? 'rgba(251, 191, 36, 0.15)' : (isExpert || isInst) ? 'rgba(168, 85, 247, 0.15)' : isPro ? 'rgba(13, 148, 136, 0.15)' : 'rgba(56, 189, 248, 0.15)', 
                                        border: isSuperAdminTier ? '1px solid rgba(251, 191, 36, 0.5)' : isAdminTier ? '1px solid rgba(239, 68, 68, 0.3)' : isUltra ? '1px solid rgba(251, 191, 36, 0.3)' : (isExpert || isInst) ? '1px solid rgba(168, 85, 247, 0.3)' : isPro ? '1px solid rgba(13, 148, 136, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                                        padding: '1px 6px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.68rem',
                                        fontWeight: 'bold',
                                        color: (isSuperAdminTier || isUltra) ? '#fbbf24' : isAdminTier ? '#f87171' : (isExpert || isInst) ? '#c084fc' : isPro ? '#2dd4bf' : '#38bdf8',
                                        textTransform: 'uppercase'
                                      }}>
                                        Formule : {isSuperAdminTier ? '👑 SUPERADMIN' : tier.toUpperCase()}
                                      </span>
                                    </div>
                                  );
                                })()}
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
          ) : leftTab === 'requests_indiv' ? (
            // Demandes d'accès
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Demandes d'accès individuelles ({indivRequests.length} enregistrées)
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.78rem',
                      background: 'rgba(52, 211, 153, 0.12)',
                      color: '#34d399',
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    onClick={handleExportRequestsCSV}
                    title="Télécharger l'historique des demandes au format CSV"
                  >
                    📥 Exporter Demandes (CSV)
                  </button>
                  {accessRequests.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.78rem',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={handleCleanOldRequests}
                      disabled={actionPending}
                    >
                      🗑️ Nettoyer anciennes (+7j/rejetées)
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Demandeur</th>
                      <th>Profil</th>
                      <th>Localisation</th>
                      <th>Statut</th>
                      <th>Date & Heure d'Accès</th>
                      <th>Date & Heure Expiration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indivRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          {loadingRequests ? 'Chargement des demandes...' : 'Aucune demande d\'accès individuelle en attente.'}
                        </td>
                      </tr>
                    ) : (
                      indivRequests.map((req) => {
                        const fullName = `${req.firstName} ${req.lastName}`;
                        const isFreeTest = req.requestedTier === 'découverte';
                        const isPending = req.status === 'pending' && !isFreeTest;
                        const isPaymentReceived = req.status === 'payment_received';
                        const isRejecting = rejectingRequestId === req.id;

                        return (
                          <tr key={req.id} style={{ 
                            background: isFreeTest ? 'rgba(52, 211, 153, 0.04)' : isPaymentReceived ? 'rgba(16, 185, 129, 0.05)' : 'transparent' 
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
                              <div style={{ marginTop: '5px' }}>
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: req.requestedTier === 'ultra' ? 'rgba(251, 191, 36, 0.15)' : req.requestedTier === 'institution' ? 'rgba(147, 51, 234, 0.15)' : req.requestedTier === 'pro' ? 'rgba(13, 148, 136, 0.15)' : 'rgba(56, 189, 248, 0.15)', 
                                  border: req.requestedTier === 'ultra' ? '1px solid rgba(251, 191, 36, 0.3)' : req.requestedTier === 'institution' ? '1px solid rgba(147, 51, 234, 0.3)' : req.requestedTier === 'pro' ? '1px solid rgba(13, 148, 136, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.72rem',
                                  fontWeight: 'bold',
                                  color: req.requestedTier === 'ultra' ? '#fbbf24' : req.requestedTier === 'institution' ? '#c084fc' : req.requestedTier === 'pro' ? '#2dd4bf' : '#38bdf8',
                                  textTransform: 'uppercase'
                                }}>
                                  Formule : {req.requestedTier ? req.requestedTier.toUpperCase() : (req.requestedRole === 'teacher' ? 'ULTRA' : 'PRO')}
                                </span>
                              </div>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {req.city}, {req.country}
                            </td>
                            <td>
                              {isFreeTest ? (
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: 'rgba(52, 211, 153, 0.15)', 
                                  color: '#34d399', 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  border: '1px solid rgba(52, 211, 153, 0.3)'
                                }}>
                                  🟢 Test 3j Actif (Gratuit)
                                </span>
                              ) : isPending ? (
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
                              ) : isPaymentReceived ? (
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
                              ) : (
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: 'rgba(16, 185, 129, 0.1)', 
                                  color: '#10b981', 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  fontSize: '0.78rem',
                                  fontWeight: 600 
                                }}>
                                  Validé ✓
                                </span>
                              )}
                              {req.paymentReceiptRef && (
                                <div style={{ marginTop: '5px', fontSize: '0.74rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                                  {req.country && (req.country.toLowerCase().includes('algér') || req.country.toLowerCase().includes('dz') || req.country.toLowerCase().includes('algerie'))
                                    ? `📲 Reçu BaridiMob N° : ${req.paymentReceiptRef}`
                                    : `💳 Réf Paiement : ${req.paymentReceiptRef}`}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {req.createdAt?.seconds ? (
                                <>
                                  <div style={{ fontWeight: 600 }}>
                                    {new Date(req.createdAt.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </div>
                                  <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                                    🕒 {new Date(req.createdAt.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </>
                              ) : '—'}
                            </td>
                            <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                              {isFreeTest && req.createdAt?.seconds ? (() => {
                                const createdMs = req.createdAt.seconds * 1000;
                                const expiryMs = createdMs + (3 * 24 * 60 * 60 * 1000);
                                const expiryDateObj = new Date(expiryMs);
                                const isExpired = Date.now() > expiryMs;

                                return (
                                  <div style={{ color: isExpired ? '#f87171' : '#34d399' }}>
                                    <div style={{ fontWeight: 600 }}>
                                      {expiryDateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: isExpired ? '#fca5a5' : '#a7f3d0', marginTop: '2px' }}>
                                      ⏰ {expiryDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} {isExpired ? '(Expiré)' : ''}
                                    </div>
                                  </div>
                                );
                              })() : req.expiresAt?.seconds ? (() => {
                                const expiryDateObj = new Date(req.expiresAt.seconds * 1000);
                                const isExpired = Date.now() > (req.expiresAt.seconds * 1000);
                                return (
                                  <div style={{ color: isExpired ? '#f87171' : '#38bdf8' }}>
                                    <div style={{ fontWeight: 600 }}>
                                      {expiryDateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: isExpired ? '#fca5a5' : '#cbd5e1', marginTop: '2px' }}>
                                      🕒 {expiryDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} {isExpired ? '(Expiré)' : ''}
                                    </div>
                                  </div>
                                );
                              })() : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {isPending ? 'En attente virement' : 'Illimité'}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: '100%', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}
                                  onClick={() => setSelectedRequestDetail(req)}
                                >
                                  👁️ Fiche Demandeur
                                </button>

                                {isFreeTest ? (
                                  <span style={{ 
                                    display: 'inline-block',
                                    padding: '0.3rem 0.6rem',
                                    fontSize: '0.74rem',
                                    color: '#34d399',
                                    background: 'rgba(52, 211, 153, 0.1)',
                                    border: '1px solid rgba(52, 211, 153, 0.3)',
                                    borderRadius: '6px',
                                    fontWeight: 600
                                  }}>
                                    ⚡ Accès Instantané Actif
                                  </span>
                                ) : isPending ? (
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
                                ) : isPaymentReceived ? (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%', background: 'rgba(13,148,136,0.15)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.4)', fontWeight: 600 }}
                                    onClick={() => handleAcceptRequest(req)}
                                    disabled={actionPending}
                                  >
                                    ✓ Valider & créer le compte
                                  </button>
                                ) : null}

                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem", width: "100%", background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", marginTop: '2px' }}
                                  onClick={() => handleDeleteRequest(req.id, req.email)}
                                  disabled={actionPending}
                                >
                                  🗑 Supprimer
                                </button>
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
          </>
          ) : leftTab === 'requests_group' ? (
            // Demandes Groupes / Devis (ULTRA & INSTITUTION)
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Demandes de groupes et devis ({groupRequests.length} enregistrées)
                </div>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Demandeur / Institution</th>
                      <th>Profil</th>
                      <th>Localisation</th>
                      <th>Statut</th>
                      <th>Date Demande</th>
                      <th>Suivi Devis</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          {loadingRequests ? 'Chargement des demandes...' : 'Aucune demande de groupe ou devis institutionnel.'}
                        </td>
                      </tr>
                    ) : (
                      groupRequests.map((req) => {
                        const fullName = `${req.firstName} ${req.lastName}`;
                        const isPending = req.status === 'pending';
                        const isQuoteSent = req.status === 'quote_sent';
                        const isPaymentReceived = req.status === 'payment_received';
                        const isRejecting = rejectingRequestId === req.id;

                        return (
                          <tr key={req.id}>
                            <td>
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fullName}</span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{req.email}</div>
                              <div style={{ fontSize: '0.78rem', color: '#c084fc', fontWeight: '600' }}>🏛️ {req.institution}</div>
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
                              <div style={{ marginTop: '5px' }}>
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: req.requestedTier === 'ultra' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(147, 51, 234, 0.15)', 
                                  border: req.requestedTier === 'ultra' ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(147, 51, 234, 0.3)',
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.72rem',
                                  fontWeight: 'bold',
                                  color: req.requestedTier === 'ultra' ? '#fbbf24' : '#c084fc',
                                  textTransform: 'uppercase'
                                }}>
                                  Formule : {req.requestedTier ? req.requestedTier.toUpperCase() : 'INSTITUTION'}
                                </span>
                              </div>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {req.city}, {req.country}
                            </td>
                            <td>
                              {isPending ? (
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: 'rgba(147, 51, 234, 0.15)', 
                                  color: '#c084fc', 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  border: '1px solid rgba(147, 51, 234, 0.3)'
                                }}>
                                  ⏳ Devis à envoyer
                                </span>
                              ) : isQuoteSent ? (
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: 'rgba(56, 189, 248, 0.15)', 
                                  color: '#38bdf8', 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  border: '1px solid rgba(56, 189, 248, 0.3)'
                                }}>
                                  📧 Devis envoyé
                                </span>
                              ) : isPaymentReceived ? (
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: 'rgba(16, 185, 129, 0.15)', 
                                  color: '#34d399', 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                  💰 Paiement reçu
                                </span>
                              ) : (
                                <span style={{ 
                                  display: 'inline-block', 
                                  background: 'rgba(16, 185, 129, 0.1)', 
                                  color: '#10b981', 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  fontSize: '0.78rem',
                                  fontWeight: 600 
                                }}>
                                  Validé ✓
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {req.createdAt?.seconds ? (
                                <>
                                  <div style={{ fontWeight: 600 }}>
                                    {new Date(req.createdAt.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </div>
                                  <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                                    🕒 {new Date(req.createdAt.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </>
                              ) : '—'}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {isPending ? 'Attente de contact' : isQuoteSent ? 'Négociation / Proposition' : 'Paiement / Finalisation'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: '100%', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}
                                  onClick={() => setSelectedRequestDetail(req)}
                                >
                                  👁️ Fiche Demandeur
                                </button>

                                {isPending && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}
                                    onClick={() => handleMarkQuoteSent(req)}
                                    disabled={actionPending}
                                  >
                                    📧 Devis envoyé
                                  </button>
                                )}

                                {(isPending || isQuoteSent || isPaymentReceived) && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}
                                    onClick={() => {
                                      setGroupRequestToActivate(req);
                                      setGroupQuotaInput(req.requestedTier === 'institution' ? 100 : 10);
                                      setGroupDurationInput(12);
                                      setGroupInstallationType('web');
                                      setShowActivateGroupModal(true);
                                    }}
                                    disabled={actionPending}
                                  >
                                    ✓ Activer & Configurer
                                  </button>
                                )}

                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                  onClick={() => { setRejectingRequestId(req.id); setRejectionReason(''); }}
                                  disabled={actionPending}
                                >
                                  ✕ Rejeter
                                </button>

                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem", width: "100%", background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", marginTop: '2px' }}
                                  onClick={() => handleDeleteRequest(req.id, req.email)}
                                  disabled={actionPending}
                                >
                                  🗑 Supprimer
                                </button>

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
            </>
          ) : (
            // Onglet Messagerie
            <div style={{ padding: '0.5rem 0' }}>
              {messagingError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#ef4444', fontSize: '0.85rem' }}>{messagingError}</div>}
              {messagingSuccess && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#10b981', fontSize: '0.85rem' }}>{messagingSuccess}</div>}
              
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {role === 'admin' && (
                  <select
                    value={adminMessageFilter}
                    onChange={(e) => setAdminMessageFilter(e.target.value as 'admin' | 'all')}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  >
                    <option value="all" style={{ background: '#1a1a2e' }}>Tous les messages (Reçus & Envoyés)</option>
                    <option value="admin" style={{ background: '#1a1a2e' }}>Messages reçus uniquement</option>
                  </select>
                )}
                {unreadMessagesCount > 0 && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleMarkAllMessagesRead}
                    style={{ padding: '0.5rem 0.8rem', fontSize: '0.78rem', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    ✓ Tout marquer comme lu ({unreadMessagesCount})
                  </button>
                )}
              </div>

              {loadingMessages ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chargement des messages...</p>
              ) : supportMessages.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun message.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {supportMessages.map((msg) => {
                    const isActive = activeSupportMessage?.id === msg.id;
                    const isUnread = msg.senderUid !== user?.uid && ((role === 'admin' && !msg.adminRead) || (role === 'teacher' && !msg.teacherRead));
                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectSupportMessage(msg)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: isActive ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isActive ? 'rgba(13,148,136,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          cursor: 'pointer',
                          transition: '0.2s',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                          <span style={{ fontWeight: isUnread ? 700 : 600, fontSize: '0.88rem', color: 'var(--text-primary)', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.senderName}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('fr-FR') : ''}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteMessage(msg.id, e)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="Supprimer ce message"
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.84rem', fontWeight: isUnread ? 600 : 400, color: 'var(--accent-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.subject}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeSupportMessage && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.95rem', margin: 0 }}>{activeSupportMessage.subject}</h4>
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(activeSupportMessage.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        color: '#f87171',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Supprimer ce message"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {activeSupportMessage.senderUid === user?.uid ? "Vous" : activeSupportMessage.senderName} ({activeSupportMessage.senderEmail})
                    </p>
                    <p>{activeSupportMessage.content}</p>
                  </div>
                  {activeSupportMessage.reply && (
                    <div style={{ background: 'rgba(13,148,136,0.05)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.85rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                        {activeSupportMessage.senderUid === user?.uid ? "Réponse reçue :" : "Votre réponse :"}
                      </p>
                      <p style={{ color: 'var(--text-secondary)' }}>{activeSupportMessage.reply}</p>
                    </div>
                  )}
                  {activeSupportMessage.senderUid !== user?.uid && !activeSupportMessage.reply && (
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
                  )}
                  {activeSupportMessage.senderUid === user?.uid && !activeSupportMessage.reply && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      ⏳ En attente de réponse du destinataire...
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px', paddingBottom: '60px' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  Nouveau message
                </h4>
                <form onSubmit={handleSendNewMessage}>
                  {role === 'admin' && (
                    <select
                      value={targetTeacherUid}
                      onChange={(e) => setTargetTeacherUid(e.target.value)}
                      required
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '10px' }}
                    >
                      <option value="" disabled style={{ background: '#1a1a2e' }}>Sélectionner un destinataire</option>
                      <optgroup label="Enseignants" style={{ background: '#1a1a2e', color: 'var(--accent-primary)' }}>
                        {teachers.map(t => (
                          <option key={t.uid} value={t.uid} style={{ background: '#1a1a2e', color: 'var(--text-primary)' }}>{t.displayName || t.email}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Étudiants" style={{ background: '#1a1a2e', color: 'var(--accent-secondary)' }}>
                        {students.map(s => (
                          <option key={s.uid} value={s.uid} style={{ background: '#1a1a2e', color: 'var(--text-primary)' }}>{s.displayName || s.email}</option>
                        ))}
                      </optgroup>
                    </select>
                  )}
                  <input
                    type="text"
                    placeholder="Sujet du message"
                    value={newMsgSubject}
                    onChange={(e) => setNewMsgSubject(e.target.value)}
                    required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '10px', outline: 'none' }}
                  />
                  <textarea
                    placeholder="Votre message..."
                    value={newMsgContent}
                    onChange={(e) => setNewMsgContent(e.target.value)}
                    required
                    style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical', outline: 'none', marginBottom: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      fontSize: '0.9rem', 
                      padding: '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0d9488 100%)', 
                      color: '#ffffff', 
                      border: 'none', 
                      borderRadius: '8px', 
                      fontWeight: '600', 
                      cursor: 'pointer', 
                      boxShadow: '0 4px 14px rgba(13, 148, 136, 0.4)' 
                    }} 
                    disabled={isSendingNewMsg}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    {isSendingNewMsg ? 'Envoi en cours...' : 'Envoyer le message'}
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
                    {getUserDisplayName(selectedStudent)}
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
              <button className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.activeTab : ''}`} onClick={() => setActiveTab('profile')}>👤 Fiche Profil</button>
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
            ) : activeTab === 'profile' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                    {isEditingProfile ? '✏️ Mode Édition du Profil' : '📋 Fiche Signalétique Utilisateur'}
                  </div>
                  {!isEditingProfile ? (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}
                      onClick={() => {
                        setEditPhone(selectedStudent.phone || '');
                        setEditProfession(selectedStudent.profession || selectedStudent.userType || '');
                        setEditInstitution(selectedStudent.institution || '');
                        setEditCity(selectedStudent.city || '');
                        setEditCountry(selectedStudent.country || selectedStudent.residence || '');
                        setIsEditingProfile(true);
                      }}
                    >
                      ✏️ Éditer la Fiche Profil
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? 'Enregistrement...' : '✓ Enregistrer'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => setIsEditingProfile(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>

                {!isEditingProfile ? (
                  <>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 700 }}>👤 Coordonnées Personnelles</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Nom Complet</span>
                          <strong style={{ color: '#f8fafc' }}>{getUserDisplayName(selectedStudent)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>E-mail</span>
                          <span style={{ color: '#38bdf8' }}>{selectedStudent.email}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Téléphone</span>
                          <span style={{ color: '#cbd5e1' }}>{selectedStudent.phone || 'Non renseigné'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Localisation</span>
                          <span style={{ color: '#cbd5e1' }}>{[selectedStudent.city, selectedStudent.country || selectedStudent.residence].filter(Boolean).join(', ') || 'Non renseignée'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 700 }}>🎓 Profil Professionnel & Institution</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Profession / Rôle</span>
                          <span style={{ color: '#cbd5e1' }}>{selectedStudent.profession || selectedStudent.userType || selectedStudent.role || 'Étudiant'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Institution / Faculté</span>
                          <span style={{ color: '#cbd5e1' }}>{selectedStudent.institution || 'Non renseignée'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(13,148,136,0.06)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(13,148,136,0.2)' }}>
                      <div style={{ fontSize: '0.78rem', color: '#2dd4bf', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 700 }}>💳 Abonnement & Règlement</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Formule Active</span>
                          {(() => {
                            const tier = getUserFormulaTier(selectedStudent);
                            const isUltra = tier === 'ultra';
                            const isExpert = tier === 'expert';
                            const isInst = tier === 'institution';
                            const isPro = tier === 'pro';
                            const isAdminTier = tier === 'admin';
                            const color = isAdminTier ? '#f87171' : isUltra ? '#fbbf24' : (isExpert || isInst) ? '#c084fc' : isPro ? '#2dd4bf' : '#38bdf8';

                            return (
                              <span style={{ fontWeight: 800, color, textTransform: 'uppercase' }}>
                                Formule {tier.toUpperCase()}
                              </span>
                            );
                          })()}
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Statut du Compte</span>
                          <span style={{ color: selectedStudent.status === 'suspended' ? '#f87171' : '#34d399', fontWeight: 600 }}>
                            {selectedStudent.status === 'suspended' ? '🔴 Suspendu' : '🟢 Actif'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Date d'Échéance</span>
                          <span style={{ color: '#cbd5e1' }}>
                            {selectedStudent.subscription?.validUntil ? new Date(selectedStudent.subscription.validUntil).toLocaleDateString('fr-FR') : 'Illimité'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Référence / N° Reçu</span>
                          <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            {selectedStudent.subscription?.paymentReceiptRef || 'Validation Directe Admin'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Téléphone</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={e => setEditPhone(e.target.value)}
                        placeholder="Ex : +213 6 61 00 00 00"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Profession / Qualité / Rôle</label>
                      <input
                        type="text"
                        value={editProfession}
                        onChange={e => setEditProfession(e.target.value)}
                        placeholder="Ex : Médecin Généraliste, Resident, Enseignant..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Institution / Faculté / Établissement</label>
                      <input
                        type="text"
                        value={editInstitution}
                        onChange={e => setEditInstitution(e.target.value)}
                        placeholder="Ex : CHU de Paris, Faculté de Médecine d'Alger..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Ville</label>
                        <input
                          type="text"
                          value={editCity}
                          onChange={e => setEditCity(e.target.value)}
                          placeholder="Ex : Paris, Alger..."
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Pays</label>
                        <input
                          type="text"
                          value={editCountry}
                          onChange={e => setEditCountry(e.target.value)}
                          placeholder="Ex : France, Algérie, Mali..."
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: 700 }}
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? 'Enregistrement...' : 'Enregistrer la Fiche Profil'}
                      </button>
                    </div>
                  </div>
                )}
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
      {/* Modal Inscription Étudiant Enseignant ULTRA */}
      {showAddStudentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(6px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowAddStudentModal(false)}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: 700 }}>
                ➕ Inscrire un Étudiant (Contrat ULTRA)
              </h3>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setShowAddStudentModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Prénom de l'étudiant *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Amina"
                  value={studentFirstName}
                  onChange={e => setStudentFirstName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Nom de famille *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Benali"
                  value={studentLastName}
                  onChange={e => setStudentLastName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Adresse e-mail de l'étudiant *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex : amina.benali@univ-alger.dz"
                  value={studentEmail}
                  onChange={e => setStudentEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Numéro de téléphone</label>
                <input
                  type="tel"
                  placeholder="Ex : +213 6 61 00 00 00"
                  value={studentPhone}
                  onChange={e => setStudentPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Profession / Rôle / Année</label>
                <input
                  type="text"
                  placeholder="Ex : Étudiant 5ème année Médecine, Resident, Doctorant..."
                  value={studentProfession}
                  onChange={e => setStudentProfession(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Institution / Faculté / Établissement</label>
                <input
                  type="text"
                  placeholder="Ex : Faculté de Médecine d'Alger, CHU Mustapha..."
                  value={studentInstitution}
                  onChange={e => setStudentInstitution(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Ville</label>
                  <input
                    type="text"
                    placeholder="Ex : Alger"
                    value={studentCity}
                    onChange={e => setStudentCity(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Pays</label>
                  <input
                    type="text"
                    placeholder="Ex : Algérie, Mali, France..."
                    value={studentCountry}
                    onChange={e => setStudentCountry(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                  />
                </div>
              </div>

              {addStudentError && (
                <div style={{ color: '#fca5a5', fontSize: '0.85rem', background: 'rgba(239,68,68,0.15)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
                  ⚠️ {addStudentError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isAddingStudent}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isAddingStudent ? 'Création en cours...' : 'Inscrire cet Étudiant'}
                </button>
                <button
                  type="button"
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                  onClick={() => setShowAddStudentModal(false)}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Renouvellement Abonnement ULTRA */}
      {showRenewalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(6px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowRenewalModal(false)}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.15rem', fontWeight: 700 }}>
                🔄 Renouvellement de l'Abonnement ULTRA
              </h3>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setShowRenewalModal(false)}>✕</button>
            </div>

            {renewalSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#34d399' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Demande transmise avec succès !</h4>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>L'administrateur a été notifié et validera la prolongation de votre compte et de vos étudiants sous 24h.</p>
              </div>
            ) : (
              (() => {
                const uC = profile?.country || profile?.residence || '';
                const isDz = (!uC || uC.toLowerCase().includes('algér') || uC.toLowerCase().includes('dz') || uC.toLowerCase().includes('algerie'));
                const isAf = !isDz && (uC.toLowerCase().includes('mali') || uC.toLowerCase().includes('sénégal') || uC.toLowerCase().includes('senegal') || uC.toLowerCase().includes('afrique') || uC.toLowerCase().includes('africa') || uC.toLowerCase().includes('côte d\'ivoire') || uC.toLowerCase().includes('cameroun') || uC.toLowerCase().includes('gabon') || uC.toLowerCase().includes('togo') || uC.toLowerCase().includes('bénin'));
                const perStudent = isDz ? 1000 : isAf ? 17 : 45;
                const baseTeacher = isDz ? 2500 : isAf ? 20 : 59;
                const curr = isDz ? 'DZD' : '€';
                const studentCount = visibleStudents.length || 1;
                const total = baseTeacher + (studentCount * perStudent);

                return (
                  <form onSubmit={handleRenewalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '12px 14px', borderRadius: '10px', fontSize: '0.88rem', color: '#e0f2fe' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>📊 Détail du Montant Mensuel à Régler :</div>
                      <div>• Formule de Base Enseignant : <strong>{baseTeacher} {curr}</strong></div>
                      <div>• Étudiants sous responsabilité : <strong>{studentCount} × {perStudent} {curr} = {studentCount * perStudent} {curr}</strong></div>
                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(2, 132, 199, 0.3)', fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                        Total à régler : {total} {curr} / mois
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {isDz ? (
                        <>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '2px' }}>Compte BaridiMob Officiel :</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>RIP : 00799999000041210947</div>
                          <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Titulaire : Professeur Nezzal Abdelmalek</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginBottom: '4px', fontWeight: 700 }}>Instructions de Paiement International :</div>
                          <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginBottom: '4px' }}>
                            <strong>💳 Compte PayPal :</strong> <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>nezzal.abdelmalek@gmail.com</span>
                          </div>
                          <div style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>
                            <strong>💸 Western Union :</strong> Bénéficiaire: Nezzal Hanane Hayette (Quebec Brossard, Canada)
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                        {isDz ? "N° de transaction ou reçu BaridiMob *" : "Référence PayPal ou MTCN Western Union *"}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={isDz ? "Ex : N° Reçu 987654321..." : "Ex : Réf PayPal / MTCN Western Union..."}
                        value={renewalTxId}
                        onChange={e => setRenewalTxId(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Message facultatif</label>
                      <textarea
                        rows={2}
                        placeholder="Ajouter une remarque pour l'administrateur..."
                        value={renewalMessage}
                        onChange={e => setRenewalMessage(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button
                        type="submit"
                        disabled={isSubmittingRenewal}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {isSubmittingRenewal ? 'Transmission...' : 'Envoyer la preuve de paiement'}
                      </button>
                      <button
                        type="button"
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                        onClick={() => setShowRenewalModal(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Modal Demande d'Extension d'Étudiants */}
      {showQuotaExtensionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(6px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowQuotaExtensionModal(false)}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '1.15rem', fontWeight: 700 }}>
                ➕ Demander des Étudiants Supplémentaires
              </h3>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setShowQuotaExtensionModal(false)}>✕</button>
            </div>

            {extensionSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#34d399' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Demande d'extension envoyée !</h4>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>L'administrateur ajustera votre capacité d'encadrement dès confirmation du virement.</p>
              </div>
            ) : (
              (() => {
                const uC = profile?.country || profile?.residence || '';
                const isDz = (!uC || uC.toLowerCase().includes('algér') || uC.toLowerCase().includes('dz') || uC.toLowerCase().includes('algerie'));
                const isAf = !isDz && (uC.toLowerCase().includes('mali') || uC.toLowerCase().includes('sénégal') || uC.toLowerCase().includes('senegal') || uC.toLowerCase().includes('afrique') || uC.toLowerCase().includes('africa') || uC.toLowerCase().includes('côte d\'ivoire') || uC.toLowerCase().includes('cameroun') || uC.toLowerCase().includes('gabon') || uC.toLowerCase().includes('togo') || uC.toLowerCase().includes('bénin'));
                const perStudent = isDz ? 1000 : isAf ? 17 : 45;
                const curr = isDz ? 'DZD' : '€';

                return (
                  <form onSubmit={handleExtensionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>Nombre d'étudiants supplémentaires</label>
                      <select
                        value={extensionCount}
                        onChange={e => setExtensionCount(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                      >
                        <option value={1}>+ 1 Étudiant (+{1 * perStudent} {curr}/mois)</option>
                        <option value={2}>+ 2 Étudiants (+{2 * perStudent} {curr}/mois)</option>
                        <option value={3}>+ 3 Étudiants (+{3 * perStudent} {curr}/mois)</option>
                        <option value={5}>+ 5 Étudiants (+{5 * perStudent} {curr}/mois)</option>
                      </select>
                    </div>

                    <div style={{ background: isDz ? 'rgba(251, 191, 36, 0.1)' : 'rgba(2, 132, 199, 0.12)', border: isDz ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(2, 132, 199, 0.3)', padding: '12px', borderRadius: '8px', color: isDz ? '#fcd34d' : '#e0f2fe', fontSize: '0.85rem' }}>
                      {isDz ? (
                        <>Montant additionnel à régler sur BaridiMob (RIP 00799999000041210947) : <strong>{extensionCount * perStudent} DZD / mois</strong></>
                      ) : (
                        <>Montant additionnel à régler via PayPal (<code style={{ color: '#38bdf8' }}>nezzal.abdelmalek@gmail.com</code>) ou Western Union (Nezzal Hanane Hayette, Quebec Brossard Canada) : <strong>{extensionCount * perStudent} € / mois</strong></>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                        {isDz ? "N° de transaction BaridiMob *" : "Référence PayPal ou MTCN Western Union *"}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={isDz ? "Ex : Reçu virement N°..." : "Ex : Réf PayPal / MTCN Western Union..."}
                        value={extensionTxId}
                        onChange={e => setExtensionTxId(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button
                        type="submit"
                        disabled={isSubmittingExtension}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#1e1b4b', fontWeight: 800, cursor: 'pointer' }}
                      >
                        {isSubmittingExtension ? 'Envoi...' : 'Demander l\'extension'}
                      </button>
                      <button
                        type="button"
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                        onClick={() => setShowQuotaExtensionModal(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                );
              })()
            )}
          </div>
        </div>
      )}
      {/* Modal Fiche Détaillée du Demandeur d'Accès */}
      {selectedRequestDetail && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(8px)', 
            zIndex: 10000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1rem' 
          }} 
          onClick={() => setSelectedRequestDetail(null)}
        >
          <div 
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.15)', 
              borderRadius: '16px', 
              maxWidth: '560px', 
              width: '100%', 
              padding: '1.75rem', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.2rem', fontWeight: 700 }}>
                  📋 Fiche Complète du Demandeur
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Réf Demande : {selectedRequestDetail.id}</span>
              </div>
              <button 
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }} 
                onClick={() => setSelectedRequestDetail(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Carte Identité */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 700 }}>👤 Coordonnées du Demandeur</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Nom Complet</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{selectedRequestDetail.firstName} {selectedRequestDetail.lastName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>E-mail</span>
                    <span style={{ color: '#38bdf8' }}>{selectedRequestDetail.email}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Téléphone</span>
                    <span style={{ color: '#cbd5e1' }}>{selectedRequestDetail.phone || 'Non renseigné'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Localisation</span>
                    <span style={{ color: '#cbd5e1' }}>{[selectedRequestDetail.city, selectedRequestDetail.country].filter(Boolean).join(', ') || 'Non renseignée'}</span>
                  </div>
                </div>
              </div>

              {/* Carte Professionnelle */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 700 }}>🎓 Profil Professionnel & Établissement</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Profession / Rôle</span>
                    <span style={{ color: '#cbd5e1' }}>{selectedRequestDetail.profession || 'Non renseignée'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Institution / Faculté</span>
                    <span style={{ color: '#cbd5e1' }}>{selectedRequestDetail.institution || 'Non renseignée'}</span>
                  </div>
                </div>
              </div>

              {/* Carte Demande & Paiement */}
              <div style={{ background: 'rgba(13,148,136,0.06)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(13,148,136,0.2)' }}>
                <div style={{ fontSize: '0.78rem', color: '#2dd4bf', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 700 }}>💳 Formule Demandée & Détails Virement</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Formule Choisie</span>
                    <span style={{ 
                      fontWeight: 800, 
                      color: selectedRequestDetail.requestedTier === 'ultra' ? '#fbbf24' : selectedRequestDetail.requestedTier === 'expert' ? '#c084fc' : selectedRequestDetail.requestedTier === 'pro' ? '#2dd4bf' : '#38bdf8', 
                      textTransform: 'uppercase' 
                    }}>
                      Formule {selectedRequestDetail.requestedTier || 'DÉCOUVERTE'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Statut de la Demande</span>
                    <span style={{ color: selectedRequestDetail.status === 'payment_received' ? '#34d399' : selectedRequestDetail.status === 'accepted' ? '#38bdf8' : selectedRequestDetail.status === 'rejected' ? '#f87171' : selectedRequestDetail.status === 'quote_sent' ? '#38bdf8' : '#fcd34d', fontWeight: 600 }}>
                      {selectedRequestDetail.status === 'payment_received' ? '💰 Virement Reçu' : selectedRequestDetail.status === 'accepted' ? '✓ Compte Validé' : selectedRequestDetail.status === 'rejected' ? '✕ Rejetée' : selectedRequestDetail.status === 'quote_sent' ? '📧 Devis Envoyé' : '⏳ En attente'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Date de Soumission</span>
                    <span style={{ color: '#cbd5e1' }}>
                      {selectedRequestDetail.createdAt?.seconds ? new Date(selectedRequestDetail.createdAt.seconds * 1000).toLocaleString('fr-FR') : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Référence / Reçu Transmis</span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700 }}>
                      {selectedRequestDetail.paymentReceiptRef ? (
                        (['algérie', 'dz', 'algeria'].includes((selectedRequestDetail.country || '').toLowerCase()) || !selectedRequestDetail.country)
                          ? `📲 Reçu BaridiMob N° : ${selectedRequestDetail.paymentReceiptRef}`
                          : `💳 Réf Paiement : ${selectedRequestDetail.paymentReceiptRef}`
                      ) : 'Aucun reçu téléversé'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Rapides */}
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {(() => {
                  const isGroup = selectedRequestDetail.requestedTier === 'institution' || selectedRequestDetail.requestedTier === 'ultra';
                  if (isGroup) {
                    return (
                      <>
                        {selectedRequestDetail.status === 'pending' && (
                          <button
                            className="btn btn-secondary"
                            style={{ flex: 1, padding: '10px', fontSize: '0.82rem', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)', fontWeight: 700 }}
                            onClick={async () => {
                              await handleMarkQuoteSent(selectedRequestDetail);
                              setSelectedRequestDetail(null);
                            }}
                            disabled={actionPending}
                          >
                            📧 Devis envoyé
                          </button>
                        )}
                        {(selectedRequestDetail.status === 'pending' || selectedRequestDetail.status === 'quote_sent' || selectedRequestDetail.status === 'payment_received') && (
                          <button
                            className="btn btn-secondary"
                            style={{ flex: 1, padding: '10px', fontSize: '0.82rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', fontWeight: 700 }}
                            onClick={() => {
                              const req = selectedRequestDetail;
                              setGroupRequestToActivate(req);
                              setGroupQuotaInput(req.requestedTier === 'institution' ? 100 : 10);
                              setGroupDurationInput(12);
                              setGroupInstallationType('web');
                              setSelectedRequestDetail(null);
                              setShowActivateGroupModal(true);
                            }}
                            disabled={actionPending}
                          >
                            ✓ Activer & Configurer
                          </button>
                        )}
                      </>
                    );
                  }

                  // Demandes individuelles normales
                  return (
                    <>
                      {selectedRequestDetail.status === 'pending' && selectedRequestDetail.requestedTier !== 'découverte' && (
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '10px', fontSize: '0.82rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', fontWeight: 700 }}
                          onClick={async () => {
                            await handleMarkPaymentReceived(selectedRequestDetail);
                            setSelectedRequestDetail(null);
                          }}
                          disabled={actionPending}
                        >
                          💰 Marquer paiement reçu
                        </button>
                      )}

                      {(selectedRequestDetail.status === 'payment_received' || selectedRequestDetail.requestedTier === 'découverte') && (
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '10px', fontSize: '0.82rem', background: 'rgba(13,148,136,0.2)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,0.5)', fontWeight: 800 }}
                          onClick={async () => {
                            await handleAcceptRequest(selectedRequestDetail);
                            setSelectedRequestDetail(null);
                          }}
                          disabled={actionPending}
                        >
                          ✓ Valider & Créer le Compte
                        </button>
                      )}
                    </>
                  );
                })()}

                <button
                  className="btn btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.82rem', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)' }}
                  onClick={() => setSelectedRequestDetail(null)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'Activation Groupes & Institutions */}
      {showActivateGroupModal && groupRequestToActivate && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} 
          onClick={() => { setShowActivateGroupModal(false); setGroupRequestToActivate(null); }}
        >
          <div 
            style={{ background: '#0f172a', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(147, 51, 234, 0.25)', color: 'white' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                <h3 style={{ margin: 0, color: '#c084fc', fontSize: '1.2rem', fontWeight: 800 }}>
                  Configuration Accès Groupe
                </h3>
              </div>
              <button 
                onClick={() => { setShowActivateGroupModal(false); setGroupRequestToActivate(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Infos demandeur */}
              <div style={{ background: 'rgba(147, 51, 234, 0.05)', border: '1px solid rgba(147, 51, 234, 0.15)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.85rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Établissement & Responsable
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{groupRequestToActivate.firstName} {groupRequestToActivate.lastName}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{groupRequestToActivate.email}</div>
                <div style={{ fontSize: '0.88rem', color: '#cbd5e1', marginTop: '6px', fontWeight: 700 }}>🏛️ {groupRequestToActivate.institution}</div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Profession : {groupRequestToActivate.profession}</div>
              </div>

              {/* Formulaire */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    Capacité d'étudiants (Nombre de sièges) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={groupQuotaInput}
                    onChange={(e) => setGroupQuotaInput(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: '0.9rem' }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                    Nombre maximum de comptes étudiants que ce superviseur pourra enregistrer.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    Type d'installation requis *
                  </label>
                  <select
                    value={groupInstallationType}
                    onChange={(e) => setGroupInstallationType(e.target.value as 'web' | 'offline_local')}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: 'white', fontSize: '0.9rem' }}
                  >
                    <option value="web">Accès Web en ligne classique (Portail)</option>
                    <option value="offline_local">Offline local (Package exécutable .exe/.dmg)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    Durée de validité (en mois) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={groupDurationInput}
                    onChange={(e) => setGroupDurationInput(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Pied de formulaire */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={handleActivateGroupRequest}
                  disabled={actionPending}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #c084fc, #9333ea)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {actionPending ? 'Activation...' : '⚡ Activer le Compte'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowActivateGroupModal(false); setGroupRequestToActivate(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}