'use client';

import React, { useEffect } from 'react';
import styles from './ChangelogModal.module.css';
import { APP_VERSION } from '@/utils/constants';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReleaseItem {
  version: string;
  isCurrent?: boolean;
  date: string;
  title: string;
  tags: string[];
  features: string[];
}

const RELEASES: ReleaseItem[] = [
  {
    version: 'v1.8.0',
    isCurrent: true,
    date: '27 Juillet 2026',
    title: 'Génération Intégrale des Protocoles & Historique Amélioré',
    tags: ['Protocoles', 'STROBE', 'Calculateur NSN', 'Historique'],
    features: [
      'Génération intégrale des 19 sections de protocoles de recherche sans troncature et suppression du tableau lourd initial.',
      'Génération complète des articles STROBE (critères 1 à 22) avec quota étendu à 8192 tokens.',
      'Gestion complète de l\'historique des articles STROBE et protocoles (Boutons Ouvrir, Régénérer, Supprimer).',
      'Correction sémantique dynamique de la taille d\'échantillon (données manquantes / dossiers inexploitables selon le type d\'étude).',
      'Ajout de la section d\'Analyse Critique & Rigueur Méthodologique RECIF pour le calcul du Nombre de Sujets Nécessaires (NSN).'
    ]
  },
  {
    version: 'v1.7.1',
    date: '26 Juillet 2026',
    title: 'Acquisition de l\'Exécutable Hors-ligne & Licences',
    tags: ['Licences', 'Hors-ligne', 'Sécurité', 'Admin'],
    features: [
      'Nouveau module d\'acquisition de licences de bureau hors-ligne (.exe / .app).',
      'Intégration d\'un bouton de demande de licence interactive redirigée vers la supervision administrateur.',
      'Refonte ergonomique de la page d\'acquisition avec explications commerciales (licence offerte pour abonnement annuel EXPERT/ULTRA).',
      'Suppression définitive du mode invité obsolète pour simplifier les flux d\'accès.',
      'Mise à jour des tarifs EXPERT et ULTRA variables selon la durée d\'abonnement.'
    ]
  },
  {
    version: 'v1.7.0',
    date: '24 Juillet 2026',
    title: 'Recherche PubMed IA & Bilan Pédagogique Interactif v2',
    tags: ['PubMed', 'IA MeSH', 'Synthèse Biblio', 'Rapport v2'],
    features: [
      'Nouveau module de recherche PubMed en direct avec limite étendue à 50 articles et suppression locale.',
      'Générateur automatique de requêtes MeSH structurées par IA (Gemini / Qwen).',
      'Module de synthèse bibliographique IA multi-sources pour revue de la littérature.',
      'Génération interactive du Bilan Pédagogique section par section (5 sections sur 4 pages PDF).'
    ]
  },
  {
    version: 'v1.6.1',
    date: '21 Juillet 2026',
    title: 'Optimisations Ergonomiques & Champs Extensibles',
    tags: ['Ergonomie', 'Formulaires', 'Badges'],
    features: [
      'Redimensionnement vertical des zones de texte (textarea) sur les formulaires STROBE et Protocole.',
      'Suppression totale des tronquatures horizontalement sur la population, le critère principal et les critères secondaires.',
      'Intégration des badges méthodologiques visuels (STROBE 1-22, FINE & PICOT, Loi n° 18-11).',
      'Harmonisation des thèmes sombres et des effets de focus Teal néon.'
    ]
  },
  {
    version: 'v1.6.0',
    date: 'Juillet 2026',
    title: 'Graphique Radar de Compétences & Branding Methodo&Clinique',
    tags: ['Graphique', 'Branding', 'Admin'],
    features: [
      'Visualisation radar des 6 piliers de compétences dans le Rapport Pédagogique.',
      'Rebranding global vers Methodo&Clinique avec intégration du logo officiel HD.',
      'Panneau d administration repensé pour la gestion et le suivi des utilisateurs.',
      'Optimisation des styles d impression PDF sans logos parasites.'
    ]
  },
  {
    version: 'v1.5.0',
    date: 'Juillet 2026',
    title: 'Guide Hors-ligne Interactif & Agents Spécialisés',
    tags: ['Hors-ligne', 'Agents IA', 'Mobile'],
    features: [
      'Module interactif de consultation du Guide de Méthodologie Clinique RECIF.',
      'Ajout des skills d agents IA (Auditeur de Protocoles Cliniques, Packaging Electron).',
      'Chargement de la police Inter en local pour une totale autonomie réseau.',
      'Correctifs d ergonomie pour la navigation globale sur smartphone.'
    ]
  },
  {
    version: 'v1.4.0',
    date: 'Juillet 2026',
    title: 'Sécurisation des Accès & Kit de Déploiement',
    tags: ['Sécurité', 'Packaging'],
    features: [
      'Renforcement des contrôles d accès (Broken Access Control) sur la validation des accès.',
      'Gabarit .env.example et script de packaging zip sécurisé sans secrets.',
      'Amélioration de la zone de saisie tactile sur le Tuteur Virtuel mobile.'
    ]
  },
  {
    version: 'v1.3.0 / v1.3.1',
    date: 'Juillet 2026',
    title: 'Support Ollama Local & Moteur RAG Vectoriel E5',
    tags: ['Ollama', 'RAG Vectoriel', 'IA Locale'],
    features: [
      'Détection automatique et support des modèles locaux Ollama (gemma2, gemma4, qwen3).',
      'Interrogation hors-ligne du Manuel RECIF par recherche sémantique vectorielle (Multilingual E5).',
      'Bascule automatique en mode dégradé en cas d indisponibilité des API externes.'
    ]
  },
  {
    version: 'v1.0.0 / v1.1.0',
    date: 'Juillet 2026',
    title: 'Lancement de la Plateforme RECIF',
    tags: ['Lancement', 'Electron', 'Offline-First'],
    features: [
      'Lancement initial avec Tuteur RAG, Rédacteur STROBE, Générateur de Protocole et Calculateur NSN.',
      'Architecture Offline-First avec base de connaissances intégrée.',
      'Packaging Electron pour exécutables autonomes Windows et macOS.'
    ]
  }
];

export default function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <span>✨</span>
            <span>Nouveautés & Historique des versions</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className={styles.modalBody}>
          {RELEASES.map((rel, index) => (
            <div
              key={index}
              className={`${styles.timelineItem} ${rel.isCurrent ? styles.timelineItemActive : ''}`}
            >
              <div className={styles.timelineHeader}>
                <span className={styles.versionTag}>{rel.version}</span>
                {rel.isCurrent && <span className={styles.currentBadge}>Version Actuelle</span>}
                <span className={styles.releaseDate}>{rel.date}</span>
              </div>
              <div className={styles.releaseTitle}>{rel.title}</div>
              <div className={styles.tagRow}>
                {rel.tags.map((tag, tIdx) => (
                  <span key={tIdx} className={styles.categoryTag}>{tag}</span>
                ))}
              </div>
              <ul className={styles.featureList}>
                {rel.features.map((feat, fIdx) => (
                  <li key={fIdx}>{feat}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <footer className={styles.modalFooter}>
          <span>Methodo&Clinique Éducation v{APP_VERSION}</span>
          <span>Plateforme Pédagogique & Recherche Clinique</span>
        </footer>
      </div>
    </div>
  );
}
