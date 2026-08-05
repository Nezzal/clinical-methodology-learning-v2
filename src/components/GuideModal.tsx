'use client';

import React, { useState, useEffect } from 'react';
import { APP_VERSION } from '@/utils/constants';
import styles from './GuideModal.module.css';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialModule?: number;
}

const MODULES = [
  { id: 1, name: "🚀 1. Page d'Accueil & Connexion", icon: "🚀" },
  { id: 2, name: "📊 2. Tableau de Bord (Dashboard)", icon: "📊" },
  { id: 3, name: "🤖 3. Tuteur Intelligent (3 Volets)", icon: "🤖" },
  { id: 4, name: "📑 4. Générateur de Protocoles", icon: "📑" },
  { id: 5, name: "🔬 5. Recherche PubMed & Synthèse", icon: "🔬" },
  { id: 6, name: "🧠 6. Quiz & Timer", icon: "🧠" },
  { id: 7, name: "📈 7. Rapport Pédagogique", icon: "📈" },
  { id: 8, name: "🧮 8. Calculateur NSN", icon: "🧮" },
  { id: 9, name: "✍️ 9. Rédacteur STROBE", icon: "✍️" },
  { id: 10, name: "💻 10. Application Desktop & Offline", icon: "💻" },
  { id: 11, name: "👨‍🏫 11. Espace Encadreurs & Institutions", icon: "👨‍🏫" },
  { id: 12, name: "💬 12. Messagerie Pédagogique", icon: "💬" },
  { id: 13, name: "⚙️ 13. Moteur IA Hybride", icon: "⚙️" },
  { id: 14, name: "📱 14. Application Smartphone & PWA", icon: "📱" },
  { id: 15, name: "📜 15. Droits & Licence CC", icon: "📜" },
];

