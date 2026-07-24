'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

import styles from './page.module.css';
import SubscriptionModal from '@/components/SubscriptionModal';

export default function Login() {
  const { user, loading, isFirebaseConfigured, signInWithGoogle, signInWithEmail, sendPasswordReset } = useAuth();
  const router = useRouter();

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isRequestAccess, setIsRequestAccess] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [requestedRole, setRequestedRole] = useState<'student' | 'teacher'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestFirstName, setRequestFirstName] = useState('');
  const [requestLastName, setRequestLastName] = useState('');
  const [requestInstitution, setRequestInstitution] = useState('');
  const [requestProfession, setRequestProfession] = useState('');
  const [requestCity, setRequestCity] = useState('');
  const [requestCountry, setRequestCountry] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestOtherText, setRequestOtherText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Veuillez saisir votre adresse e-mail.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setSuccessMsg('Un e-mail de réinitialisation a été envoyé ! Veuillez vérifier votre boîte de réception.');
    } catch (error: any) {
      console.warn("Erreur réinitialisation mot de passe:", error.code || error.message);
      let friendlyError = 'Une erreur est survenue lors de l\'envoi de l\'e-mail.';
      if (error.code === 'auth/user-not-found') {
        friendlyError = 'Aucun utilisateur trouvé avec cette adresse e-mail.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyError = 'Format d\'adresse e-mail invalide.';
      } else if (error.message) {
        friendlyError = error.message;
      }
      setErrorMsg(friendlyError);
    } finally {
      setSubmitting(false);
    }
  };

  // Redirection automatique si déjà connecté
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('guest_mode_active')) {
      localStorage.removeItem('guest_mode_active');
      window.location.reload();
      return;
    }
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Chargement du portail d'accès...</p>
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Veuillez remplir tous les champs.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      setSuccessMsg('Connexion réussie ! Redirection en cours...');
    } catch (error: any) {
      console.warn("Erreur d'authentification:", error.code || error.message);
      let friendlyError = 'Une erreur est survenue lors de l\'authentification.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        friendlyError = 'Adresse e-mail ou mot de passe incorrect.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyError = 'Format d\'adresse e-mail invalide.';
      } else if (error.code === 'auth/network-request-failed') {
        friendlyError = 'Connexion impossible : les serveurs d\'authentification sont injoignables. Veuillez vérifier votre connexion Internet.';
      } else if (error.message) {
        friendlyError = error.message;
      }
      setErrorMsg(friendlyError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!requestFirstName.trim() || !requestLastName.trim() || !requestInstitution.trim() || 
        !requestProfession.trim() || !requestCity.trim() || !requestCountry.trim() || 
        !requestEmail.trim()) {
      setErrorMsg('Veuillez remplir tous les champs obligatoires (marqués d\'un *).');
      return;
    }

    const isOther = requestProfession === 'Autre';
    if (isOther && !requestOtherText.trim()) {
      setErrorMsg(requestedRole === 'teacher' ? 'Veuillez préciser votre discipline.' : 'Veuillez préciser votre profession.');
      return;
    }

    const finalProfession = isOther ? requestOtherText.trim() : requestProfession.trim();

    setSubmitting(true);
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: requestFirstName.trim(),
          lastName: requestLastName.trim(),
          institution: requestInstitution.trim(),
          profession: finalProfession,
          city: requestCity.trim(),
          country: requestCountry.trim(),
          email: requestEmail.trim(),
          phone: requestPhone.trim(),
          requestedRole: requestedRole
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Impossible de soumettre la demande d'accès.");
      }

      setSuccessMsg('Votre demande a été enregistrée ! Consultez votre boîte e-mail pour recevoir les conditions d\'abonnement et les modalités de paiement.');
      setRequestFirstName('');
      setRequestLastName('');
      setRequestInstitution('');
      setRequestProfession('');
      setRequestCity('');
      setRequestCountry('');
      setRequestEmail('');
      setRequestPhone('');
      setRequestOtherText('');
      setTimeout(() => {
        setIsRequestAccess(false);
        setSuccessMsg('');
      }, 8000);
    } catch (error: any) {
      console.warn("Erreur soumission demande d'accès:", error.message);
      setErrorMsg(error.message || 'Impossible de soumettre la demande. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      setSuccessMsg('Connexion Google réussie ! Redirection...');
    } catch (error: any) {
      console.warn("Erreur connexion Google:", error.code || error.message);
      if (error.code === 'auth/network-request-failed') {
        setErrorMsg('Connexion impossible : les serveurs d\'authentification sont injoignables. Veuillez vérifier votre connexion Internet.');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Échec de la connexion avec Google. Veuillez réessayer.');
      }
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        
        {/* Panneau de présentation marketing de gauche */}
        <div className={styles.presentationPanel}>
          <div className={styles.presentationContent}>
            <span className={styles.presentationTag}>Plateforme Académique</span>
            <h2 className={styles.presentationTitle}>
              MÉTHODOLOGIE <span className={styles.glowText}>de recherche clinique</span>
            </h2>
            <p className={styles.presentationDesc}>
              L'outil de référence pour maîtriser la méthodologie de recherche clinique et concevoir des projets conformes aux exigences de la <strong>Loi n° 18-11 relative à la santé (Algérie)</strong>.
            </p>
            
            <div className={styles.featuresList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🎙️</div>
                <div className={styles.featureText}>
                  <h4>Tuteur Intelligent RECIF</h4>
                  <p>Interagissez par écrit ou par la voix avec un assistant IA qui cite les pages précises du manuel de référence.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>📝</div>
                <div className={styles.featureText}>
                  <h4>Générateur de Protocoles</h4>
                  <p>Rédigez des protocoles méthodologiques complets étape par étape et exportez-les en format PDF officiel.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🧠</div>
                <div className={styles.featureText}>
                  <h4>Quiz & Flashcards Interactifs</h4>
                  <p>Évaluez vos connaissances sur les biais de recherche et la puissance statistique avec des outils immersifs.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>📊</div>
                <div className={styles.featureText}>
                  <h4>Rapport Pédagogique</h4>
                  <p>Suivez votre progression d&apos;apprentissage et obtenez un bilan complet de vos compétences en méthodologie clinique.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🧮</div>
                <div className={styles.featureText}>
                  <h4>Calculateur NSN</h4>
                  <p>Évaluez le Nombre de Sujets Nécessaires pour vos études et générez automatiquement vos justifications statistiques.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>📄</div>
                <div className={styles.featureText}>
                  <h4>Rédacteur d&apos;articles STROBE</h4>
                  <p>Structurez vos articles scientifiques pour publication en suivant les recommandations de la grille internationale STROBE.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>👥</div>
                <div className={styles.featureText}>
                  <h4>Espace Superviseur</h4>
                  <p>Permettez à vos enseignants et superviseurs de suivre votre avancée et de valider vos travaux.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>💬</div>
                <div className={styles.featureText}>
                  <h4>Messagerie</h4>
                  <p>Communiquez en temps réel avec vos encadrants pour poser des questions ou solliciter une validation.</p>
                </div>
              </div>
            </div>

            <div className={styles.audienceSection}>
              <h4>Public cible</h4>
              <div className={styles.audienceTags}>
                <span>Étudiants</span>
                <span>Résidents</span>
                <span>Médecins</span>
                <span>Doctorants</span>
                <span>Chercheurs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panneau du formulaire de connexion de droite */}
        <div className={styles.formPanel}>
          <div className={styles.card}>
            <div className={styles.header}>
              <div className={styles.logo}>
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  style={{ 
                    width: '76px', 
                    height: '76px', 
                    borderRadius: '14px', 
                    objectFit: 'cover',
                    border: '2.5px solid rgba(56, 189, 248, 0.45)',
                    boxShadow: '0 0 20px rgba(56, 189, 248, 0.2)'
                  }} 
                />
                <span className={styles.logoText}>Methodo&Clinique</span>
              </div>
              <h1 className={styles.title}>
                {isForgotPassword 
                  ? 'Réinitialiser le mot de passe' 
                  : isRequestAccess 
                    ? 'Demander un Accès' 
                    : 'Connexion Utilisateur'
                }
              </h1>
              <p className={styles.subtitle}>
                {isForgotPassword
                  ? 'Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.'
                  : isRequestAccess 
                    ? 'Remplissez ce formulaire pour soumettre votre demande d\'inscription. Vous recevrez les conditions d\'abonnement par e-mail.' 
                    : 'Accédez à vos quiz, vos flashcards, échangez avec votre assistant et concevez vos protocoles cliniques.'
                }
              </p>
            </div>

            {/* Bannière d'avertissement si Firebase n'est pas configuré */}
            {!isFirebaseConfigured && (
              <div className={styles.warningBanner}>
                <h3>⚠️ Configuration Firebase requise</h3>
                <p>
                  Pour activer l'authentification et la synchronisation en temps réel, veuillez copier vos clés d'accès Firebase dans le fichier <code>.env.local</code>.
                </p>
                <p style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                  En attendant, vous pouvez continuer à utiliser l'application localement. Vos scores et protocoles seront stockés sur votre navigateur (LocalStorage).
                </p>
                <button 
                  className={styles.guestBtn}
                  onClick={() => router.push('/')}
                >
                  Continuer en mode Invité Local
                </button>
              </div>
            )}

            {isFirebaseConfigured && (
              <>
                {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}
                {successMsg && <div className={styles.successMsg}>{successMsg}</div>}

                {isForgotPassword ? (
                  // Formulaire de réinitialisation de mot de passe
                  <form className={styles.form} onSubmit={handleForgotPasswordSubmit}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="forgotEmail">Adresse E-mail</label>
                      <input
                        type="email"
                        id="forgotEmail"
                        placeholder="nom@exemple.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={submitting}>
                      {submitting ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                    </button>
                    
                    <button
                      type="button"
                      className={styles.googleBtn}
                      style={{ marginTop: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      onClick={() => {
                        setIsForgotPassword(false);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      disabled={submitting}
                    >
                      Retour à la connexion
                    </button>
                  </form>
                ) : isRequestAccess ? (
                  // Formulaire de demande d'accès
                  <form className={styles.form} onSubmit={handleRequestAccessSubmit}>
                    <div style={{ marginBottom: '1.25rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}>
                      Type d'accès demandé : {requestedRole === 'student' ? '🎓 Accès Étudiant' : '👨‍🏫 Accès Enseignant'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className={styles.inputGroup}>
                        <label htmlFor="requestFirstName">Prénom <span style={{color:'#e11d48'}}>*</span></label>
                        <input
                          type="text"
                          id="requestFirstName"
                          placeholder="Ahmed"
                          value={requestFirstName}
                          onChange={(e) => setRequestFirstName(e.target.value)}
                          required
                          disabled={submitting}
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label htmlFor="requestLastName">Nom <span style={{color:'#e11d48'}}>*</span></label>
                        <input
                          type="text"
                          id="requestLastName"
                          placeholder="Benali"
                          value={requestLastName}
                          onChange={(e) => setRequestLastName(e.target.value)}
                          required
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label htmlFor="requestInstitution">Institution / Établissement <span style={{color:'#e11d48'}}>*</span></label>
                      <input
                        type="text"
                        id="requestInstitution"
                        placeholder="Université, CHU, Centre de recherche..."
                        value={requestInstitution}
                        onChange={(e) => setRequestInstitution(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>

                     <div className={styles.inputGroup}>
                       <label htmlFor="requestProfession">
                         {requestedRole === 'teacher' ? 'Discipline enseignée' : 'Profession'} <span style={{color:'#e11d48'}}>*</span>
                       </label>
                       <select
                         id="requestProfession"
                         value={requestProfession}
                         onChange={(e) => {
                           setRequestProfession(e.target.value);
                           setRequestOtherText(''); // Réinitialiser à chaque changement
                         }}
                         required
                         disabled={submitting}
                         style={{
                           width: '100%',
                           background: 'rgba(255, 255, 255, 0.05)',
                           border: '1px solid rgba(255,255,255,0.1)',
                           borderRadius: '8px',
                           padding: '0.7rem 0.85rem',
                           color: requestProfession ? 'var(--text-primary)' : 'var(--text-muted)',
                           fontSize: '0.9rem',
                           outline: 'none'
                         }}
                       >
                         {requestedRole === 'teacher' ? (
                           <>
                             <option value="" disabled style={{ background: '#1a1a2e', color: '#94a3b8' }}>Sélectionnez votre discipline</option>
                             <option value="Médecine Clinique" style={{ background: '#1a1a2e' }}>Médecine Clinique</option>
                             <option value="Épidémiologie / Santé Publique" style={{ background: '#1a1a2e' }}>Épidémiologie / Santé Publique</option>
                             <option value="Biostatistique / Informatique Médicale" style={{ background: '#1a1a2e' }}>Biostatistique / Informatique Médicale</option>
                             <option value="Pharmacologie / Toxicologie" style={{ background: '#1a1a2e' }}>Pharmacologie / Toxicologie</option>
                             <option value="Chirurgie / Spécialités chirurgicales" style={{ background: '#1a1a2e' }}>Chirurgie / Spécialités chirurgicales</option>
                             <option value="Biologie Médicale / Génétique" style={{ background: '#1a1a2e' }}>Biologie Médicale / Génétique</option>
                             <option value="Sciences Infirmières / Paramédical" style={{ background: '#1a1a2e' }}>Sciences Infirmières / Paramédical</option>
                             <option value="Éthique Médicale / Droit de la Santé" style={{ background: '#1a1a2e' }}>Éthique Médicale / Droit de la Santé</option>
                             <option value="Autre" style={{ background: '#1a1a2e' }}>Autre (préciser...)</option>
                           </>
                         ) : (
                           <>
                             <option value="" disabled style={{ background: '#1a1a2e', color: '#94a3b8' }}>Sélectionnez votre profession</option>
                             <option value="Médecin" style={{ background: '#1a1a2e' }}>Médecin</option>
                             <option value="Résident / Interne" style={{ background: '#1a1a2e' }}>Résident / Interne</option>
                             <option value="Infirmier(e)" style={{ background: '#1a1a2e' }}>Infirmier(e)</option>
                             <option value="Pharmacien(ne)" style={{ background: '#1a1a2e' }}>Pharmacien(ne)</option>
                             <option value="Chercheur en santé" style={{ background: '#1a1a2e' }}>Chercheur en santé</option>
                             <option value="Doctorant" style={{ background: '#1a1a2e' }}>Doctorant</option>
                             <option value="Étudiant en santé" style={{ background: '#1a1a2e' }}>Étudiant en santé</option>
                             <option value="Manager de santé" style={{ background: '#1a1a2e' }}>Manager de santé</option>
                             <option value="Nutritionniste" style={{ background: '#1a1a2e' }}>Nutritionniste</option>
                             <option value="Autre" style={{ background: '#1a1a2e' }}>Autre (préciser...)</option>
                           </>
                         )}
                       </select>
                     </div>

                     {requestProfession === 'Autre' && (
                       <div className={styles.inputGroup} style={{ marginTop: '0.2rem', marginBottom: '1.25rem' }}>
                         <label htmlFor="requestOtherText">
                           {requestedRole === 'teacher' ? 'Précisez votre discipline' : 'Précisez votre profession'} <span style={{color:'#e11d48'}}>*</span>
                         </label>
                         <input
                           type="text"
                           id="requestOtherText"
                           placeholder={requestedRole === 'teacher' ? "Ex: Cardiologie, Gynécologie, Oncologie..." : "Ex: Kinésithérapeute, Sage-femme..."}
                           value={requestOtherText}
                           onChange={(e) => setRequestOtherText(e.target.value)}
                           required
                           disabled={submitting}
                         />
                       </div>
                     )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className={styles.inputGroup}>
                        <label htmlFor="requestCity">Ville <span style={{color:'#e11d48'}}>*</span></label>
                        <input
                          type="text"
                          id="requestCity"
                          placeholder="Alger"
                          value={requestCity}
                          onChange={(e) => setRequestCity(e.target.value)}
                          required
                          disabled={submitting}
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label htmlFor="requestCountry">Pays <span style={{color:'#e11d48'}}>*</span></label>
                        <input
                          type="text"
                          id="requestCountry"
                          placeholder="Algérie"
                          value={requestCountry}
                          onChange={(e) => setRequestCountry(e.target.value)}
                          required
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label htmlFor="requestEmail">Adresse E-mail <span style={{color:'#e11d48'}}>*</span></label>
                      <input
                        type="email"
                        id="requestEmail"
                        placeholder="ahmed.benali@univ.dz"
                        value={requestEmail}
                        onChange={(e) => setRequestEmail(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label htmlFor="requestPhone">Téléphone <span style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>(facultatif)</span></label>
                      <input
                        type="tel"
                        id="requestPhone"
                        placeholder="+213 555 123 456"
                        value={requestPhone}
                        onChange={(e) => setRequestPhone(e.target.value)}
                        disabled={submitting}
                      />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={submitting}>
                      {submitting ? 'Envoi en cours...' : 'Envoyer ma demande d\'accès'}
                    </button>
                  </form>
                ) : (
                  // Formulaire de connexion classique
                  <form className={styles.form} onSubmit={handleEmailSubmit}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="email">Adresse E-mail</label>
                      <input
                        type="email"
                        id="email"
                        placeholder="nom@exemple.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <label htmlFor="password" style={{ marginBottom: 0 }}>Mot de passe</label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setIsRequestAccess(false);
                            setErrorMsg('');
                            setSuccessMsg('');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: '500'
                          }}
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>
                      <input
                        type="password"
                        id="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={submitting}>
                      {submitting ? 'Connexion...' : 'Se connecter'}
                    </button>
                  </form>
                )}

                {!isRequestAccess && !isForgotPassword && (
                  <>
                    <div className={styles.divider}>
                      <span>ou</span>
                    </div>

                    <button 
                      type="button" 
                      className={styles.googleBtn} 
                      onClick={handleGoogleSubmit}
                      disabled={submitting}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '10px' }}>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                      </svg>
                      Se connecter avec Google
                    </button>


                  </>
                )}

                {!isForgotPassword && (
                  <div className={styles.toggleMode}>
                    {isRequestAccess ? (
                      <p>
                        Vous avez déjà un compte ?{' '}
                        <button 
                          type="button" 
                          className={styles.toggleLinkBtn} 
                          onClick={() => {
                            setIsRequestAccess(false);
                            setIsForgotPassword(false);
                          }} 
                          disabled={submitting}
                        >
                          Se connecter
                        </button>
                      </p>
                    ) : (
                      <div className={styles.requestAccessCTA}>
                        <p>Nouveau sur la plateforme ? Demandez votre accès :</p>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', width: '100%' }}>
                          <button 
                            type="button" 
                            className={styles.requestAccessBtn}
                            onClick={() => {
                              setIsRequestAccess(true);
                              setIsForgotPassword(false);
                              setRequestedRole('student');
                              setRequestProfession('');
                              setRequestOtherText('');
                            }} 
                            disabled={submitting}
                            style={{ flex: 1, padding: '0.7rem 0.5rem', fontSize: '0.85rem' }}
                          >
                            🎓 Accès Étudiant
                          </button>
                          <button 
                            type="button" 
                            className={styles.requestAccessBtn}
                            onClick={() => {
                              setIsRequestAccess(true);
                              setIsForgotPassword(false);
                              setRequestedRole('teacher');
                              setRequestProfession('');
                              setRequestOtherText('');
                            }} 
                            disabled={submitting}
                            style={{ flex: 1, padding: '0.7rem 0.5rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
                          >
                            👨‍🏫 Accès Enseignant
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSubscriptionModal(true)}
                          style={{
                            marginTop: '0.8rem',
                            width: '100%',
                            background: 'rgba(13, 148, 136, 0.12)',
                            color: '#2dd4bf',
                            border: '1px dashed rgba(13, 148, 136, 0.4)',
                            padding: '0.55rem',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          💳 Découvrir les Formules & Tarifs (Pro, Ultra, Institution)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </div>
  );
}