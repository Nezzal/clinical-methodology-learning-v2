'use client';

import React, { useState } from 'react';
import styles from './GuideModal.module.css';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODULES = [
  { id: 1, name: "🚀 1. Page d'Accueil & Connexion", icon: "🚀" },
  { id: 2, name: "📊 2. Tableau de Bord (Dashboard)", icon: "📊" },
  { id: 3, name: "🤖 3. Tuteur RECIF (3 Volets)", icon: "🤖" },
  { id: 4, name: "📑 4. Générateur de Protocoles", icon: "📑" },
  { id: 5, name: "🔬 5. Recherche PubMed & Synthèse", icon: "🔬" },
  { id: 6, name: "🧠 6. Quiz & Timer", icon: "🧠" },
  { id: 7, name: "📈 7. Rapport Pédagogique", icon: "📈" },
  { id: 8, name: "🧮 8. Calculateur NSN", icon: "🧮" },
  { id: 9, name: "✍️ 9. Rédacteur STROBE", icon: "✍️" },
  { id: 10, name: "💻 10. Application Desktop & Offline", icon: "💻" },
  { id: 11, name: "👨‍🏫 11. Espace Superviseur", icon: "👨‍🏫" },
  { id: 12, name: "💬 12. Messagerie Pédagogique", icon: "💬" },
  { id: 13, name: "⚙️ 13. Moteur IA Hybride", icon: "⚙️" },
];