export default function GuideModal({ isOpen, onClose, initialModule = 1 }: GuideModalProps) {
  const [activeModule, setActiveModule] = useState(initialModule);

  useEffect(() => {
    if (isOpen && initialModule) {
      setActiveModule(initialModule);
    }
  }, [initialModule, isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.titleIcon}>📖</div>
            <div>
              <h3 className={styles.title}>Manuel Utilisateur Officiel &amp; Guide de Prise en Main</h3>
              <p className={styles.subtitle}>Plateforme Académique Methodo&amp;Clinique — Version v{APP_VERSION} (Conforme Loi 18-11 Santé)</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Sidebar Modules */}
          <div className={styles.sidebar}>
            {MODULES.map((m) => (
              <button
                key={m.id}
                className={`${styles.moduleTab} ${activeModule === m.id ? styles.moduleTabActive : ''}`}
                onClick={() => setActiveModule(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className={styles.contentArea}>
            
            {/* CHAPITRE 1 */}
            {activeModule === 1 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🚀 Chapitre 1 : Page d&apos;Accueil, Connexion &amp; Demandes d&apos;Accès</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Guide de première prise en main, connexion sécurisée, demandes d&apos;accès et choix de formule.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.1. Présentation de la Plateforme &amp; Conformité Réglementaire</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité &amp; Rôle</div>
                      <p className={styles.cardText}>Point d&apos;entrée officiel assurant un cadre conforme aux exigences de la recherche médicale et à la Loi n° 18-11 relative à la santé (Algérie).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Interface &amp; Publics Cibles</div>
                      <p className={styles.cardText}>Accès adapté pour Résidents, Médecins, Enseignants-Chercheurs, Encadreurs de thèses et Institutions académiques/hospitalières.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.2. Connexion à votre Espace Utilisateur</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Entrez votre e-mail et mot de passe dans le formulaire.<br/>2. Cliquez sur &quot;Se connecter&quot; ou utilisez &quot;Se connecter avec Google&quot; pour un accès direct.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.3. Demander un Accès &amp; Choisir une Formule</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>💳 Formules d&apos;Accès</div>
                      <p className={styles.cardText}>PRO (Accès 30j), EXPERT (Accès Illimité), ULTRA (Encadreurs autonomes avec raccordement d&apos;étudiants), INSTITUTION (Universités &amp; CHU).</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 2 */}
            {activeModule === 2 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📊 Chapitre 2 : Tableau de Bord (Dashboard)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Vue d&apos;ensemble de la progression, protocoles récents, raccourcis et suivi des quotas.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>2.1. Indicateurs de Progression &amp; Quotas</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Statistiques Personnelles</div>
                      <p className={styles.cardText}>Affiche le taux de réussite aux Quiz, le nombre de protocoles générés, le statut d&apos;affiliation et les crédits d&apos;IA restants.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>📁 Protocoles Récents</div>
                      <p className={styles.cardText}>Accès rapide en 1-clic pour reprendre l&apos;édition d&apos;un protocole de recherche ou exporter son PDF officiel.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 3 */}
            {activeModule === 3 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🤖 Chapitre 3 : Tuteur Intelligent (3 Volets Détaillés)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Accompagnement méthodologique personnalisé, validation des 23 paramètres et transfert 1-clic.
                  </p>
                </div>

                <div className={styles.tutorFlowchart}>
                  <div className={styles.flowItem}>
                    <h5>💬 1. Discussion Libre</h5>
                    <p>Bioéthique, calculs NSN et conseils Loi 18-11.</p>
                  </div>
                  <div className={styles.flowItem}>
                    <h5>📄 2. Accompagnement Projet</h5>
                    <p>Validation des 23 paramètres canoniques.</p>
                  </div>
                  <div className={styles.flowItem}>
                    <h5>📜 3. Rédaction STROBE</h5>
                    <p>Structuration d&apos;articles observationnels.</p>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.1. Volet 1 : Discussion Libre &amp; Conseil Méthodologique</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>💬 Questions Ouvertes</div>
                      <p className={styles.cardText}>Posez n&apos;importe quelle question méthodologique (ex: choix entre étude transversale ou cas-témoins, considérations éthiques Loi 18-11, bais d&apos;appariement). L&apos;IA vous répond avec des explications académiques structurées.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.2. Volet 2 : Accompagnement Projet (23 Paramètres Canoniques)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Validation Pas-à-Pas</div>
                      <p className={styles.cardText}>Vous guide à travers la problématique, l&apos;objectif principal, l&apos;effectif NSN, les critères d&apos;inclusion/exclusion et le plan d&apos;analyse statistique.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🚀 Transfert 1-Clic vers le Générateur</div>
                      <p className={styles.cardText}>Une fois les 23 paramètres validés avec le tuteur, cliquez sur &quot;🚀 Transférer au Générateur&quot; pour injecter directement toutes vos données dans le modèle de protocole officiel.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.3. Volet 3 : Structuration &amp; Rédaction STROBE</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📜 Préparation de l&apos;Article Observationnel</div>
                      <p className={styles.cardText}>Aide à la formulation des 22 items de la grille STROBE (Contexte scientifique, biais, variables, limitations) en vue d&apos;une soumission à une revue médicale.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.4. Commandes Vocales (Dictée &amp; Synthèse)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>🎙️ Interaction Vocale Whisper</div>
                      <p className={styles.cardText}>Cliquez sur le microphone 🎙️ pour dicter votre question. Le tuteur retranscrit votre voix et lit la réponse à haute voix avec la synthèse vocale intégrée.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 4 */}
            {activeModule === 4 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📑 Chapitre 4 : Générateur de Protocoles &amp; Export PDF</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Renseignements des 23 paramètres, personnalisation de l&apos;en-tête et génération du cahier d&apos;observation (CRF).
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>4.1. Reprise Automatique du Profil dans l&apos;En-tête PDF</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 En-tête Certifié Auteur / Institution</div>
                      <p className={styles.cardText}>Vos coordonnées d&apos;auteur, profession et institution sont reprises automatiquement dans l&apos;en-tête officiel du document PDF généré.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>📋 Génération du CRF (Cahier d&apos;Observation)</div>
                      <p className={styles.cardText}>Générez en 1-clic le formulaire de recueil de données (CRF) adapté aux variables de votre protocole.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 5 */}
            {activeModule === 5 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🔬 Chapitre 5 : Recherche PubMed &amp; Synthèse IA</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Recherche bibliographique médicale, thésaurus MeSH, synthèse IA et transfert double 1-clic.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>5.1. Double Transfert 1-Clic vers Protocole ou Article</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>⚡ Utiliser dans mon Protocole</div>
                      <p className={styles.cardText}>Injecte la synthèse bibliographique PubMed dans l&apos;Onglet 2 (Rationnel Scientifique) de votre protocole clinique.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>📝 Utiliser dans Article STROBE (Critère 3)</div>
                      <p className={styles.cardText}>Injecte la synthèse directement dans l&apos;Onglet 2 (Contexte Scientifique / Item 3 STROBE) de votre projet d&apos;article.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 6 */}
            {activeModule === 6 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🧠 Chapitre 6 : Quiz &amp; Flashcards Interactifs</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Évaluation des connaissances méthodologiques et mémorisation espacée.
                  </p>
                </div>

                <div className={styles.timerBadge}>
                  <span>⏱️ RÈGLE DU CHRONOMÈTRE :</span>
                  <span>Le temps reste fixe à 00:00 et ne commence QU&apos;APRÈS votre clic explicite sur &quot;🚀 Démarrer le Quiz&quot;.</span>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>6.1. Déroulement du Quiz</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Thématiques Pédagogiques</div>
                      <p className={styles.cardText}>Biais de sélection, confusion, types d&apos;études, puissance statistique et conformité réglementaire.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 7 */}
            {activeModule === 7 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📈 Chapitre 7 : Rapport Pédagogique &amp; Bilan des Acquis</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Synthèse des compétences validées et fiche d&apos;évaluation pour encadrants.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>7.1. Génération du Bilan Pédagogique PDF</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📊 Bilan Académique</div>
                      <p className={styles.cardText}>Export d&apos;un rapport complet résumant la progression de l&apos;étudiant, les thèmes maîtrisés et les recommandations d&apos;approfondissement pour son encadreur.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 8 */}
            {activeModule === 8 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🧮 Chapitre 8 : Calculateur du Nombre de Sujets Nécessaires (NSN)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Calcul d&apos;effectif et génération automatique du texte de justification statistique.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>8.1. Calcul &amp; Justification en 1-Clic</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📋 Copie du Paragraphe Statistiquement Valide</div>
                      <p className={styles.cardText}>Sélectionnez l&apos;étude (moyennes, proportions, cas-témoins), entrez vos paramètres et cliquez sur &quot;Copier le texte de justification&quot; pour le coller directement dans votre protocole.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 9 */}
            {activeModule === 9 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>✍️ Chapitre 9 : Rédacteur d&apos;Articles STROBE</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Rédaction assistée selon les 22 critères de la grille internationale STROBE pour études observationnelles.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>9.1. Rédaction Structurée &amp; Export Word / PDF</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📜 Grille STROBE 22 Items</div>
                      <p className={styles.cardText}>Guide la rédaction du titre, du résumé, du contexte (Item 3), des méthodes, des résultats et de la discussion. Export direct au format document prêt à soumettre.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 10 */}
            {activeModule === 10 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>💻 Chapitre 10 : Application Desktop &amp; Gestion des Clés de Licence</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Installation de l&apos;exécutable autonome (Mac / Windows / Linux), clés de licence et mode 100% hors-ligne.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>10.1. Exécutables Autonomes (Mac .dmg / Windows .exe / Linux .AppImage)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🍎 Mac &amp; 🪟 Windows &amp; 🐧 Linux</div>
                      <p className={styles.cardText}>L&apos;application Desktop s&apos;exécute de façon autonome sans dépendre d&apos;un navigateur web ni d&apos;une connexion Internet permanente.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>10.2. Clé de Licence Hors-Ligne (Inclus Automatiquement)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚡ Génération Automatique</div>
                      <p className={styles.cardText}>Toute souscription génère et fournit automatiquement votre clé de licence dédiée sans aucun besoin d&apos;intervention manuelle.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 11 */}
            {activeModule === 11 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>👨‍🏫 Chapitre 11 : Espace Encadreurs, Institutions &amp; Suivi des Accès</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Raccordement des étudiants, supervision des protocoles, gestion des offres groupe et suivi des durées.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>11.1. Formules ULTRA (Encadreurs) &amp; INSTITUTION (Facultés/CHU)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>👑 Formule ULTRA (Encadreur Autonome)</div>
                      <p className={styles.cardText}>Permet aux enseignants d&apos;inscrire et superviser directement leurs étudiants avec leur Code d&apos;Affiliation personnel.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🏛️ Formule INSTITUTION</div>
                      <p className={styles.cardText}>Gestion centralisée des comptes enseignants et étudiants d&apos;une faculté ou d&apos;un service hospitalier.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>11.2. Suivi des Horaires, Accès &amp; Durées de Session (Tableau Admin)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>⏱️ Suivi en Temps Réel</div>
                      <p className={styles.cardText}>L&apos;onglet <strong>Accès &amp; Durées</strong> permet d&apos;analyser les dates de connexion, la plateforme utilisée (Web vs App Mac/Win/Linux) et le temps de travail effectif avec export CSV.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 12 */}
            {activeModule === 12 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>💬 Chapitre 12 : Messagerie Pédagogique &amp; Diffusion</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Échanges directs entre encadrants et étudiants, notifications et annonces d&apos;actualisation.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>12.1. Échanges Pédagogiques &amp; Annotaions de Protocoles</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>💬 Messagerie Interne</div>
                      <p className={styles.cardText}>Permet à l&apos;encadreur d&apos;envoyer des remarques et corrections directement sur les protocoles rédigés par ses résidents/étudiants.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 13 */}
            {activeModule === 13 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>⚙️ Chapitre 13 : Architecture du Moteur IA Hybride</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Fonctionnement des 3 niveaux de résilience réseau (Cloud &rarr; Local &rarr; Statique).
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>13.1. Cascade de Connectivité Tripro</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🟢 Mode Connecté (Gemini Cloud)</div>
                      <p className={styles.cardText}>Synthèse PubMed en direct et puissance maximale quand Internet est disponible.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🟡 Mode Déconnecté (Ollama Local)</div>
                      <p className={styles.cardText}>Basculement automatique sur le modèle local (127.0.0.1:11434) sans interruption de travail.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>🔵 Base Statique Embarquée</div>
                      <p className={styles.cardText}>Repli ultime sur la base de connaissances RECIF intégrée dans l&apos;application pour un fonctionnement garanti 24h/24.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 14 */}
            {activeModule === 14 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📱 Chapitre 14 : Application Smartphone &amp; PWA Mobile</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Installation de Methodo&amp;Clinique sur écran d&apos;accueil iPhone (Safari) et Android (Chrome).
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>14.1. Installation sur iPhone &amp; iPad (Safari)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🍎 Procédure iOS</div>
                      <p className={styles.cardText}>1. Ouvrez le site dans <strong>Safari</strong>.<br/>2. Touchez le bouton de partage <strong>[⎋]</strong> en bas.<br/>3. Sélectionnez <strong>« Sur l&apos;écran d&apos;accueil »</strong> puis <strong>Ajouter</strong>.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>14.2. Installation sur Smartphone Android (Chrome)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🤖 Procédure Android 1-Clic</div>
                      <p className={styles.cardText}>1. Ouvrez le site dans <strong>Google Chrome</strong>.<br/>2. Cliquez sur le bouton <strong>« Installer l&apos;application »</strong> dans la bannière 1-Clic au bas de l&apos;écran.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 15 */}
            {activeModule === 15 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📜 Chapitre 15 : Propriété Intellectuelle &amp; Licence Creative Commons</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Répartition des droits d&apos;auteur, sources documentaires et conditions d&apos;utilisation.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>15.1. Protection du Logiciel &amp; Licences de Contenu</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>💻 Logiciel &amp; Code Source</div>
                      <p className={styles.cardText}><strong>© 2026 Methodo&amp;Clinique. Tous droits réservés.</strong> La plateforme, l&apos;interface, l&apos;architecture et la logique RAG sont la propriété exclusive de l&apos;auteur.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>📚 Sources &amp; Référentiels Officiels</div>
                      <p className={styles.cardText}>La grille STROBE, l&apos;ICMJE, la Loi 18-11 et le Manuel RECIF sont des standards et lois officielles exploités à des fins d&apos;analyse RAG et de citation.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>🎓 Licence CC BY-NC-SA 4.0</div>
                      <p className={styles.cardText}>Les contenus et fiches pédagogiques générés par l&apos;IA sont libres pour l&apos;étude et la recherche personnelle (usage non commercial avec citation obligatoire de l&apos;auteur).</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
