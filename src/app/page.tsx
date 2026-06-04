'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProgress, resetProgress, saveProgress, LocalStats } from '@/utils/storage';
import { useAuth } from '@/context/AuthContext';
import { loadUserProfile, loadFirestoreProtocols, syncUserProfile, deleteFirestoreProtocol } from '@/utils/firestore';
import styles from './page.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<LocalStats | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchStats = async () => {
    if (user) {
      try {
        const profile = await loadUserProfile(user.uid);
        const firestoreProtos = await loadFirestoreProtocols(user.uid);
        if (profile?.stats) {
          const updated = {
            ...getProgress(),
            ...profile.stats,
            recentProtocols: firestoreProtos
          };
          saveProgress(updated);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des stats Firestore:", err);
      }
    }
    setStats(getProgress());
  };

  useEffect(() => {
    fetchStats();
    window.addEventListener('progress_changed', fetchStats);
    return () => {
      window.removeEventListener('progress_changed', fetchStats);
    };
  }, [user]);

  const handleResetClick = () => {
    setShowResetModal(true);
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      resetProgress();
      if (user) {
        try {
          const DEFAULT_STATS = {
            questionsAsked: 0,
            protocolsGenerated: 0,
            quizCorrect: 0,
            quizTotal: 0,
            flashcardsMastered: [],
            recentQuestions: [],
            recentProtocols: []
          };
          await syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, DEFAULT_STATS);
          
          const protos = await loadFirestoreProtocols(user.uid);
          for (const p of protos) {
            await deleteFirestoreProtocol(user.uid, p.id);
          }
        } catch (e) {
          console.error("Erreur de réinitialisation sur Firestore:", e);
        }
      }
      fetchStats();
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  if (!stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Chargement du tableau de bord...</p>
      </div>
    );
  }

  // Calculs statistiques
  const quizPct = stats.quizTotal > 0 ? Math.round((stats.quizCorrect / stats.quizTotal) * 100) : 0;
  const flashcardsPct = Math.round((stats.flashcardsMastered.length / 12) * 100);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Méthodologie de Recherche Clinique</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(13, 148, 136, 0.12)', color: 'var(--accent-primary)', border: '1px solid rgba(13, 148, 136, 0.25)', padding: '0.25rem 0.65rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                METHODO-CLINIQUE Édu v1.1.0 - Production Ready
              </span>
            </div>
            <p className={styles.subtitle}>
              Concevez vos protocoles selon les recommandations du manuel <strong>RECIF</strong> et maîtrisez la réglementation algérienne de la recherche clinique.
            </p>
          </div>
          <div className={styles.profileCard}>
            <div className={styles.profileImageContainer}>
              <img 
                src="/pr_nezzal.png" 
                alt="Pr Nezzal Abdelmalek" 
                className={styles.profileImage}
              />
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileRole}>Superviseur Scientifique</span>
              <h4 className={styles.profileName}>Pr Nezzal Abdelmalek</h4>
            </div>
          </div>
        </div>
      </header>

      {/* Grid de Statistiques */}
      <section className={styles.statsGrid}>
        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className={styles.statLabel}>Tuteur RECIF</span>
          <span className={styles.statValue}>{stats.questionsAsked}</span>
          <span className={styles.statProgress}>Questions posées</span>
          <Link href="/tuteur" style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
            Poser une question &rarr;
          </Link>
        </div>

        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon} style={{ color: 'var(--accent-secondary)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <span className={styles.statLabel}>Protocoles générés</span>
          <span className={styles.statValue}>{stats.protocolsGenerated}</span>
          <span className={styles.statProgress} style={{ color: 'var(--accent-secondary)' }}>Fiches prêtes</span>
          <Link href="/protocole" style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.85rem', color: 'var(--accent-secondary)', fontWeight: '600' }}>
            Nouveau protocole &rarr;
          </Link>
        </div>

        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon} style={{ color: 'var(--accent-success)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 11 3 3L22 4" />
              <path d="M22 12a10 10 0 1 1-5.93-9.14" />
            </svg>
          </div>
          <span className={styles.statLabel}>Score aux Quiz</span>
          <span className={styles.statValue}>{quizPct}%</span>
          <span className={styles.statProgress} style={{ color: 'var(--accent-success)' }}>
            {stats.quizCorrect}/{stats.quizTotal} réponses correctes
          </span>
          <Link href="/quiz" style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: '600' }}>
            Lancer un quiz &rarr;
          </Link>
        </div>

        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon} style={{ color: 'var(--accent-warning)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <span className={styles.statLabel}>Flashcards maîtrisées</span>
          <span className={styles.statValue}>{flashcardsPct}%</span>
          <span className={styles.statProgress} style={{ color: 'var(--accent-warning)' }}>
            {stats.flashcardsMastered.length}/12 cartes acquises
          </span>
          <Link href="/quiz" style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.85rem', color: 'var(--accent-warning)', fontWeight: '600' }}>
            Réviser les cartes &rarr;
          </Link>
        </div>
      </section>

      {/* Section actions rapides */}
      <section className={styles.quickActions}>
        <div className={`${styles.actionCard} glass-card`}>
          <h3 className={styles.cardTitle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20V10" />
              <path d="M18 20V4" />
              <path d="M6 20v-4" />
            </svg>
            Votre Parcours & Rapport de Suivi
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            L'IA peut générer un bilan pédagogique complet de vos compétences en méthodologie clinique en analysant votre progression (scores des quiz, concepts de flashcards acquis et protocoles rédigés).
          </p>
          <Link href="/rapport" className="btn btn-primary">
            Consulter mon Rapport Pédagogique
          </Link>
        </div>

        <div className={`${styles.actionCard} glass-card`}>
          <h3 className={styles.cardTitle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Protocoles récents
          </h3>
          {stats.recentProtocols.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', marginTop: '1rem' }}>
              Aucun protocole généré pour le moment.
            </p>
          ) : (
            <ul className={styles.recentProtocolsList}>
              {stats.recentProtocols.slice(0, 3).map((p) => (
                <li key={p.id} className={styles.protocolItem}>
                  <div className={styles.protocolMeta}>
                    <h5>[{p.acronym}] {p.title.length > 25 ? p.title.substring(0, 25) + '...' : p.title}</h5>
                    <span>{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <Link href={`/protocole?id=${p.id}`} style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
                    Voir &rarr;
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Réinitialisation */}
      <div className={styles.resetContainer}>
        <button className={styles.resetBtn} onClick={handleResetClick}>
          Réinitialiser toutes mes statistiques
        </button>
      </div>

      {/* Modal de Confirmation Personnalisé (Résout l'INP Issue de confirm() bloquant) */}
      {showResetModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalIcon}>⚠️</div>
            <h3 className={styles.modalTitle}>Confirmer la Réinitialisation</h3>
            <p className={styles.modalDescription}>
              Voulez-vous vraiment réinitialiser tout votre parcours d'apprentissage ? Vos protocoles générés et vos scores seront définitivement effacés de la base de données.
            </p>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
              >
                Annuler
              </button>
              <button 
                className={styles.confirmDeleteBtn} 
                onClick={handleExecuteReset}
                disabled={isResetting}
              >
                {isResetting ? 'Réinitialisation...' : 'Oui, réinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