export default function GuideModal({ isOpen, onClose }: GuideModalProps) {
  const [activeModule, setActiveModule] = useState(1);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.titleIcon}>📖</div>
            <div>
              <h3 className={styles.title}>Manuel Utilisateur Officiel & Guide de Prise en Main</h3>
              <p className={styles.subtitle}>Plateforme Académique PedagogiAfrica / RECIF — Version v1.8.8 (Conforme Loi 18-11 Santé)</p>
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
            {activeModule === 1 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🚀 Chapitre 1 : Page d&apos;Accueil, Connexion & Demandes d&apos;Accès</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Guide de première prise en main, connexion sécurisée, demandes d&apos;accès et activation hors-ligne.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.1. Présentation de la Plateforme & Conformité Réglementaire</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité & Rôle</div>
                      <p className={styles.cardText}>Point d&apos;entrée officiel assurant un cadre conforme aux exigences de la recherche médicale et à la Loi n° 18-11 relative à la santé (Algérie).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Fonctionnalités & Interface</div>
                      <p className={styles.cardText}>Panneau de conformité, grille 2x2 des 4 piliers fonctionnels (Tuteur, Générateur, NSN/Quiz, STROBE) et tags du public cible (Résidents, Médecins, Chercheurs, Enseignants, Étudiants).</p>
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
                  <h4 className={styles.subTitle}>1.3. Réinitialiser un Mot de Passe Oublié</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Permet de réinitialiser votre mot de passe et de récupérer l&apos;accès à votre compte en toute sécurité.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Cliquez sur &quot;Mot de passe oublié ?&quot;.<br/>2. Saisissez votre e-mail et cliquez sur &quot;Envoyer le lien&quot;.<br/>3. Cliquez sur le bouton dans le mail reçu pour définir votre nouveau mot de passe.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.4. Demander un Accès & Choisir une Formule</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Cliquez sur &quot;✨ Demander un Accès / Voir les Formules&quot;.<br/>2. Choisissez votre rôle (Étudiant ou Enseignant).<br/>3. Sélectionnez votre formule (Découverte 3j gratuit, Pro, Expert, Ultra, Institution).<br/>4. Remplissez vos coordonnées et validez.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 3 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🤖 Chapitre 3 : Tuteur Intelligent RECIF (3 Volets)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Accompagnement méthodologique personnalisé, validation des 23 paramètres et transfert 1-clic.
                  </p>
                </div>

                <div className={styles.tutorFlowchart}>
                  <div className={styles.flowItem}>
                    <h5>💬 1. Discussion Libre</h5>
                    <p>Questions libres, calculs NSN et conseils réglementaires Loi 18-11.</p>
                  </div>
                  <div className={styles.flowItem}>
                    <h5>📄 2. Accompagnement Projet</h5>
                    <p>Validation pas-à-pas des 23 paramètres canoniques RECIF.</p>
                  </div>
                  <div className={styles.flowItem}>
                    <h5>📜 3. Rédaction STROBE</h5>
                    <p>Structuration d&apos;articles observationnels pour publication.</p>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.2. Volet 2 : Accompagnement Projet (23 Paramètres RECIF)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité & Rôle</div>
                      <p className={styles.cardText}>Vous guide pas-à-pas pour concevoir un protocole clinique complet et valider l&apos;ensemble des 23 paramètres obligatoires.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Cliquez sur &quot;Accompagnement Projet&quot;.<br/>2. Répondez aux questions du tuteur pour définir la problématique, les objectifs et la méthode.<br/>3. Suivez la jauge de progression.<br/>4. Une fois validé, cliquez sur &quot;🚀 Transférer au Générateur&quot; pour l&apos;export PDF.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.4. Option Commande Vocale (Dictée & Synthèse)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>💡 Interaction Vocale</div>
                      <p className={styles.cardText}>Cliquez sur l&apos;icône Microphone 🎙️ pour dicter votre question à l&apos;oral. Le tuteur retranscrit votre voix et lit la réponse à haute voix.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 6 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🧠 Chapitre 6 : Quiz & Flashcards Interactifs</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Évaluation des connaissances méthodologiques et mémorisation espacée.
                  </p>
                </div>

                <div className={styles.timerBadge}>
                  <span>⏱️ RÈGLE DU CHRONOMÈTRE :</span>
                  <span>Le temps reste fixe à 00:00 et ne commence QU&apos;APRÈS votre clic explicite sur &quot;🚀 Démarrer le Quiz&quot;.</span>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>6.1. Démarrer une Session de Quiz</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Évaluez vos compétences sur les pièges de la recherche (biais de sélection, classement, confusion, puissance statistique).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Choisissez une thématique.<br/>2. Lisez les instructions en toute sérénité (le chrono est sur pause à 00:00).<br/>3. Cliquez sur &quot;🚀 Démarrer le Quiz&quot; pour lancer le chronomètre.<br/>4. Répondez aux questions et lisez les explications immédiates.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 8 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🧮 Chapitre 8 : Calculateur du Nombre de Sujets Nécessaires (NSN)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Calcul d&apos;effectif et génération automatique du texte de justification statistique.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>8.1. Calcul & Justification en 1-Clic</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité</div>
                      <p className={styles.cardText}>Détermine le nombre de sujets requis pour obtenir une étude statistiquement valide et conforme aux exigences des comités d&apos;éthique.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Sélectionnez le type d&apos;étude (proportions, moyennes, cohorte, cas-témoins).<br/>2. Entrez vos valeurs (p1, p2, alpha 5%, puissance 80%).<br/>3. Cliquez sur &quot;Calculer le NSN&quot;.<br/>4. Cliquez sur &quot;📋 Copier le texte de justification&quot; pour le coller directement dans votre protocole.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 13 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>⚙️ Chapitre 13 : Architecture du Moteur IA Hybride</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Fonctionnement automatique des 3 niveaux de résilience réseau.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>13.1. Cascade de Connectivité Tripro</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🟢 Mode Connecté (Gemini Cloud)</div>
                      <p className={styles.cardText}>Puissance maximale et synthèse PubMed en direct lorsque la connexion Internet est active.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🟡 Mode Déconnecté (Ollama Local)</div>
                      <p className={styles.cardText}>Basculement automatique sur le modèle local (127.0.0.1:11434) sans interruption si Internet est indisponible.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>🔵 Base Statique Embarquée</div>
                      <p className={styles.cardText}>Repli ultime sur la base de connaissances RECIF intégrée dans le binaire pour un fonctionnement garanti 24h/24.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {![1, 3, 6, 8, 13].includes(activeModule) && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>{MODULES.find(m => m.id === activeModule)?.name}</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Guide d&apos;utilisation pas-à-pas et procédure de prise en main pour ce module.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>Procédure de Prise en Main Pas-à-Pas</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité & Rôle</div>
                      <p className={styles.cardText}>Fournit les outils méthodologiques conformes aux exigences académiques de la charte RECIF et à la réglementation sanitaire.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Procédure Pas-à-Pas</div>
                      <p className={styles.cardText}>1. Sélectionnez le module dans la barre latérale.<br/>2. Complétez les champs ou effectuez vos choix.<br/>3. Validez l&apos;action pour obtenir l&apos;analyse ou l&apos;exportation désirée.</p>
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
