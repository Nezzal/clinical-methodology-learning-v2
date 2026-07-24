'use client';

import React, { useState } from 'react';
import styles from './SubscriptionModal.module.css';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (tier: 'découverte' | 'pro' | 'ultra' | 'institution', role: 'student' | 'teacher') => void;
}

export default function SubscriptionModal({ isOpen, onClose, onSelectPlan }: SubscriptionModalProps) {
  const [selectedDuration, setSelectedDuration] = useState<'1m' | '3m' | '6m' | '12m'>('12m');
  const [copiedRip, setCopiedRip] = useState(false);
  const [contactMode, setContactMode] = useState<null | 'ultra' | 'institution'>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', studentCount: '' });
  const [submittedMessage, setSubmittedMessage] = useState(false);

  if (!isOpen) return null;

  const handleCopyRip = () => {
    navigator.clipboard.writeText('RIP/CCP: 17978545 Clé 42 - Methodo&Clinique');
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

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <span>✨</span>
            <span>Abonnements & Formules Methodo&Clinique</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className={styles.modalBody}>
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

          {/* Grille des 4 Formules */}
          <div className={styles.plansGrid}>
            {/* 1. Découverte */}
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <div className={styles.planName}>🟢 Découverte</div>
                <div className={styles.planSubtitle}>Accès Test (3 Jours)</div>
                <span className={styles.planBadgeBonus}>Automatique à l'inscription</span>
              </div>
              <ul className={styles.featureList}>
                <li><span>•</span> 5 questions IA par jour</li>
                <li><span>•</span> 1 protocole (avec filigrane)</li>
                <li><span>•</span> 1 article STROBE (avec filigrane)</li>
                <li><span>•</span> 1 synthèse bibliographique</li>
                <li><span>•</span> Calculateur NSN démo</li>
              </ul>
              <button className={`${styles.actionBtn} ${styles.contactBtn}`} onClick={() => {
                if (onSelectPlan) onSelectPlan('découverte', 'student');
                onClose();
              }}>
                Tester l'Offre Découverte (3j)
              </button>
            </div>

            {/* 2. PRO */}
            <div className={styles.planCard} style={{ borderColor: '#0d9488' }}>
              <span className={styles.popularBadge}>Recommandé</span>
              <div className={styles.planHeader}>
                <div className={styles.planName} style={{ color: '#2dd4bf' }}>🔷 PRO</div>
                <div className={styles.planSubtitle}>Internes, Résidents & Doctorants</div>
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
                if (onSelectPlan) {
                  onSelectPlan('pro', 'student');
                  onClose();
                } else {
                  const ripElement = document.getElementById('rip-section');
                  if (ripElement) ripElement.scrollIntoView({ behavior: 'smooth' });
                }
              }}>
                Demander l'Offre PRO
              </button>
            </div>

            {/* 3. ULTRA */}
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <div className={styles.planName} style={{ color: '#fbbf24' }}>👑 ULTRA</div>
                <div className={styles.planSubtitle}>Enseignants & Encadreurs</div>
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
                Demander l'Offre ULTRA
              </button>
            </div>

            {/* 4. INSTITUTION */}
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <div className={styles.planName}>🏛️ INSTITUTION</div>
                <div className={styles.planSubtitle}>Facultés, CHU & Labos</div>
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

          {/* Section RIP / CCP pour Virement */}
          <div id="rip-section" className={styles.ripBox}>
            <div className={styles.ripTitle}>
              <span>💳</span>
              <span>Instructions pour Virement bancaire / CCP (RIP)</span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#94a3b8', margin: 0 }}>
              Pour activer votre formule <strong>PRO</strong> ou <strong>ULTRA</strong>, effectuez votre virement vers les coordonnées ci-dessous, puis envoyez le reçu à l'administrateur.
            </p>
            <div className={styles.ripDetails}>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>RIB / RIP CCP :</span>
                <strong>17978545 Clé 42</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Titulaire du compte :</span>
                <strong>Methodo&Clinique Éducation</strong>
              </div>
              <button className={styles.copyBtn} onClick={handleCopyRip}>
                {copiedRip ? 'Copie effectuée ✓' : 'Copier le RIP'}
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#34d399', margin: 0, fontStyle: 'italic' }}>
              ⚡ Dès réception et validation du virement par l'administrateur, votre accès s'active immédiatement avec les jours bonus inclus (7j Pro / 14j Ultra) !
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
