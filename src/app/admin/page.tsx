'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  getAllUsers, 
  loadFirestoreProtocols, 
  loadFirestoreChats, 
  updateUserDisplayName,
  getAccessRequests,
  deleteAccessRequest,
  AccessRequest,
  FirestoreUser, 
  FirestoreProtocol
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
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'protocols' | 'chats'>('stats');

  // Preview modals
  const [activeProtocol, setActiveProtocol] = useState<FirestoreProtocol | null>(null);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [modalPreviewMode, setModalPreviewMode] = useState<'protocol' | 'crf'>('protocol');

  // States pour les demandes d'accès et renommage
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [leftTab, setLeftTab] = useState<'students' | 'requests'>('students');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  // Modal de succès création compte et copie invitation
  const [successModalData, setSuccessModalData] = useState<{
    name: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [invitationCopied, setInvitationCopied] = useState(false);

  const handleToggleSuspension = async (uid: string, newStatus: 'active' | 'suspended') => {
    const confirmMsg = newStatus === 'suspended'
      ? "Êtes-vous sûr de vouloir suspendre temporairement l'activité de cet étudiant ? Il ne pourra plus accéder à l'application."
      : "Êtes-vous sûr de vouloir réactiver l'activité de cet étudiant ?";
    if (!window.confirm(confirmMsg)) return;

    setActionPending(true);
    try {
      if (!user) throw new Error("Utilisateur non connecté");
      const idToken = await user.getIdToken();
      
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
      
      // Mettre à jour l'étudiant sélectionné
      setSelectedStudent(prev => prev ? { ...prev, status: newStatus } : null);
      
      // Mettre à jour la liste locale des étudiants
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
      const idToken = await user.getIdToken();

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
      
      // Désélectionner l'étudiant
      setSelectedStudent(null);
      
      // Supprimer de la liste locale
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
      setAccessRequests(data);
    } catch (e) {
      console.error("Erreur chargement demandes d'accès:", e);
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

Votre demande d'inscription sur la plateforme RECIF Méthodologie a été validée par votre superviseur.

Voici vos identifiants de connexion provisoires :
- E-mail : ${modalData.email}
- Mot de passe temporaire : ${modalData.tempPassword}

Vous pouvez vous connecter dès maintenant sur : ${loginUrl}
⚠️ Important : Pour des raisons de sécurité, vous serez invité(e) à modifier ce mot de passe temporaire dès votre premier accès.

Cordialement,
Votre superviseur RECIF`;

    navigator.clipboard.writeText(text);
    setInvitationCopied(true);
    setTimeout(() => {
      setInvitationCopied(false);
    }, 2000);
  };

  const handleAcceptRequest = async (req: AccessRequest) => {
    const confirmMsg = `Voulez-vous créer le compte étudiant pour ${req.name} (${req.email}) ?\n\nLe compte sera créé dans Firebase Auth et pré-rempli dans la base. Le mot de passe temporaire sera généré automatiquement.`;
    if (!window.confirm(confirmMsg)) return;

    setActionPending(true);
    try {
      if (!user) throw new Error("Utilisateur non connecté");
      const idToken = await user.getIdToken();

      // 1. Créer le compte via notre API serveur sécurisée
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ name: req.name, email: req.email })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur serveur lors de la création du compte.");
      }

      const accountData = await res.json();
      const generatedTempPassword = accountData.tempPassword;
      
      // 2. Supprimer la demande d'accès traitée de Firestore
      await deleteAccessRequest(req.id);

      // 3. Envoyer l'email de confirmation contenant le mot de passe temporaire
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: req.email,
            subject: "Validation de votre accès - Plateforme RECIF",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #0d9488; margin-top: 0;">Accès validé !</h2>
                <p>Bonjour <strong>${req.name}</strong>,</p>
                <p>Votre demande d'inscription sur la plateforme <strong>RECIF Méthodologie</strong> a été validée par votre superviseur.</p>
                <p>Voici vos identifiants de connexion provisoires :</p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0; font-family: monospace; font-size: 0.95rem;">
                  <strong>Adresse e-mail :</strong> ${req.email}<br/>
                  <strong>Mot de passe temporaire :</strong> <span style="color: #0d9488; font-weight: bold;">${generatedTempPassword}</span>
                </div>
                <p style="color: #e11d48; font-weight: bold;">⚠️ Important :</p>
                <p>Pour des raisons de sécurité, vous serez invité(e) à modifier ce mot de passe temporaire dès votre premier accès.</p>
                <p>Vous pouvez vous connecter dès maintenant sur : <a href="${getCleanLoginUrl()}" style="color: #0d9488; font-weight: bold; text-decoration: underline;">Se connecter à RECIF</a></p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 0.8rem; color: #64748b; margin: 0;">Ce message a été envoyé automatiquement. Veuillez ne pas y répondre directement.</p>
              </div>
            `
          })
        });
      } catch (mailErr) {
        console.error("Erreur lors de l'envoi de l'email de confirmation:", mailErr);
      }

      // 4. Mettre à jour localement les listes
      setAccessRequests(prev => prev.filter(r => r.id !== req.id));
      await fetchStudents();

      // Afficher le modal personnalisé au lieu d'une alerte native
      setSuccessModalData({
        name: req.name,
        email: req.email,
        tempPassword: generatedTempPassword
      });
    } catch (e: any) {
      alert("Erreur lors de la création directe du compte : " + (e?.message || e));
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

      // Auto-refresh toutes les 30 secondes pour le statut en ligne/hors ligne
      const interval = setInterval(() => {
        fetchStudents();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user, authLoading, authIsAdmin, role]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await getAllUsers();
      // Filtrer pour exclure les administrateurs et enseignants de la liste des élèves et des statistiques collectives
      const onlyStudents = data.filter(u => {
        const email = (u.email || '').toLowerCase();
        const displayName = (u.displayName || '').toLowerCase();
        
        // Exclure les domaines recif.dz (enseignants et admins officiels)
        if (email.endsWith('@recif.dz') || displayName.endsWith('@recif.dz')) {
          return false;
        }
        
        // Exclure les comptes contenant 'admin', 'enseignant' ou 'superviseur' dans l'email ou le nom d'affichage
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
        
        // Exclure également le superviseur connecté en cours
        if (user && (email === user.email?.toLowerCase() || u.uid === user.uid)) {
          return false;
        }
        
        return true;
      });
      setStudents(onlyStudents);
    } catch (e) {
      console.error('Erreur lors de la récupération des étudiants:', e);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectStudent = async (student: FirestoreUser) => {
    setSelectedStudent(student);
    setLoadingDetails(true);
    setStudentProtocols([]);
    setStudentChats([]);
    setActiveProtocol(null);
    setActiveChat(null);
    setActiveTab('stats');

    try {
      // Charger les protocoles et discussions en parallèle
      const [protos, chats] = await Promise.all([
        loadFirestoreProtocols(student.uid),
        loadFirestoreChats(student.uid)
      ]);
      setStudentProtocols(protos);
      setStudentChats(chats);
    } catch (e) {
      console.error('Erreur de chargement des détails de l\'étudiant:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Filtrer les étudiants
  const filteredStudents = students
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
      
      // Si les deux sont en ligne ou hors ligne, trier par dernière activité (plus récent d'abord)
      const aTime = a.lastActive?.seconds ? a.lastActive.seconds * 1000 : (a.lastActive ? new Date(a.lastActive).getTime() : 0);
      const bTime = b.lastActive?.seconds ? b.lastActive.seconds * 1000 : (b.lastActive ? new Date(b.lastActive).getTime() : 0);
      
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      
      // En dernier recours, par nom
      const aName = a.displayName || '';
      const bName = b.displayName || '';
      return aName.localeCompare(bName);
    });

  // Calculs statistiques collectifs
  const totalStudents = students.length;
  const totalProtocols = students.reduce((acc, curr) => acc + (curr.stats?.protocolsGenerated || 0), 0);
  const totalQuestions = students.reduce((acc, curr) => acc + (curr.stats?.questionsAsked || 0), 0);
  
  const totalQuizCorrect = students.reduce((acc, curr) => acc + (curr.stats?.quizCorrect || 0), 0);
  const totalQuizTotal = students.reduce((acc, curr) => acc + (curr.stats?.quizTotal || 0), 0);
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
        <p>Cet espace est exclusivement réservé aux enseignants et superviseurs de la plateforme RECIF.</p>
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
              Élèves inscrits ({students.length})
            </button>
            <button 
              className={`${styles.tabBtn} ${leftTab === 'requests' ? styles.activeTab : ''}`}
              onClick={() => setLeftTab('requests')}
            >
              Demandes d'accès ({accessRequests.length})
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
          ) : (
            // Demandes d'accès
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nom demandé</th>
                    <th>Adresse e-mail</th>
                    <th>Mot de passe temporaire</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {loadingRequests ? 'Chargement des demandes...' : 'Aucune demande d\'accès en attente.'}
                      </td>
                    </tr>
                  ) : (
                    accessRequests.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{req.name}</span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>{req.email}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code style={{ 
                              background: 'rgba(255, 255, 255, 0.05)', 
                              padding: '0.2rem 0.4rem', 
                              borderRadius: '4px', 
                              fontFamily: 'monospace',
                              color: 'var(--accent-primary)',
                              fontSize: '0.85rem'
                            }}>{req.tempPassword || 'RECIF-XXXXXX'}</code>
                            {req.tempPassword && (
                              <button 
                                onClick={() => handleCopyPassword(req.tempPassword || '')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-secondary)',
                                  padding: '0.2rem',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                                title="Copier le mot de passe"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : 'Date inconnue'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {isSuperAdmin ? (
                              <>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'linear-gradient(135deg, #0d9488 0%, #0b7a70 100%)' }}
                                  onClick={() => handleAcceptRequest(req)}
                                  disabled={actionPending}
                                >
                                  Accepter
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }}
                                  onClick={() => handleDeleteRequest(req.id, req.email)}
                                  disabled={actionPending}
                                >
                                  Rejeter
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Lecture seule</span>
                            )}
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                              onClick={() => handleCopyEmail(req.email)}
                              disabled={actionPending}
                            >
                              Copier E-mail
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Détails de l'étudiant sélectionné (Droite) */}
        <div className={`${styles.detailCard} glass-card`}>
          {!selectedStudent ? (
            <div className={styles.emptyDetail}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>Sélectionnez un étudiant dans la liste pour consulter ses statistiques et inspecter son travail.</span>
            </div>
          ) : (
            <div className={styles.detailContent}>
              <div className={styles.detailHeader}>
                {selectedStudent.photoURL ? (
                  <img src={selectedStudent.photoURL} alt="Avatar" className={styles.detailAvatar} />
                ) : (
                  <div className={styles.detailAvatarPlaceholder}>
                    {(selectedStudent.displayName || selectedStudent.email || 'U').substring(0, 1).toUpperCase()}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isRenaming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', width: '180px', height: '30px' }}
                          value={newName} 
                          onChange={(e) => setNewName(e.target.value)} 
                          placeholder="Nouveau nom..."
                        />
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '30px', background: 'linear-gradient(135deg, #0d9488 0%, #0b7a70 100%)' }}
                          onClick={handleSaveName}
                          disabled={actionPending}
                        >
                          Enregistrer
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '30px' }}
                          onClick={() => setIsRenaming(false)}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3>{selectedStudent.displayName || 'Étudiant'}</h3>
                        {isSuperAdmin && (
                          <button 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.2rem', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => {
                              setIsRenaming(true);
                              setNewName(selectedStudent.displayName || '');
                            }}
                            title="Modifier le nom de cet étudiant"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                        )}
                        <span className={`${styles.statusBadge} ${selectedStudent.status === 'suspended' ? styles.statusSuspended : styles.statusActive}`}>
                          {selectedStudent.status === 'suspended' ? 'Suspendu' : 'Actif'}
                        </span>
                      </>
                    )}
                  </div>
                  <p>{selectedStudent.email}</p>
                </div>
              </div>

              {/* Onglets */}
              <div className={styles.tabs}>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'stats' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('stats')}
                >
                  Statistiques & Quiz
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'protocols' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('protocols')}
                >
                  Protocoles ({studentProtocols.length})
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'chats' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('chats')}
                >
                  Discussions ({studentChats.length})
                </button>
              </div>

              <div className={styles.tabBody}>
                {loadingDetails ? (
                  <div className={styles.detailLoading}>
                    <svg className={styles.spinner} xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>Chargement des détails...</span>
                  </div>
                ) : (
                  <>
                    {/* STATS & QUIZ HISTORY TAB */}
                    {activeTab === 'stats' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className={styles.statsSummaryGrid}>
                          <div className={styles.miniStatsCard}>
                            <span className={styles.miniLabel}>Questions posées</span>
                            <span className={styles.miniValue}>{selectedStudent.stats?.questionsAsked || 0}</span>
                          </div>
                          <div className={styles.miniStatsCard}>
                            <span className={styles.miniLabel}>Flashcards acquises</span>
                            <span className={styles.miniValue}>
                              {selectedStudent.stats?.flashcardsMastered?.length || 0} / 12
                            </span>
                          </div>
                          <div className={styles.miniStatsCard}>
                            <span className={styles.miniLabel}>Fiches rédigées</span>
                            <span className={styles.miniValue}>{selectedStudent.stats?.protocolsGenerated || 0}</span>
                          </div>
                        </div>

                        {/* Quiz History Attempts */}
                        <div className={styles.subSection}>
                          <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.35rem' }}>
                            Historique des quiz résolus
                          </h4>
                          {(!selectedStudent.stats?.quizHistory || selectedStudent.stats.quizHistory.length === 0) ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                              Aucun historique de quiz disponible pour cet étudiant.
                            </p>
                          ) : (
                            <div className={styles.quizHistoryList}>
                              {selectedStudent.stats.quizHistory.map((item: any, idx: number) => {
                                let scoreColorClass = styles.scoreBad;
                                if (item.scorePct >= 80) scoreColorClass = styles.scoreExcellent;
                                else if (item.scorePct >= 50) scoreColorClass = styles.scoreAverage;

                                return (
                                  <div key={item.id || idx} className={styles.quizHistoryItem}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{item.topic}</span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {new Date(item.date).toLocaleDateString('fr-FR', {
                                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                    <span className={`${styles.miniScoreBadge} ${scoreColorClass}`}>
                                      {item.correct} / {item.total}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* GENERATED PROTOCOLS TAB */}
                    {activeTab === 'protocols' && (
                      <div className="animate-fade-in">
                        {studentProtocols.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                            Cet étudiant n'a pas encore rédigé de protocole.
                          </p>
                        ) : (
                          <div className={styles.protocolsList}>
                            {studentProtocols.map((proto) => (
                              <div key={proto.id} className={styles.protoItem}>
                                <div className={styles.protoMeta}>
                                  <strong>[{proto.acronym || 'SANS ACRONYME'}]</strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {new Date(proto.date).toLocaleDateString('fr-FR')}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                                  <span className={styles.protoTitle} title={proto.title}>
                                    {proto.title.length > 50 ? proto.title.substring(0, 50) + '...' : proto.title}
                                  </span>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => setActiveProtocol(proto)}
                                  >
                                    Inspecter
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TUTOR CHATS TAB */}
                    {activeTab === 'chats' && (
                      <div className="animate-fade-in">
                        {studentChats.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                            Aucune discussion enregistrée pour cet étudiant.
                          </p>
                        ) : (
                          <div className={styles.chatsList}>
                            {studentChats.map((chat) => (
                              <div key={chat.id} className={styles.chatItem}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span className={styles.chatTitle} title={chat.title}>
                                    {chat.title.length > 50 ? chat.title.substring(0, 50) + '...' : chat.title}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    Dernière interaction : {chat.updatedAt?.seconds ? new Date(chat.updatedAt.seconds * 1000).toLocaleString('fr-FR') : 'Date inconnue'}
                                  </span>
                                </div>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                  onClick={() => setActiveChat(chat)}
                                >
                                  Lire l'historique
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Section d'actions d'administration */}
              <div className={styles.adminActions}>
                <span className={styles.adminActionsTitle}>Actions de supervision :</span>
                {isSuperAdmin ? (
                  <>
                    <div className={styles.adminButtons}>
                      {selectedStudent.status === 'suspended' ? (
                        <button 
                          className="btn btn-primary" 
                          style={{ 
                            background: 'linear-gradient(135deg, #0d9488 0%, #0b7a70 100%)', 
                            borderColor: 'var(--accent-primary)',
                            fontSize: '0.8rem', 
                            padding: '0.4rem 0.8rem' 
                          }}
                          onClick={() => handleToggleSuspension(selectedStudent.uid, 'active')}
                          disabled={actionPending}
                        >
                          {actionPending ? 'Action...' : 'Réactiver l\'élève'}
                        </button>
                      ) : (
                        <button 
                          className="btn btn-secondary" 
                          style={{ 
                            borderColor: 'var(--accent-danger)', 
                            color: 'var(--accent-danger)', 
                            fontSize: '0.8rem', 
                            padding: '0.4rem 0.8rem' 
                          }}
                          onClick={() => handleToggleSuspension(selectedStudent.uid, 'suspended')}
                          disabled={actionPending}
                        >
                          {actionPending ? 'Action...' : 'Suspendre l\'élève'}
                        </button>
                      )}
                      
                      <button 
                        className="btn btn-secondary" 
                        style={{ 
                          borderColor: 'rgba(239, 68, 68, 0.4)', 
                          color: 'rgba(239, 68, 68, 0.8)', 
                          fontSize: '0.8rem', 
                          padding: '0.4rem 0.8rem' 
                        }}
                        onClick={() => handleDeleteStudentData(selectedStudent.uid)}
                        disabled={actionPending}
                      >
                        {actionPending ? 'Suppression...' : 'Supprimer toutes les données'}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem' }}>
                      ⚠️ <strong>Note d'administration</strong> : La suppression retire les données Firestore (stats, chats, protocoles), mais ne supprime pas le compte d'authentification Firebase. Pensez à supprimer le compte dans votre <strong>Console Firebase (onglet Authentication)</strong> pour bloquer l'accès définitivement.
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                    🔒 Les actions de suspension et de suppression de données sont réservées aux administrateurs. En tant qu'enseignant, votre accès est en lecture seule.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PREVIEW PROTOCOLE */}
      {activeProtocol && (
        <div className={styles.modalOverlay} onClick={() => { setActiveProtocol(null); setModalPreviewMode('protocol'); }}>
          <div className={`${styles.modalContent} glass-card`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>[{activeProtocol.acronym || 'SANS ACRONYME'}] - Rédigé par {selectedStudent?.displayName}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date de création : {new Date(activeProtocol.date).toLocaleDateString('fr-FR')}</span>
              </div>
              <button className={styles.closeBtn} onClick={() => { setActiveProtocol(null); setModalPreviewMode('protocol'); }}>&times;</button>
            </div>
            
            <div className={styles.tabs} style={{ borderBottom: '1px solid var(--border-glass)', padding: '0.5rem 1.5rem 0 1.5rem', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', gap: '0.5rem' }}>
              <button
                className={`${styles.tabBtn} ${modalPreviewMode === 'protocol' ? styles.activeTab : ''}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setModalPreviewMode('protocol')}
              >
                1. Protocole de recherche
              </button>
              <button
                className={`${styles.tabBtn} ${modalPreviewMode === 'crf' ? styles.activeTab : ''}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setModalPreviewMode('crf')}
              >
                2. Cahier d'Observation (CRF) {activeProtocol.crfContent ? '✅' : '❌'}
              </button>
            </div>

            <div className={styles.modalBody}>
              {modalPreviewMode === 'protocol' ? (
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(activeProtocol.content) }} />
              ) : (
                activeProtocol.crfContent ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(activeProtocol.crfContent) }} />
                ) : (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.6 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="9" x2="15" y2="9" />
                      <line x1="9" y1="13" x2="15" y2="13" />
                      <line x1="9" y1="17" x2="15" y2="17" />
                    </svg>
                    <p style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-primary)' }}>CRF non généré</p>
                    <p style={{ fontSize: '0.85rem' }}>Cet étudiant n'a pas encore généré de Cahier d'Observation Clinique (CRF) pour ce protocole.</p>
                  </div>
                )
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => { setActiveProtocol(null); setModalPreviewMode('protocol'); }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW DISCUSSION */}
      {activeChat && (
        <div className={styles.modalOverlay} onClick={() => setActiveChat(null)}>
          <div className={`${styles.modalContent} glass-card`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Discussion : {activeChat.title}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Échanges de {selectedStudent?.displayName} avec le Tuteur Virtuel</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setActiveChat(null)}>&times;</button>
            </div>
            <div className={styles.modalBody} style={{ background: 'var(--bg-tertiary)' }}>
              <div className={styles.chatHistoryMessages}>
                {(!activeChat.messages || activeChat.messages.length === 0) ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun message dans cette discussion.</p>
                ) : (
                  activeChat.messages.map((m: any, idx: number) => (
                    <div key={idx} className={`${styles.messageRow} ${m.role === 'user' ? styles.userRow : styles.assistantRow}`}>
                      <div className={styles.messageBubble}>
                        <div className={styles.messageMeta}>
                          <strong>{m.role === 'user' ? (selectedStudent?.displayName || 'Étudiant') : 'Tuteur RECIF'}</strong>
                          <span>{m.timestamp}</span>
                        </div>
                        <p className={styles.messageText}>{m.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setActiveChat(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUCCESS COMPTE CRÉÉ */}
      {successModalData && (
        <div className={styles.modalOverlay} onClick={() => setSuccessModalData(null)}>
          <div className={`${styles.modalContent} ${styles.successModalContent} glass-card`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.successTitleText} style={{ color: 'var(--accent-success)' }}>Création du compte réussie</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Le compte étudiant a été configuré avec succès</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSuccessModalData(null)}>&times;</button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.successIconContainer}>
                <div className={styles.successBadge}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>

              <h4 className={styles.successTitleText}>
                Compte créé pour {successModalData.name}
              </h4>
              <p className={styles.successDescription}>
                Le profil étudiant est désormais actif dans la base de données.
              </p>

              <div className={styles.credentialsCard}>
                <div className={styles.credentialsRow}>
                  <span className={styles.credentialsLabel}>Adresse E-mail</span>
                  <span className={styles.credentialsValue}>{successModalData.email}</span>
                </div>
                <div className={styles.credentialsRow}>
                  <span className={styles.credentialsLabel}>Mot de passe temporaire</span>
                  <span className={styles.credentialsValue}>{successModalData.tempPassword}</span>
                </div>
              </div>

              <p className={styles.successEmailInfo}>
                📩 Un e-mail automatique contenant ces identifiants a été envoyé à l'étudiant.
              </p>

              <div style={{ marginTop: '1.25rem' }}>
                <span className={styles.previewLabel}>Aperçu de l'invitation :</span>
                <textarea
                  className={styles.previewTextarea}
                  readOnly
                  value={`Bonjour ${successModalData.name},

Votre demande d'inscription sur la plateforme RECIF Méthodologie a été validée par votre superviseur.

Voici vos identifiants de connexion provisoires :
- E-mail : ${successModalData.email}
- Mot de passe temporaire : ${successModalData.tempPassword}

Vous pouvez vous connecter dès maintenant sur : ${getCleanLoginUrl()}
⚠️ Important : Pour des raisons de sécurité, vous serez invité(e) à modifier ce mot de passe temporaire dès votre premier accès.

Cordialement,
Votre superviseur RECIF`}
                />
              </div>
            </div>

            <div className={styles.modalFooter} style={{ gap: '0.75rem' }}>
              <button 
                className={`btn ${invitationCopied ? 'btn-secondary' : 'btn-primary'}`}
                style={invitationCopied ? { color: 'var(--accent-success)', borderColor: 'rgba(52, 211, 153, 0.4)' } : undefined}
                onClick={() => handleCopyInvitation()}
              >
                {invitationCopied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Invitation copiée !
                  </>
                ) : (
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
