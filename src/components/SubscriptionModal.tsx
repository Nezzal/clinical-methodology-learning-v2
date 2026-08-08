'use client';

import React, { useState } from 'react';
import styles from './SubscriptionModal.module.css';
import { compressAndSanitizeImage } from '@/utils/image-utils';
import PayPalCheckoutButton from './PayPalCheckoutButton';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (tier: 'découverte' | 'pro' | 'expert' | 'ultra' | 'institution', role: 'student' | 'teacher') => void;
}

export default function SubscriptionModal({ isOpen, onClose, onSelectPlan }: SubscriptionModalProps) {
  const [residence, setResidence] = useState<'dz' | 'africa' | 'western' | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'1m' | '3m' | '6m' | '12m'>('1m');
  const [selectedTier, setSelectedTier] = useState<'pro' | 'expert' | 'ultra'>('pro');
  const [copiedRip, setCopiedRip] = useState(false);
  const [contactMode, setContactMode] = useState<null | 'ultra' | 'institution'>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', studentCount: '' });
  const [submittedMessage, setSubmittedMessage] = useState(false);

  // Transmission Reçu BaridiMob
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptTxId, setReceiptTxId] = useState('');
  const [receiptImageData, setReceiptImageData] = useState<string | null>(null);
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopyRip = () => {
    navigator.clipboard.writeText(residence === 'dz' ? 'BaridiMob (RIP): 00799999000041210947 - Methodo-Clinique' : 'IBAN: XXXXXXXXXXXXXXXXXXXXXXX - SWIFT: XXXXXXX - Methodo-Clinique');
    setCopiedRip(true);
    setTimeout(() => setCopiedRip(false), 2500);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedMessage(true);
    setTimeout(() => {
      setSubmittedMessage(false);
      setContactMode(null);
    }, 3000);
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptImageData(null);
      return;
    }
    try {
      const sanitized = await compressAndSanitizeImage(file);
      setReceiptImageData(sanitized);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Impossible de lire le fichier image.";
      alert(errMsg);
      setReceiptImageData(null);
    }
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptEmail.trim() || !receiptTxId.trim()) return;

    setIsSubmittingReceipt(true);
    try {
      const res = await fetch('/api/access-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: receiptEmail.trim(),
          receiptTxId: receiptTxId.trim(),
          receiptImageData: receiptImageData || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer le reçu.");

      setReceiptSuccess(true);
      setTimeout(() => {
        setReceiptSuccess(false);
        setReceiptTxId('');
        setReceiptEmail('');
        setReceiptImageData(null);
      }, 4000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erreur lors de la transmission du reçu.";
      alert(errMsg);
    } finally {
      setIsSubmittingReceipt(false);
    }
  };


  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <span>✨</span>
            <span>Abonnements & Formules Methodo-Clinique</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className={styles.modalBody}>
          {/* ÉTAPE 1 : CHOIX OBLIGATOIRE DE LA ZONE RÉGIONALE (EN GRAND) */}
          {residence === null ? (
            <div className={styles.zoneStepContainer}>
              <h3 className={styles.zoneStepTitle}>Étape 1 : Choisissez votre Zone Régionale de Résidence</h3>
              <p className={styles.zoneStepSubtitle}>
                Sélectionnez votre zone géographique pour afficher les tarifs dans votre monnaie locale ainsi que les moyens de paiement adaptés.
              </p>

              <div className={styles.zoneStepGrid}>
                {/* Carte Zone 1 : Algérie */}
                <div className={styles.zoneCard} onClick={() => setResidence('dz')}>
                  <div className={styles.zoneCardIcon}>🇩🇿</div>
                  <div className={styles.zoneCardTitle}>Algérie</div>
                  <div className={styles.zoneCardSubtitle}>Dinars Algériens (DZD / DA)</div>
                  <div className={styles.zoneCardDesc}>
                    Tarifs locaux adaptés aux étudiants, résidents et enseignants en Algérie. Règlement direct par BaridiMob (RIP).
                  </div>
                  <button className={styles.zoneCardBtn}>
                    Sélectionner la Zone Algérie ➔
                  </button>
                </div>

                {/* Carte Zone 2 : Afrique Hors Algérie */}
                <div className={styles.zoneCard} onClick={() => setResidence('africa')}>
                  <div className={styles.zoneCardIcon}>🌍</div>
                  <div className={styles.zoneCardTitle}>Afrique (Hors Algérie)</div>
                  <div className={styles.zoneCardSubtitle}>Euros (€) & Francs CFA (FCFA)</div>
                  <div className={styles.zoneCardDesc}>
                    Tarifs préférentiels Zone Afrique Subsaharienne et Maghreb. Règlement par PayPal, Western Union & Carte bancaire.
                  </div>
                  <button className={styles.zoneCardBtn} style={{ background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' }}>
                    Sélectionner la Zone Afrique ➔
                  </button>
                </div>

                {/* Carte Zone 3 : Europe & Occident */}
                <div className={styles.zoneCard} onClick={() => setResidence('western')}>
                  <div className={styles.zoneCardIcon}>🇪🇺🇨🇦</div>
                  <div className={styles.zoneCardTitle}>Europe & Occident</div>
                  <div className={styles.zoneCardSubtitle}>Euros (€), Dollars ($ USD / CAD)</div>
                  <div className={styles.zoneCardDesc}>
                    France, Belgique, Suisse, Canada... Virement SEPA / SWIFT, Carte bancaire internationale, PayPal ou Western Union.
                  </div>
                  <button className={styles.zoneCardBtn} style={{ background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' }}>
                    Sélectionner Zone Occident ➔
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Bannière de rappel de la zone sélectionnée */}
              <div className={styles.selectedZoneBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>
                    {residence === 'dz' ? '🇩🇿' : residence === 'africa' ? '🌍' : '🇪🇺🇨🇦'}
                  </span>
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', display: 'block' }}>
                      Zone Sélectionnée : {residence === 'dz' ? 'Algérie (DZD)' : residence === 'africa' ? 'Afrique (EUR € / FCFA)' : 'Europe & Occident (€ / $ / CAD)'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Les tarifs ci-dessous sont calculés spécialement pour votre zone régionale.
                    </span>
                  </div>
                </div>
                <button className={styles.changeZoneBtn} onClick={() => setResidence(null)}>
                  🔄 Changer de Zone
                </button>
              </div>

              {/* Durées d'abonnement */}
          <div className={styles.durationSelector}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginRight: '0.5rem' }}>Durée souhaitée :</span>
            {(['1m', '3m', '6m', '12m'] as const).map((dur) => (
              <button
                key={dur}
                className={`${styles.durationBtn} ${selectedDuration === dur ? styles.durationBtnActive : ''}`}
                onClick={() => setSelectedDuration(dur)}
              >
                {dur === '1m' && '1 Mois'}
                {dur === '3m' && '3 Mois'}
                {dur === '6m' && '6 Mois'}
                {dur === '12m' && '12 Mois (Annuel)'}
              </button>
            ))}
          </div>

          {/* 1. Offre Découverte Horizon (Bannière supérieure pleine largeur) */}
          <div className={styles.decouverteBanner}>
            <div className={styles.decouverteBannerInfo}>
              <div className={styles.decouverteTitleRow}>
                <span className={styles.decouverteTitle}>🟢 Formule Découverte</span>
                <span className={styles.decouverteSubtitle}>Accès Test (3 Jours)</span>
              </div>
              <div className={styles.decouvertePriceBadge}>
                Gratuit <span className={styles.decouverteAutoBadge}>Automatique à l&apos;inscription</span>
              </div>
            </div>

            <div className={styles.decouverteFeaturesList}>
              <div className={styles.decouverteFeatureTag}><span>•</span> 5 questions IA / jour</div>
              <div className={styles.decouverteFeatureTag}><span>•</span> 1 protocole (avec filigrane)</div>
              <div className={styles.decouverteFeatureTag}><span>•</span> 1 article STROBE (avec filigrane)</div>
              <div className={styles.decouverteFeatureTag}><span>•</span> 1 synthèse bibliographique</div>
              <div className={styles.decouverteFeatureTag}><span>•</span> Calculateur NSN démo</div>
            </div>

            <button className={styles.decouverteActionBtn} onClick={() => {
              if (onSelectPlan) onSelectPlan('découverte', 'student');
              onClose();
            }}>
              Tester l&apos;Offre Découverte (3j)
            </button>
          </div>

          {/* Grille des 4 Formules (PRO, EXPERT, ULTRA, INSTITUTION sur 4 colonnes) */}
          <div className={styles.plansGrid}>
            {/* 1. PRO */}
            <div className={styles.planCard} style={{ borderColor: '#0d9488' }}>
              <span className={styles.popularBadge}>Recommandé</span>
              <div className={styles.planHeader}>
                <div className={styles.planName} style={{ color: '#2dd4bf' }}>🔷 PRO</div>
                <div className={styles.planSubtitle}>Internes, Résidents & Doctorants</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', margin: '4px 0' }}>
                  {residence === 'dz' ? (
                    selectedDuration === '1m' ? '1 500 DZD / mois' :
                    selectedDuration === '3m' ? '3 900 DZD (1 300/m)' :
                    selectedDuration === '6m' ? '6 900 DZD (1 150/m)' :
                    '11 900 DZD / an (990/m)'
                  ) : residence === 'africa' ? (
                    selectedDuration === '1m' ? '20 € / mois (~13 120 FCFA)' :
                    selectedDuration === '3m' ? '45 € (~29 520 FCFA - 15 €/m)' :
                    selectedDuration === '6m' ? '72 € (~47 230 FCFA - 12 €/m)' :
                    '120 € / an (~78 715 FCFA - 10 €/m)'
                  ) : (
                    selectedDuration === '1m' ? '59 € / mois' :
                    selectedDuration === '3m' ? '147 € (49 €/m)' :
                    selectedDuration === '6m' ? '234 € (39 €/m)' :
                    '348 € / an (29 €/m)'
                  )}
                </div>
                <span className={styles.planBadgeBonus}>🎁 + 7 jours offerts sur virement</span>
              </div>
              <ul className={styles.featureList}>
                <li><span>✓</span> <strong>100 Q / jour IA</strong></li>
                <li><span>✓</span> <strong>Calculateur NSN ILLIMITÉ</strong></li>
                <li><span>✓</span> Quiz & Flashcards illimités</li>
                <li><span>✓</span> 5 protocoles/mois (sans filigrane)</li>
                <li><span>✓</span> 5 articles STROBE/mois (sans filigrane)</li>
                <li><span>✓</span> 20 synthèses PubMed/mois</li>
                <li><span>✓</span> 5 bilans pédagogiques/mois</li>
              </ul>
              <button className={styles.actionBtn} onClick={() => {
                setSelectedTier('pro');
                if (onSelectPlan) {
                  onSelectPlan('pro', 'student');
                  onClose();
                } else {
                  const ripElement = document.getElementById('rip-section');
                  if (ripElement) ripElement.scrollIntoView({ behavior: 'smooth' });
                }
              }}>
                Demander l&apos;Offre PRO
              </button>
            </div>

            {/* 2. EXPERT (Individuel Illimité & PDF Propres) */}
            <div className={styles.planCard} style={{ borderColor: '#a855f7' }}>
              <span className={styles.popularBadge} style={{ background: 'linear-gradient(135deg, #9333ea, #c084fc)' }}>Illimité Solo</span>
              <div className={styles.planHeader}>
                <div className={styles.planName} style={{ color: '#c084fc' }}>⚡ EXPERT</div>
                <div className={styles.planSubtitle}>Chercheur & Praticien Solo</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#e9d5ff', margin: '4px 0' }}>
                  {residence === 'dz' ? (
                    selectedDuration === '1m' ? '3 500 DZD / mois' :
                    selectedDuration === '3m' ? '9 900 DZD (3 300/m)' :
                    selectedDuration === '6m' ? '17 900 DZD (2 980/m)' :
                    '29 900 DZD / an (2 490/m)'
                  ) : residence === 'africa' ? (
                    selectedDuration === '1m' ? '34 € / mois (~22 300 FCFA)' :
                    selectedDuration === '3m' ? '90 € (~59 030 FCFA - 30 €/m)' :
                    selectedDuration === '6m' ? '156 € (~102 330 FCFA - 26 €/m)' :
                    '240 € / an (~157 430 FCFA - 20 €/m)'
                  ) : (
                    selectedDuration === '1m' ? '69 € / mois' :
                    selectedDuration === '3m' ? '177 € (59 €/m)' :
                    selectedDuration === '6m' ? '294 € (49 €/m)' :
                    '468 € / an (39 €/m)'
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a7f3d0', fontWeight: 600 }}>
                  Abonnement selon la durée sélectionnée
                </div>
                <span className={styles.planBadgeBonus}>🎁 + 10 jours offerts sur virement</span>
              </div>
              <ul className={styles.featureList}>
                <li><span>⚡</span> <strong>Protocoles & Articles 100% ILLIMITÉS</strong></li>
                <li><span>⚡</span> <strong>Synthèses PubMed & Tuteur IA ILLIMITÉS</strong></li>
                <li><span>⚡</span> <strong>Exports PDF HD propres SANS FILIGRANE</strong></li>
                <li><span>✓</span> Calculateur NSN, Quiz & Flashcards illimités</li>
                <li><span>✓</span> Support prioritaire chercheurs</li>
                <li style={{ color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic' }}>(Sans espace supervision d&apos;étudiants)</li>
              </ul>
              <button className={styles.actionBtn} style={{ background: 'linear-gradient(135deg, #9333ea, #7e22ce)' }} onClick={() => {
                setSelectedTier('expert');
                if (onSelectPlan) {
                  onSelectPlan('expert', 'student');
                  onClose();
                } else {
                  const ripElement = document.getElementById('rip-section');
                  if (ripElement) ripElement.scrollIntoView({ behavior: 'smooth' });
                }
              }}>
                Demander l&apos;Offre EXPERT
              </button>
            </div>

            {/* 3. ULTRA ENSEIGNANT */}
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <div className={styles.planName} style={{ color: '#fbbf24' }}>👑 ULTRA</div>
                <div className={styles.planSubtitle}>Enseignants & Encadreurs (Supervision)</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fbbf24', margin: '6px 0', lineHeight: '1.3' }}>
                  {residence === 'dz' ? (
                    <>
                      <div>
                        {selectedDuration === '1m' ? '3 500 DZD / mois' :
                         selectedDuration === '3m' ? '9 900 DZD (3 300/m)' :
                         selectedDuration === '6m' ? '18 900 DZD (3 150/m)' :
                         '30 900 DZD / an (2 575/m)'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#fcd34d', fontWeight: 600, marginTop: '3px' }}>
                        {selectedDuration === '1m' ? 'Base (2 500 DA) + 1er étudiant inclus (1 000 DA)' :
                         selectedDuration === '3m' ? 'Base (6 900 DA) + 1er étudiant inclus (3 000 DA)' :
                         selectedDuration === '6m' ? 'Base (12 900 DA) + 1er étudiant inclus (6 000 DA)' :
                         'Base (20 900 DA) + 1er étudiant inclus (10 000 DA)'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>
                        {selectedDuration === '1m' ? '+ 1 000 DA/mois par étudiant supp.' :
                         selectedDuration === '3m' ? '+ 3 000 DA (~1 000/m) par étudiant supp.' :
                         selectedDuration === '6m' ? '+ 5 400 DA (~900/m) par étudiant supp.' :
                         '+ 9 600 DA (~800/m) par étudiant supp.'}
                      </div>
                    </>
                  ) : residence === 'africa' ? (
                    <>
                      <div>
                        {selectedDuration === '1m' ? '37 € / mois (~24 270 FCFA)' :
                         selectedDuration === '3m' ? '105 € (~68 870 FCFA - 35 €/m)' :
                         selectedDuration === '6m' ? '198 € (~129 880 FCFA - 33 €/m)' :
                         '324 € / an (~212 530 FCFA - 27 €/m)'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#fcd34d', fontWeight: 600, marginTop: '3px' }}>
                        {selectedDuration === '1m' ? 'Base (20 €) + 1er étudiant inclus (17 €)' :
                         selectedDuration === '3m' ? 'Base (54 €) + 1er étudiant inclus (51 €)' :
                         selectedDuration === '6m' ? 'Base (96 €) + 1er étudiant inclus (102 €)' :
                         'Base (144 €) + 1er étudiant inclus (180 €)'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>
                        {selectedDuration === '1m' ? '+ 17 €/mois par étudiant supp.' :
                         selectedDuration === '3m' ? '+ 51 € (~17 €/m) par étudiant supp.' :
                         selectedDuration === '6m' ? '+ 90 € (~15 €/m) par étudiant supp.' :
                         '+ 144 € (~12 €/m) par étudiant supp.'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        {selectedDuration === '1m' ? '104 € / mois' :
                         selectedDuration === '3m' ? '282 € (94 €/m)' :
                         selectedDuration === '6m' ? '504 € (84 €/m)' :
                         '828 € / an (69 €/m)'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#fcd34d', fontWeight: 600, marginTop: '3px' }}>
                        {selectedDuration === '1m' ? 'Base (59 €) + 1er étudiant inclus (45 €)' :
                         selectedDuration === '3m' ? 'Base (147 €) + 1er étudiant inclus (135 €)' :
                         selectedDuration === '6m' ? 'Base (234 €) + 1er étudiant inclus (270 €)' :
                         'Base (348 €) + 1er étudiant inclus (480 €)'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>
                        {selectedDuration === '1m' ? '+ 45 €/mois par étudiant supp.' :
                         selectedDuration === '3m' ? '+ 135 € (45 €/m) par étudiant supp.' :
                         selectedDuration === '6m' ? '+ 240 € (40 €/m) par étudiant supp.' :
                         '+ 360 € (30 €/m) par étudiant supp.'}
                      </div>
                    </>
                  )}
                </div>
                <span className={styles.planBadgeBonus}>🎁 + 14 jours offerts sur virement</span>
              </div>
              <ul className={styles.featureList}>
                <li><span>⚡</span> <strong>Accès 100% ILLIMITÉ</strong></li>
                <li><span>⚡</span> <strong>Espace Supervision Étudiants</strong></li>
                <li><span>⚡</span> <strong>Messagerie interne encadrement</strong></li>
                <li><span>✓</span> PDF HD sans filigrane</li>
                <li><span>✓</span> Support prioritaire</li>
              </ul>
              <button className={`${styles.actionBtn} ${styles.contactBtn}`} onClick={() => {
                if (onSelectPlan) {
                  onSelectPlan('ultra', 'teacher');
                  onClose();
                } else {
                  setContactMode('ultra');
                }
              }}>
                Demander l&apos;Offre ULTRA
              </button>
            </div>

            {/* 4. INSTITUTION */}
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <div className={styles.planName}>🏛️ INSTITUTION</div>
                <div className={styles.planSubtitle}>Facultés, Hôpitaux, Labos de recherche & Entreprises</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#c084fc', margin: '4px 0' }}>
                  {residence === 'dz' 
                    ? 'Sur Devis (DZD)' 
                    : residence === 'africa' 
                    ? 'Sur Devis Zone Afrique (€ / FCFA)' 
                    : 'Sur Devis (€ / $ / CAD)'}
                </div>
                <span className={styles.planBadgeBonus}>Multi-sièges & Devis</span>
              </div>
              <ul className={styles.featureList}>
                <li><span>🏛️</span> Accès illimité pour établissement</li>
                <li><span>🏛️</span> Tableau de bord Doyen / Chef</li>
                <li><span>🏛️</span> Logo institutionnel sur PDF</li>
                <li><span>🏛️</span> Accompagnement dédié</li>
              </ul>
              <button className={`${styles.actionBtn} ${styles.contactBtn}`} onClick={() => {
                if (onSelectPlan) {
                  onSelectPlan('institution', 'teacher');
                  onClose();
                } else {
                  setContactMode('institution');
                }
              }}>
                Demander un Devis
              </button>
            </div>
          </div>

          {/* Formulaire de contact si mode sélectionné */}
          {contactMode && (
            <div style={{ background: 'rgba(30,41,59,0.7)', padding: '1.2rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', color: '#38bdf8' }}>
                {contactMode === 'ultra' ? '👑 Demande d\'accès ULTRA Enseignant & Encadreur' : '🏛️ Demande de devis Institutionnel'}
              </h4>
              {submittedMessage ? (
                <div style={{ color: '#34d399', fontWeight: 600 }}>
                  ✓ Votre demande a été transmise avec succès ! Nous vous recontacterons très rapidement.
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <input
                      type="text"
                      placeholder="Nom complet / Titre"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.6rem', borderRadius: '8px' }}
                    />
                    <input
                      type="email"
                      placeholder="Email de contact"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.6rem', borderRadius: '8px' }}
                    />
                  </div>
                  {contactMode === 'ultra' && (
                    <input
                      type="number"
                      placeholder="Nombre d'étudiants / doctorants encadrés"
                      value={contactForm.studentCount}
                      onChange={(e) => setContactForm({ ...contactForm, studentCount: e.target.value })}
                      style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.6rem', borderRadius: '8px' }}
                    />
                  )}
                  <textarea
                    placeholder="Précisez votre demande ou votre établissement..."
                    rows={3}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.6rem', borderRadius: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" className={styles.closeBtn} onClick={() => setContactMode(null)}>Annuler</button>
                    <button type="submit" className={styles.actionBtn} style={{ width: 'auto' }}>Envoyer la demande</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Section Instructions de Paiement / Virement */}
          {residence === 'dz' ? (
            <div id="rip-section" className={styles.ripBox}>
              <div className={styles.ripTitle}>
                <span>📲</span>
                <span>Instructions de paiement BaridiMob (Algérie)</span>
              </div>
              <p style={{ fontSize: '0.83rem', color: '#94a3b8', margin: 0 }}>
                Pour activer votre formule <strong>PRO</strong> ou <strong>ULTRA</strong> en Algérie, effectuez votre virement BaridiMob vers le RIP ci-dessous.
              </p>
              <div className={styles.ripDetails}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>RIP BaridiMob :</span>
                  <strong>00799999000041210947</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Titulaire du compte :</span>
                  <strong>Professeur Nezzal Abdelmalek</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>NIF (Fiscal) :</span>
                  <strong style={{ fontFamily: 'monospace', color: '#38bdf8' }}>15007180115910202380</strong>
                </div>
                <button className={styles.copyBtn} onClick={handleCopyRip}>
                  {copiedRip ? 'Copie effectuée ✓' : 'Copier le RIP BaridiMob'}
                </button>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#34d399', margin: '0 0 10px 0', fontStyle: 'italic' }}>
                ⚡ Dès réception et validation du virement BaridiMob par l&apos;administrateur, votre accès s&apos;active immédiatement avec vos jours bonus offerts (7j Pro / 14j Ultra) !
              </p>

              {/* Formulaire direct de transmission de Reçu BaridiMob */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
                {receiptSuccess ? (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
                    ✓ Reçu de paiement BaridiMob transmis avec succès ! Activation sous 24h.
                  </div>
                ) : (
                  <form onSubmit={handleReceiptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="email"
                        required
                        placeholder="Votre e-mail de compte *"
                        value={receiptEmail}
                        onChange={e => setReceiptEmail(e.target.value)}
                        style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.85)', color: 'white', fontSize: '0.84rem' }}
                      />
                      <input
                        type="text"
                        required
                        placeholder="N° de reçu ou transaction *"
                        value={receiptTxId}
                        onChange={e => setReceiptTxId(e.target.value)}
                        style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.85)', color: 'white', fontSize: '0.84rem' }}
                      />
                    </div>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: receiptImageData ? '1px solid #10b981' : '1px dashed rgba(56, 189, 248, 0.4)',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>📷</span>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: receiptImageData ? '#34d399' : '#e2e8f0' }}>
                            {receiptImageData ? '✓ Photo du reçu jointe avec succès' : 'Joindre la photo du reçu'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            JPG, PNG, WebP (Compression auto)
                          </div>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleReceiptFileChange}
                        style={{ display: 'none' }}
                      />
                      <span style={{
                        background: receiptImageData ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: receiptImageData ? '#34d399' : '#38bdf8',
                        border: receiptImageData ? '1px solid #10b981' : '1px solid #38bdf8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>
                        {receiptImageData ? 'Modifier' : 'Parcourir...'}
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmittingReceipt}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #0d9488, #0284c7)', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {isSubmittingReceipt ? 'Transmission en cours...' : '📤 Transmettre le Reçu et la Photo'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : residence === 'africa' ? (
            <div id="rip-section" className={styles.ripBox} style={{ borderColor: 'rgba(13, 148, 136, 0.4)' }}>
              <div className={styles.ripTitle} style={{ color: '#2dd4bf' }}>
                <span>🌍</span>
                <span>Règlement Automatique PayPal / Carte — Zone Afrique</span>
              </div>
              <p style={{ fontSize: '0.83rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
                Formule sélectionnée : <strong style={{ color: '#2dd4bf' }}>{selectedTier.toUpperCase()}</strong> ({selectedDuration === '1m' ? '1 Mois' : selectedDuration === '3m' ? '3 Mois' : selectedDuration === '6m' ? '6 Mois' : '12 Mois'})
              </p>

              {/* Bouton de Paiement PayPal Automatique */}
              <PayPalCheckoutButton
                tier={selectedTier}
                duration={selectedDuration}
                residence="africa"
              />

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600, marginBottom: '6px' }}>
                  💸 Moyen de secours manuel (Western Union) :
                </div>
                <div className={styles.ripDetails}>
                  <div>
                    <span style={{ color: '#fbbf24', fontSize: '0.78rem', display: 'block', fontWeight: 700 }}>Western Union :</span>
                    <strong style={{ fontSize: '0.82rem', color: '#f1f5f9' }}>Bénéficiaire : Nezzal Hanane Hayette</strong>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Destination : Quebec Brossard, Canada</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div id="rip-section" className={styles.ripBox} style={{ borderColor: 'rgba(2, 132, 199, 0.4)' }}>
              <div className={styles.ripTitle} style={{ color: '#38bdf8' }}>
                <span>🇪🇺🇨🇦</span>
                <span>Règlement Automatique PayPal / Carte — Zone Europe & Occident</span>
              </div>
              <p style={{ fontSize: '0.83rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
                Formule sélectionnée : <strong style={{ color: '#38bdf8' }}>{selectedTier.toUpperCase()}</strong> ({selectedDuration === '1m' ? '1 Mois' : selectedDuration === '3m' ? '3 Mois' : selectedDuration === '6m' ? '6 Mois' : '12 Mois'})
              </p>

              {/* Bouton de Paiement PayPal Automatique */}
              <PayPalCheckoutButton
                tier={selectedTier}
                duration={selectedDuration}
                residence="western"
              />

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600, marginBottom: '6px' }}>
                  💸 Moyen de secours manuel (Western Union) :
                </div>
                <div className={styles.ripDetails}>
                  <div>
                    <span style={{ color: '#fbbf24', fontSize: '0.78rem', display: 'block', fontWeight: 700 }}>Western Union :</span>
                    <strong style={{ fontSize: '0.82rem', color: '#f1f5f9' }}>Bénéficiaire : Nezzal Hanane Hayette</strong>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Destination : Quebec Brossard, Canada</div>
                  </div>
                </div>
              </div>
            </div>
          )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
