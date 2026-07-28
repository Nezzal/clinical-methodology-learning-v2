'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

import styles from './page.module.css';
import SubscriptionModal from '@/components/SubscriptionModal';
import { sendSupportMessage } from '@/utils/firestore';
import { verifyLicense } from '@/utils/license';
import { compressAndSanitizeImage } from '@/utils/image-utils';
import { APP_VERSION, COMPANY_NIF } from '@/utils/constants';
import logoPedagogiafrica from '../../../public/logo_pedagogiafrica.png';

export default function Login() {
  const { user, loading, isFirebaseConfigured, signInWithGoogle, signInWithEmail, sendPasswordReset } = useAuth();
  const router = useRouter();

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isRequestAccess, setIsRequestAccess] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isLicenseMode, setIsLicenseMode] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [requestedRole, setRequestedRole] = useState<'student' | 'teacher'>('student');
  const [requestedTier, setRequestedTier] = useState<string>('découverte');

  const handleSelectPlanFromModal = (tier: 'découverte' | 'pro' | 'expert' | 'ultra' | 'institution', role: 'student' | 'teacher') => {
    setRequestedRole(role);
    setRequestedTier(tier);
    setIsRequestAccess(true);
    setIsForgotPassword(false);
    setShowSubscriptionModal(false);
    setErrorMsg('');
    setSuccessMsg('');
    setSubmittedPaidTier(null);
    setReceiptSubmittedSuccess(false);
    setReceiptTxIdInput('');
  };
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

  // Reçu BaridiMob / PayPal / Western Union pour accès direct payant
  const [submittedPaidTier, setSubmittedPaidTier] = useState<{ email: string; tier: string; country: string } | null>(null);
  const [receiptTxIdInput, setReceiptTxIdInput] = useState('');
  const [receiptImageDataInput, setReceiptImageDataInput] = useState<string | null>(null);
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
  const [receiptSubmittedSuccess, setReceiptSubmittedSuccess] = useState(false);

  const isAlgeriaCountry = (c: string) => {
    if (!c) return true;
    const cleanC = c.toLowerCase().trim();
    return cleanC === 'algérie' || cleanC === 'algerie' || cleanC === 'dz' || cleanC === 'algeria';
  };

  const handleDirectReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptImageDataInput(null);
      return;
    }
    try {
      const sanitized = await compressAndSanitizeImage(file);
      setReceiptImageDataInput(sanitized);
    } catch (err: any) {
      alert(err.message || "Erreur de chargement de l'image.");
      setReceiptImageDataInput(null);
    }
  };

  const handleDirectReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedPaidTier?.email || !receiptTxIdInput.trim()) return;

    setIsSubmittingReceipt(true);
    try {
      const res = await fetch('/api/access-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submittedPaidTier.email,
          receiptTxId: receiptTxIdInput.trim(),
          receiptImageData: receiptImageDataInput || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer le reçu.");

      setReceiptSubmittedSuccess(true);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la transmission du reçu.");
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

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

  const handleLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const result = await verifyLicense(licenseKeyInput);
      if (!result.isValid || !result.data) {
        setErrorMsg(result.error || "Clé de licence invalide.");
        setSubmitting(false);
        return;
      }

      // Enregistrer la licence localement
      localStorage.setItem('recif_offline_license', JSON.stringify({
        key: licenseKeyInput.trim(),
        data: result.data
      }));

      setSuccessMsg("Licence validée avec succès ! Redirection en cours...");
      
      // Dispatcher l'événement pour signaler que l'auth a changé
      window.dispatchEvent(new Event('progress_changed'));

      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      setErrorMsg("Une erreur est survenue : " + (err.message || String(err)));
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
        !requestEmail.trim() || !requestPhone.trim()) {
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
          requestedRole: requestedRole,
          requestedTier: requestedTier
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible de soumettre la demande d'accès.");
      }

      if (data.credentials) {
        setEmail(data.credentials.email);
        setPassword(data.credentials.tempPassword);
        setSuccessMsg(`🟢 Votre accès Test Découverte (3 jours) est activé !\n\n🔑 Vos identifiants d'accès :\n• E-mail : ${data.credentials.email}\n• Mot de passe : ${data.credentials.tempPassword}\n\nUn e-mail de confirmation vous a également été envoyé.`);
      } else if (requestedTier === 'découverte') {
        setEmail(requestEmail.trim());
        setSubmittedPaidTier(null);
        setSuccessMsg(`🟢 Votre accès Test Découverte (3 jours) est actif !\nVous pouvez vous connecter directement avec votre e-mail ${requestEmail.trim()} et votre mot de passe habituel.`);
      } else if (requestedTier === 'institution') {
        setSubmittedPaidTier(null);
        setSuccessMsg(`🟢 Votre demande de devis pour la Formule INSTITUTION a bien été enregistrée !\n\nUn e-mail de confirmation vous a été envoyé. Un administrateur prendra directement contact avec vous par e-mail ou téléphone afin d'étudier vos besoins et vous transmettre une proposition sur-mesure.`);
      } else {
        const isDz = isAlgeriaCountry(requestCountry.trim());
        setSubmittedPaidTier({ email: requestEmail.trim(), tier: requestedTier, country: requestCountry.trim() });
        setSuccessMsg(`Demande d'accès (${requestedTier.toUpperCase()}) enregistrée ! Les instructions de règlement (${isDz ? 'BaridiMob' : 'PayPal / Western Union'}) sont affichées ci-dessous et envoyées par e-mail.`);
      }

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
      }, 12000);
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.95)', 
                padding: '6px 14px', 
                borderRadius: '12px', 
                display: 'inline-flex', 
                alignItems: 'center',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), 0 0 20px rgba(56, 189, 248, 0.2)'
              }}>
                <img 
                  src={logoPedagogiafrica.src} 
                  alt="PedagogiAfrica" 
                  style={{ 
                    height: '38px', 
                    width: 'auto', 
                    objectFit: 'contain'
                  }} 
                />
              </div>
              <div className={styles.presentationTag}>
                <span className={styles.dotNeon}></span> PLATEFORME ACADÉMIQUE
              </div>
            </div>
            
            <h2 className={styles.presentationTitle}>
              Méthodologie de <span className={styles.glowText}>Recherche Clinique</span>
            </h2>

            <div className={styles.complianceBadge}>
              📜 Conforme Loi n° 18-11 Santé (Algérie)
            </div>

            {/* Grille 2x2 épurée & ultra-attractives des fonctionnalités principales */}
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureCardHeader}>
                  <div className={styles.featureIcon}>🤖</div>
                  <h4>Tuteur IA RECIF</h4>
                </div>
                <p>Assistant formé sur le manuel RECIF avec citations précises.</p>
              </div>

              <div className={styles.featureCard}>
                <div className={styles.featureCardHeader}>
                  <div className={styles.featureIcon}>📑</div>
                  <h4>Générateur de Protocoles</h4>
                </div>
                <p>Rédaction méthodologique étape par étape & export PDF officiel.</p>
              </div>

              <div className={styles.featureCard}>
                <div className={styles.featureCardHeader}>
                  <div className={styles.featureIcon}>📊</div>
                  <h4>Calculateur NSN & Quiz</h4>
                </div>
                <p>Taille d&apos;échantillon, puissance statistique & maîtrise des biais.</p>
              </div>

              <div className={styles.featureCard}>
                <div className={styles.featureCardHeader}>
                  <div className={styles.featureIcon}>✍️</div>
                  <h4>Rédacteur STROBE</h4>
                </div>
                <p>Structure d&apos;articles scientifiques conformes à la grille STROBE.</p>
              </div>
            </div>

            <div className={styles.audienceSection}>
              <h4>Public cible</h4>
              <div className={styles.audienceTags}>
                <span>🎓 Résidents</span>
                <span>🩺 Médecins</span>
                <span>🔬 Chercheurs</span>
                <span>👨‍🏫 Enseignants</span>
                <span>📚 Étudiants</span>
              </div>
            </div>

            <div className={styles.presentationFooter}>
              <span>Version v{APP_VERSION}</span>
              <span>NIF : {COMPANY_NIF}</span>
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

              {/* BLOC NOUVEAU SUR LA PLATEFORME (PLACÉ EN HAUT ET EN COULEURS ATTRAYANTES) */}
              {!isRequestAccess && !isForgotPassword && (
                <div className={styles.requestAccessCTA}>
                  <div className={styles.ctaBadge}>✨ DECOUVRIR LES FORMULES</div>
                  <h3 className={styles.ctaTitle}>Nouveau sur la plateforme ?</h3>
                  <p className={styles.ctaSubtitle}>
                    Découvrez nos formules d'abonnement (Découverte 3j gratuit, Pro, Ultra, Institution) et demandez votre accès instantanément :
                  </p>
                  <button
                    type="button"
                    className={styles.ctaBtn}
                    onClick={() => setShowSubscriptionModal(true)}
                  >
                    ✨ Voir les Formules & Demander un Accès ➔
                  </button>
                </div>
              )}

              {!isRequestAccess && !isForgotPassword && (
                <div className={styles.divider} style={{ margin: '1.25rem 0 1rem 0' }}>
                  <span>Déjà un compte ? Connexion ci-dessous</span>
                </div>
              )}

              <h1 className={styles.title}>
                {isForgotPassword 
                  ? 'Réinitialiser le mot de passe' 
                  : isRequestAccess 
                    ? (requestedTier === 'découverte'
                        ? 'Demander un Accès (Offre Test 3j)'
                        : requestedTier === 'pro'
                          ? 'Demander un Accès (Offre PRO)'
                          : requestedTier === 'ultra'
                            ? 'Demander un Accès (Offre ULTRA Encadreur)'
                            : 'Demande de Devis (Formule INSTITUTION)')
                    : 'Connexion Utilisateur'
                }
              </h1>
              <p className={styles.subtitle}>
                {isForgotPassword
                  ? 'Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.'
                  : isRequestAccess 
                    ? ((requestedTier === 'ultra' || requestedTier === 'institution')
                        ? 'Un e-mail de confirmation vous sera envoyé. L\'administrateur prendra directement contact avec vous par e-mail pour étudier vos besoins et vous transmettre les modalités d\'accès sur-mesure.'
                        : 'Remplissez ce formulaire pour recevoir vos identifiants d\'essai par e-mail ainsi que les coordonnées du RIP pour le virement.') 
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

                {/* Encadré d'instructions BaridiMob / PayPal / Western Union et soumission de reçu */}
                {submittedPaidTier && (
                  <div style={{
                    marginTop: '1rem',
                    marginBottom: '1rem',
                    background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.15), rgba(30, 41, 59, 0.8))',
                    border: '1px solid rgba(45, 212, 191, 0.4)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    textAlign: 'left'
                  }}>
                    {isAlgeriaCountry(submittedPaidTier.country) ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#2dd4bf', fontWeight: 700, fontSize: '0.95rem' }}>
                          <span>📲</span>
                          <span>Instructions de Paiement BaridiMob ({submittedPaidTier.tier.toUpperCase()})</span>
                        </div>
                        
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '12px', lineHeight: 1.5 }}>
                          Pour activer votre abonnement <strong>{submittedPaidTier.tier.toUpperCase()}</strong> et bénéficier de vos jours bonus (+7j Pro / +14j Ultra), effectuez votre virement vers le RIP BaridiMob ci-dessous :
                        </div>

                        <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px dashed #0d9488', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontFamily: 'monospace', fontSize: '0.88rem', color: '#2dd4bf' }}>
                          <div><strong>RIP BaridiMob :</strong> 00799999000041210947</div>
                          <div><strong>Titulaire :</strong> Professeur Nezzal Abdelmalek</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}>
                          <span>🌍</span>
                          <span>Instructions de Paiement International ({submittedPaidTier.tier.toUpperCase()})</span>
                        </div>
                        
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '12px', lineHeight: 1.5 }}>
                          Pour activer votre abonnement <strong>{submittedPaidTier.tier.toUpperCase()}</strong> depuis <strong>{submittedPaidTier.country}</strong>, effectuez votre règlement via <strong>PayPal</strong> ou <strong>Western Union</strong> ci-dessous :
                        </div>

                        <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px dashed #0284c7', padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.86rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                          <div style={{ marginBottom: '6px', color: '#38bdf8' }}>
                            <strong>💳 Compte PayPal :</strong> <span style={{ fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8', fontWeight: 'bold' }}>nezzal.abdelmalek@gmail.com</span>
                          </div>
                          <div style={{ color: '#fbbf24' }}>
                            <strong>💸 Western Union :</strong>
                          </div>
                          <div style={{ paddingLeft: '12px', fontSize: '0.83rem', color: '#cbd5e1' }}>
                            • <strong>Nom du Bénéficiaire :</strong> Nezzal Hanane Hayette<br />
                            • <strong>Destination :</strong> Quebec Brossard, Canada
                          </div>
                        </div>
                      </>
                    )}

                    {receiptSubmittedSuccess ? (
                      <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '10px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600, textAlign: 'center' }}>
                        ✓ Justificatif N° {receiptTxIdInput} transmis à l'administrateur ! Votre compte sera activé sous 24h.
                      </div>
                    ) : (
                      <form onSubmit={handleDirectReceiptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            {isAlgeriaCountry(submittedPaidTier.country)
                              ? '1. N° ou Référence du reçu BaridiMob *'
                              : '1. Référence PayPal ou MTCN Western Union *'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={isAlgeriaCountry(submittedPaidTier.country) ? "Ex : N° de virement BaridiMob..." : "Ex : Réf PayPal / MTCN Western Union..."}
                            value={receiptTxIdInput}
                            onChange={e => setReceiptTxIdInput(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(15,23,42,0.9)', color: 'white', fontSize: '0.85rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            2. Photo du reçu de paiement (Optionnel / Recommandé)
                          </label>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: receiptImageDataInput ? '1px solid #10b981' : '1px dashed rgba(56, 189, 248, 0.4)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '1.2rem' }}>📷</span>
                              <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: receiptImageDataInput ? '#34d399' : '#e2e8f0' }}>
                                  {receiptImageDataInput ? '✓ Photo du reçu jointe avec succès' : 'Cliquez ici pour joindre la photo du reçu'}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                  Formats acceptés : JPG, PNG, WebP
                                </div>
                              </div>
                            </div>
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/webp"
                              onChange={handleDirectReceiptFileChange}
                              style={{ display: 'none' }}
                            />
                            <span style={{
                              background: receiptImageDataInput ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                              color: receiptImageDataInput ? '#34d399' : '#38bdf8',
                              border: receiptImageDataInput ? '1px solid #10b981' : '1px solid #38bdf8',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}>
                              {receiptImageDataInput ? 'Modifier la photo' : 'Parcourir...'}
                            </span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingReceipt}
                          style={{
                            width: '100%',
                            padding: '11px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            marginTop: '4px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          {isSubmittingReceipt ? 'Transmission en cours...' : '📤 Envoyer le justificatif et la photo'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

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
                    <div style={{ marginBottom: '1.25rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(13, 148, 136, 0.12)', border: '1px solid rgba(13, 148, 136, 0.3)', color: '#2dd4bf', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}>
                      {requestedTier === 'découverte' && '🟢 Formule Sélectionnée : Découverte (3 jours d\'essai gratuit)'}
                      {requestedTier === 'pro' && '🔷 Formule Sélectionnée : PRO (Internes, Résidents & Doctorants)'}
                      {requestedTier === 'ultra' && '👑 Formule Sélectionnée : ULTRA (Enseignants & Encadreurs)'}
                      {requestedTier === 'institution' && '🏛️ Formule Sélectionnée : INSTITUTION (Facultés, Hôpitaux, Labos de recherche & Entreprises)'}
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
                        <label htmlFor="requestCountry">Pays / Zone de Résidence <span style={{color:'#e11d48'}}>*</span></label>
                        <select
                          id="requestCountry"
                          value={requestCountry}
                          onChange={(e) => setRequestCountry(e.target.value)}
                          required
                          disabled={submitting}
                          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.65rem', borderRadius: '8px' }}
                        >
                          <option value="" disabled style={{ background: '#1a1a2e' }}>-- Sélectionnez votre pays --</option>
                          <optgroup label="🇩🇿 Algérie" style={{ background: '#1a1a2e', color: '#38bdf8' }}>
                            <option value="Algérie" style={{ background: '#1a1a2e' }}>🇩🇿 Algérie</option>
                          </optgroup>
                          <optgroup label="🌍 Zone Afrique (Hors Algérie)" style={{ background: '#1a1a2e', color: '#2dd4bf' }}>
                            <option value="Côte d'Ivoire" style={{ background: '#1a1a2e' }}>🇨🇮 Côte d'Ivoire</option>
                            <option value="Sénégal" style={{ background: '#1a1a2e' }}>🇸🇳 Sénégal</option>
                            <option value="Cameroun" style={{ background: '#1a1a2e' }}>🇨🇲 Cameroun</option>
                            <option value="Mali" style={{ background: '#1a1a2e' }}>🇲🇱 Mali</option>
                            <option value="Gabon" style={{ background: '#1a1a2e' }}>🇬🇦 Gabon</option>
                            <option value="Maroc" style={{ background: '#1a1a2e' }}>🇲🇦 Maroc</option>
                            <option value="Tunisie" style={{ background: '#1a1a2e' }}>🇹🇳 Tunisie</option>
                            <option value="Guinée" style={{ background: '#1a1a2e' }}>🇬🇳 Guinée</option>
                            <option value="Bénin" style={{ background: '#1a1a2e' }}>🇧🇯 Bénin</option>
                            <option value="Togo" style={{ background: '#1a1a2e' }}>🇹🇬 Togo</option>
                            <option value="Congo RDC" style={{ background: '#1a1a2e' }}>🇨🇩 Congo (RDC)</option>
                            <option value="Congo Brazzaville" style={{ background: '#1a1a2e' }}>🇨🇬 Congo (Brazzaville)</option>
                            <option value="Burkina Faso" style={{ background: '#1a1a2e' }}>🇧🇫 Burkina Faso</option>
                            <option value="Niger" style={{ background: '#1a1a2e' }}>🇳🇪 Niger</option>
                            <option value="Tchad" style={{ background: '#1a1a2e' }}>🇹🇩 Tchad</option>
                            <option value="Mauritanie" style={{ background: '#1a1a2e' }}>🇲🇷 Mauritanie</option>
                            <option value="Autre Afrique" style={{ background: '#1a1a2e' }}>🌍 Autre pays d'Afrique</option>
                          </optgroup>
                          <optgroup label="🇪🇺🇨🇦 Europe & Occident" style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                            <option value="France" style={{ background: '#1a1a2e' }}>🇫🇷 France</option>
                            <option value="Belgique" style={{ background: '#1a1a2e' }}>🇧🇪 Belgique</option>
                            <option value="Suisse" style={{ background: '#1a1a2e' }}>🇨🇭 Suisse</option>
                            <option value="Canada" style={{ background: '#1a1a2e' }}>🇨🇦 Canada</option>
                            <option value="Luxembourg" style={{ background: '#1a1a2e' }}>🇱🇺 Luxembourg</option>
                            <option value="Autre Occident" style={{ background: '#1a1a2e' }}>🌐 Autre pays (Europe / Occident)</option>
                          </optgroup>
                        </select>
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
                      <label htmlFor="requestPhone">Téléphone <span style={{color:'#e11d48'}}>*</span></label>
                      <input
                        type="tel"
                        id="requestPhone"
                        placeholder="+213 555 123 456"
                        value={requestPhone}
                        onChange={(e) => setRequestPhone(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={submitting}>
                      {submitting ? 'Envoi en cours...' : 'Envoyer ma demande d\'accès'}
                    </button>
                  </form>
                ) : isLicenseMode ? (
                  // Formulaire de validation de licence hors-ligne
                  <form className={styles.form} onSubmit={handleLicenseSubmit}>
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>
                      🔑 Activation de la Licence Hors-ligne
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.5', textAlign: 'center' }}>
                      Collez ci-dessous le code de licence fourni lors de l'achat de la version exécutable hors-ligne.
                    </p>
                    
                    <div className={styles.inputGroup}>
                      <label htmlFor="licenseKey">Code de Licence Hors-ligne</label>
                      <textarea
                        id="licenseKey"
                        placeholder="Collez votre code de licence ici..."
                        value={licenseKeyInput}
                        onChange={(e) => setLicenseKeyInput(e.target.value)}
                        required
                        disabled={submitting}
                        rows={6}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-glass)',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={submitting}>
                      {submitting ? 'Vérification...' : '⚡ Activer l\'Application'}
                    </button>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        className={styles.toggleLinkBtn}
                        onClick={() => {
                          setIsLicenseMode(false);
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        ← Retour à la connexion en ligne
                      </button>
                    </div>
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

                    <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsLicenseMode(true);
                          setIsRequestAccess(false);
                          setIsForgotPassword(false);
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          textDecoration: 'underline'
                        }}
                      >
                        🔑 Activer la version Hors-ligne avec une licence
                      </button>
                    </div>
                  </>
                )}

                {!isForgotPassword && isRequestAccess && (
                  <div className={styles.toggleMode}>
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
        onSelectPlan={handleSelectPlanFromModal}
      />
    </div>
  );
}