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
  { id: 14, name: "📜 14. Droits & Licence CC", icon: "📜" },
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
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Permet d&apos;accéder à votre tableau de bord personnel, vos protocoles sauvegardés et vos quotas d&apos;utilisation.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Entrez votre e-mail et mot de passe dans le formulaire.<br/>2. Cliquez sur &quot;Se connecter&quot; ou utilisez &quot;Se connecter avec Google&quot; pour un accès direct.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.3. Demander un Accès &amp; Choisir une Formule (PRO, EXPERT, ULTRA, INSTITUTION)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Cliquez sur &quot;✨ Demander un Accès / Voir les Formules&quot;.<br/>2. Parcourez les 4 formules d&apos;accès (PRO &amp; EXPERT pour l&apos;utilisation individuelle, ULTRA pour les Encadreurs autonomes, et INSTITUTION pour les facultés/CHU).<br/>3. Remplissez vos coordonnées et validez votre demande.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 2 */}
            {activeModule === 2 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📊 Chapitre 2 : Tableau de Bord &amp; Navigation</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Vue d&apos;ensemble des fonctionnalités, suivi de progression et accès rapide aux outils.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>2.1. Cartes de Progression &amp; Quotas</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Vue d&apos;ensemble</div>
                      <p className={styles.cardText}>Visualisez en temps réel le nombre de protocoles rédigés, vos statistiques de quiz et vos crédits d&apos;analyse IA.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 3 */}
            {activeModule === 3 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🤖 Chapitre 3 : Tuteur Intelligent RECIF (3 Volets)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Accompagnement méthodologique personnalisé, validation des 23 paramètres et transfert 1-clic.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.1. Volet 1 : Discussion Libre</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Posez toutes vos questions sur la méthodologie de recherche, les critères de jugement et la réglementation sanitaire (Loi 18-11).</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.2. Volet 2 : Accompagnement Projet (23 Paramètres RECIF)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité &amp; Rôle</div>
                      <p className={styles.cardText}>Vous guide pas-à-pas pour concevoir un protocole clinique complet et valider l&apos;ensemble des 23 paramètres obligatoires.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 4 */}
            {activeModule === 4 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📑 Chapitre 4 : Générateur de Protocoles &amp; Export PDF Officiel</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Génération interactive, personnalisation automatique de l&apos;en-tête utilisateur et export PDF officiel.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>4.1. Reprise Automatique du Profil dans l&apos;En-tête PDF</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 En-tête Officiel Certifié</div>
                      <p className={styles.cardText}>Vos informations d&apos;institution et de profession sont automatiquement reprises dans l&apos;en-tête de vos protocoles cliniques et de vos cahiers d&apos;observation (CRF).</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 5 */}
            {activeModule === 5 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🔬 Chapitre 5 : Recherche PubMed &amp; Synthèse Bibliographique</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Recherche bibliographique automatisée sur PubMed et synthèse probante de la littérature.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>5.1. Recherche &amp; Synthèse en Direct</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Interroge la base PubMed de la NLM et génère une synthèse critique des récents articles publiés sur votre thématique.</p>
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

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>6.1. Démarrer une Session de Quiz</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Évaluez vos compétences sur les pièges de la recherche (biais de sélection, classement, confusion, puissance statistique).</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 7 */}
            {activeModule === 7 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>📈 Chapitre 7 : Rapport Pédagogique Synthétique</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Génération automatique du bilan de compétences méthodologiques pour l&apos;étudiant et l&apos;encadreur.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>7.1. Bilan &amp; Exportation</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Récapitule le parcours d&apos;apprentissage, les quiz validés et les compétences méthodologiques acquises.</p>
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
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Détermine le nombre de sujets requis pour obtenir une étude statistiquement valide et conforme aux exigences des comités d&apos;éthique.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 9 */}
            {activeModule === 9 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>✍️ Chapitre 9 : Rédacteur STROBE &amp; Rédaction d&apos;Articles</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Assistance à la rédaction d&apos;articles observationnels selon la déclaration internationale STROBE.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>9.1. Structuration d&apos;Articles STROBE</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Guide la rédaction des sections Introduction, Méthodes, Résultats et Discussion pour les revues scientifiques de rang A.</p>
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
                    Installation de l&apos;exécutable autonome (Mac / Windows), génération automatique et validation des clés de licence.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>10.1. Téléchargement &amp; Installation de l&apos;Exécutable</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🍎 Mac (.dmg), 💻 Windows (.exe) &amp; 🐧 Linux (.AppImage / .deb)</div>
                      <p className={styles.cardText}>L&apos;application Desktop (disponible pour macOS, Windows et Linux) s&apos;exécute de façon totalement autonome sans dépendre d&apos;un navigateur web ni d&apos;une connexion Internet permanente.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>10.2. Clé de Licence Autonome (Inclus Automatiquement)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚡ Génération Automatique</div>
                      <p className={styles.cardText}>Toute souscription à une formule (PRO, EXPERT, ULTRA) génère et fournit automatiquement votre clé de licence dédiée sans aucun besoin d&apos;intervention de l&apos;administrateur.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 11 */}
            {activeModule === 11 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>👨‍🏫 Chapitre 11 : Espace Encadreurs &amp; Institutions (Supervision)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Architecture des accès encadrants, raccordement des étudiants et gouvernance académique.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>11.1. Modèle d&apos;Accès Encadreur &amp; Formules</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>👑 Formule ULTRA (Encadreur Autonome)</div>
                      <p className={styles.cardText}>Réservée aux enseignants et praticiens souhaitant inscrire, raccorder et superviser directement leurs propres étudiants avec leur Code d&apos;Affiliation.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🏛️ Formule INSTITUTION (Facultés, CHU)</div>
                      <p className={styles.cardText}>L&apos;Administrateur de l&apos;établissement crée et affecte les comptes Enseignants ainsi que les étudiants qui leur sont attribués.</p>
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
                  <h4 className={styles.subTitle}>12.1. Échanges Pédagogiques &amp; Annotations de Protocoles</h4>
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
                  <h2 className={styles.moduleTitle}>📜 Chapitre 14 : Propriété Intellectuelle &amp; Licence Creative Commons</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Répartition des droits d&apos;auteur, sources documentaires et conditions d&apos;utilisation.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>14.1. Protection du Logiciel &amp; Licences de Contenu</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>💻 Logiciel &amp; Code Source</div>
                      <p className={styles.cardText}><strong>© 2026 Methodo&amp;Clinique. Tous droits réservés.</strong> La plateforme, l&apos;interface, l&apos;architecture et la logique RAG sont la propriété exclusive et protégée de l&apos;auteur.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>📚 Sources &amp; Référentiels Officiels</div>
                      <p className={styles.cardText}>Les documents et lois de référence (Manuel du RECIF, Loi n° 18-11 relative à la santé, Lignes Directrices pour la Conduite des Études Cliniques en Algérie - MSPRH, grilles STROBE/ICMJE) demeurent la propriété exclusive de leurs institutions émettrices respectives et sont exploités à des fins d&apos;analyse RAG et de citation.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>🎓 Propriété des Résultats Utilisateurs &amp; Licence CC BY-NC-SA 4.0</div>
                      <p className={styles.cardText}>Les résultats de recherche, protocoles, fiches et données générés par les utilisateurs <strong>leur appartiennent en toute exclusivité</strong> et ils sont 100% libres de les exploiter pour tous leurs travaux académiques, mémoires, thèses ou publications. Les fiches pédagogiques de formation sont sous licence <strong>Creative Commons CC BY-NC-SA 4.0</strong> (Attribution - Pas d&apos;Utilisation Commerciale - Partage dans les Mêmes Conditions).</p>
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
