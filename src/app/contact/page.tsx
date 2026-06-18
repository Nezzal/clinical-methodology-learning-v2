'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  sendSupportMessage, 
  loadSupportMessages, 
  markMessageReadState, 
  FirestoreSupportMessage 
} from '@/utils/firestore';
import styles from './page.module.css';

export default function ContactPage() {
  const { user, guestMode, profile } = useAuth();
  const [messages, setMessages] = useState<FirestoreSupportMessage[]>([]);
  const [activeMessage, setActiveMessage] = useState<FirestoreSupportMessage | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  
  // Form fields
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const fetchMessages = async () => {
    if (user && !guestMode) {
      try {
        const msgs = await loadSupportMessages({ senderUid: user.uid });
        setMessages(msgs);
        
        // Si un message actif est sélectionné, rafraîchir son contenu local
        if (activeMessage) {
          const updated = msgs.find(m => m.id === activeMessage.id);
          if (updated) setActiveMessage(updated);
        }
      } catch (e) {
        console.error("Erreur chargement messages support:", e);
      }
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Rafraîchir toutes les 30 secondes en tâche de fond (polling de secours)
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [user, guestMode]);

  const handleSelectMessage = async (msg: FirestoreSupportMessage) => {
    setActiveMessage(msg);
    setIsCreating(false);
    
    // Marquer comme lu pour l'étudiant
    if (!msg.studentRead) {
      try {
        await markMessageReadState(msg.id, 'student');
        // Mettre à jour localement
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, studentRead: true } : m));
        // Déclencher un changement pour mettre à jour la barre latérale
        window.dispatchEvent(new Event('progress_changed'));
      } catch (e) {
        console.error("Erreur marquage lu:", e);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || guestMode) return;
    if (!subject.trim() || !content.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      const senderName = user.displayName || 'Étudiant';
      const senderEmail = user.email || '';
      
      // La fonction sendSupportMessage routera automatiquement le message vers
      // l'enseignant affecté s'il y en a un, sinon vers l'admin.
      await sendSupportMessage(
        user.uid,
        senderName,
        senderEmail,
        'student',
        'teacher', // par défaut, mais écrasé par sendSupportMessage si nécessaire
        undefined,
        subject,
        content
      );
      
      setSubject('');
      setContent('');
      
      const successMsg = profile?.assignedTeacherUid 
        ? `Message envoyé avec succès à votre enseignant référent (${profile.assignedTeacherName || 'Nom inconnu'}) !`
        : 'Message envoyé avec succès à l\'équipe de supervision (Admin) !';
      setSuccess(successMsg);
      
      await fetchMessages();
      setIsCreating(false); // Basculer vers l'affichage pour voir le message
    } catch (e: any) {
      setError("Erreur lors de l'envoi : " + (e.message || e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>Support & Contact Enseignant</h1>
          <p className={styles.subtitle}>
            Posez vos questions méthodologiques ou informatiques directement à l'équipe enseignante.
          </p>
        </header>

        {guestMode ? (
          <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '600px', margin: '4rem auto' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-warning)' }}>Mode Invité Non Connecté</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Vous devez être connecté avec un compte officiel pour pouvoir envoyer des messages à vos enseignants et suivre vos demandes d'aide.
            </p>
          </div>
        ) : (
          <div className={styles.container}>
            {/* Colonne de gauche - Liste */}
            <div className={`${styles.leftPanel} glass-card`}>
              <div className={styles.panelHeader}>
                <h3>Vos messages</h3>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={() => {
                    setIsCreating(true);
                    setActiveMessage(null);
                    setError('');
                    setSuccess('');
                  }}
                >
                  + Nouveau
                </button>
              </div>
              
              <div className={styles.messageList}>
                {messages.length === 0 ? (
                  <p className={styles.emptyList}>Aucun message envoyé pour le moment.</p>
                ) : (
                  messages.map((msg) => {
                    const isUnread = !msg.studentRead;
                    const isActive = activeMessage?.id === msg.id;
                    return (
                      <div 
                        key={msg.id}
                        className={`${styles.messageItem} ${isActive ? styles.activeItem : ''} ${isUnread ? styles.unreadItem : ''}`}
                        onClick={() => handleSelectMessage(msg)}
                      >
                        <div className={styles.itemHeader}>
                          <h4 className={styles.itemSubject}>{msg.subject}</h4>
                          {isUnread && <span className={styles.unreadBadge}>Nouveau</span>}
                        </div>
                        <p className={styles.itemExcerpt}>
                          {msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content}
                        </p>
                        <div className={styles.itemMeta}>
                          <span>Statut : {
                            msg.status === 'unread' ? 'Envoyé' : 
                            msg.status === 'read' ? 'Lu par l\'enseignant' : 'Répondu'
                          }</span>
                          <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('fr-FR') : ''}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Colonne de droite - Détail ou Création */}
            <div className={`${styles.rightPanel} glass-card`}>
              {isCreating ? (
                <div className={styles.formContainer}>
                  <h3>Nouveau message</h3>
                  {error && <div className={styles.errorBanner}>{error}</div>}
                  {success && <div className={styles.successBanner}>{success}</div>}
                  
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)'
                  }}>
                    Destinataire : <strong style={{ color: 'var(--accent-primary)' }}>
                      {profile?.assignedTeacherUid ? `Votre enseignant référent (${profile.assignedTeacherName || 'Nom inconnu'})` : "L'équipe de supervision (Admin)"}
                    </strong>
                  </div>
                  
                  <form onSubmit={handleSubmit} className={styles.form}>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label">Objet / Sujet :</label>
                      <input 
                        type="text"
                        className="form-input"
                        placeholder="Ex : Question sur l'essai clinique randomisé"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <label className="form-label">Votre message :</label>
                      <textarea 
                        className="form-input"
                        style={{ minHeight: '200px', flexGrow: 1, resize: 'vertical', fontFamily: 'inherit' }}
                        placeholder="Décrivez votre question de manière détaillée pour obtenir une réponse précise..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={isSubmitting}
                      style={{ width: '100%', padding: '0.75rem' }}
                    >
                      {isSubmitting ? 'Envoi en cours...' : 'Envoyer le message'}
                    </button>
                  </form>
                </div>
              ) : activeMessage ? (
                <div className={styles.conversation}>
                  <div className={styles.chatHeader}>
                    <h3>{activeMessage.subject}</h3>
                    <span className={styles.chatDate}>
                      Envoyé le {activeMessage.createdAt ? new Date(activeMessage.createdAt).toLocaleString('fr-FR') : ''}
                    </span>
                  </div>

                  <div className={styles.bubbleArea}>
                    {/* Message Étudiant */}
                    <div className={`${styles.bubble} ${styles.studentBubble}`}>
                      <div className={styles.bubbleMeta}>Vous</div>
                      <p className={styles.bubbleContent}>{activeMessage.content}</p>
                    </div>

                    {/* Réponse Enseignant ou Admin */}
                    {activeMessage.reply ? (
                      <div className={`${styles.bubble} ${styles.teacherBubble}`}>
                        <div className={styles.bubbleMeta}>
                          {activeMessage.recipientRole === 'admin' ? 'Administration RECIF' : 'Enseignant RECIF'} • {
                            activeMessage.repliedAt ? new Date(activeMessage.repliedAt).toLocaleString('fr-FR') : 'Date inconnue'
                          }
                        </div>
                        <p className={styles.bubbleContent}>{activeMessage.reply}</p>
                      </div>
                    ) : (
                      <div className={styles.waitingBanner}>
                        ⏳ En attente de réponse de {activeMessage.recipientRole === 'admin' ? "l'administration" : "votre enseignant référent"}...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyDetails}>
                  <p>Sélectionnez un message dans l'historique pour lire sa réponse ou créez un nouveau message.</p>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
