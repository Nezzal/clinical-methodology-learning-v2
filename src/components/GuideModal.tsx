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
              <h3 className={styles.title}>Guide d&apos;Utilisation Officiel & Scripts Vidéo</h3>
              <p className={styles.subtitle}>Plateforme Académique PedagogiAfrica / RECIF — Version v1.8.8 (Loi 18-11 Santé)</p>
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
                  <h2 className={styles.moduleTitle}>🚀 Module 1 : Page d&apos;Accueil & Authentification</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Guide de première prise en main, connexion, demande d&apos;accès et activation de la licence hors-ligne.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.1. Présentation de la Page d&apos;Accueil & Conformité</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🎬 Action à l&apos;écran</div>
                      <p className={styles.cardText}>Ouverture de l&apos;application (/login). Balayage du panneau de présentation à gauche avec le badge de conformité Loi 18-11 et la grille 2x2 des modules.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🗣️ Voix-off / Explication</div>
                      <p className={styles.cardText}>Bienvenue sur PedagogiAfrica RECIF. L&apos;interface d&apos;accueil vous présente la conformité à la Loi n° 18-11 Santé en Algérie, les 4 piliers fonctionnels et le public cible (résidents, médecins, chercheurs, enseignants).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>💡 Astuce</div>
                      <p className={styles.cardText}>Vérifiez la version v1.8.8 et le NIF officiel 15007180115910202380 en bas de page.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.3. Réinitialisation de Mot de Passe (&quot;Mot de passe oublié ?&quot;)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🎬 Action à l&apos;écran</div>
                      <p className={styles.cardText}>Clic sur &quot;Mot de passe oublié ?&quot;, saisie de l&apos;e-mail et clic sur &quot;Envoyer le lien&quot;.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🗣️ Voix-off / Explication</div>
                      <p className={styles.cardText}>Entrez votre adresse e-mail. Notre serveur SMTP vous envoie un e-mail officiel PedagogiAfrica contenant un bouton sécurisé pour réinitialiser votre mot de passe en 1 clic.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 3 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🤖 Module 3 : Tuteur Intelligent RECIF (3 Volets)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Exploration des 3 volets de travail, des commandes vocales et du transfert 1-clic.
                  </p>
                </div>

                <div className={styles.tutorFlowchart}>
                  <div className={styles.flowItem}>
                    <h5>💬 1. Discussion Libre</h5>
                    <p>Questions méthodologiques, calculs NSN rapides et réglementation.</p>
                  </div>
                  <div className={styles.flowItem}>
                    <h5>📄 2. Accompagnement Projet</h5>
                    <p>Validation pas-à-pas des 23 paramètres canoniques RECIF.</p>
                  </div>
                  <div className={styles.flowItem}>
                    <h5>📜 3. Rédaction STROBE</h5>
                    <p>Préparation d&apos;articles observationnels pour publication.</p>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.2. Volet 2 : Accompagnement Projet (23 Paramètres RECIF)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🎬 Action à l&apos;écran</div>
                      <p className={styles.cardText}>Clic sur la carte &quot;Accompagnement Projet&quot;. Déroulement du questionnaire guidé et validation des 23 paramètres avec jauge de progression.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🗣️ Voix-off / Explication</div>
                      <p className={styles.cardText}>Le tuteur vous interroge pas à pas pour construire votre projet d&apos;étude et valide successivement les 23 paramètres méthodologiques requis par la charte RECIF.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>💡 Bouton 1-Clic</div>
                      <p className={styles.cardText}>Une fois validé, cliquez sur &quot;🚀 Transférer les 23 paramètres au Générateur&quot; pour exporter votre PDF officiel.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 6 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🧠 Module 6 : Quiz & Flashcards Interactifs</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Maîtrise des biais de recherche, puissance statistique et répétition espacée.
                  </p>
                </div>

                <div className={styles.timerBadge}>
                  <span>⏱️ REGLE DE CHRONOMÈTRE :</span>
                  <span>Le décompte reste bloqué à 00:00 et ne démarre QU&apos;APRÈS votre clic sur &quot;🚀 Démarrer le Quiz&quot;.</span>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>6.2. Démarrage du Quiz & Gestion du Timer</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🎬 Action à l&apos;écran</div>
                      <p className={styles.cardText}>Affichage des consignes avec le chrono à 00:00 (Pause). Clic sur &quot;🚀 Démarrer le Quiz&quot;. Le décompte commence (00:01, 00:02...).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🗣️ Voix-off / Explication</div>
                      <p className={styles.cardText}>Ne paniquez pas devant le chronomètre ! Le temps ne commence jamais automatiquement à l&apos;ouverture. Prenez votre temps pour lire les instructions. Le temps ne se déclenche qu&apos;au moment exact où vous cliquez sur &quot;Démarrer le Quiz&quot;.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 8 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🧮 Module 8 : Calculateur du Nombre de Sujets Nécessaires (NSN)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Calcul exact de taille d&apos;échantillon et génération de justification statistique.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>8.3. Calcul et Justification Copiable en 1-Clic</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🎬 Action à l&apos;écran</div>
                      <p className={styles.cardText}>Saisie des proportions (30% vs 50%), risque alpha = 5%, puissance = 80%. Clic sur &quot;Calculer le NSN&quot; puis sur &quot;📋 Copier le texte de justification&quot;.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🗣️ Voix-off / Explication</div>
                      <p className={styles.cardText}>Entrez vos hypothèses et cliquez sur Calculer. Un paragraphe académique complet est généré et copié dans votre presse-papier, prêt à être collé dans votre protocole.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 13 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>⚙️ Module 13 : Moteur IA Hybride (Cascade Tripro)</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Architecture de résilience réseau (Cloud Gemini, Ollama Local et Base Statique).
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>13.3. Cascade de Résilience Réseau</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🎬 Action à l&apos;écran</div>
                      <p className={styles.cardText}>Schéma des 3 niveaux : 1. Cloud Gemini (En ligne), 2. Ollama Local 127.0.0.1:11434 (Hors-ligne), 3. Base Statique RECIF (Repli ultime).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🗣️ Voix-off / Explication</div>
                      <p className={styles.cardText}>L&apos;application garantit un fonctionnement ininterrompu. Si vous perdez votre connexion Internet, elle bascule automatiquement sur votre modèle local Ollama ou sur la base statique intégrée.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tous les autres modules de 2 a 12 de maniere synthetique */}
            {![1, 3, 6, 8, 13].includes(activeModule) && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>{MODULES.find(m => m.id === activeModule)?.name}</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Guide d&apos;utilisation pas-à-pas et script de démonstration vidéo pour ce module.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>Déroulement Fonctionnel Pas-à-Pas</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🎬 Action à l&apos;écran</div>
                      <p className={styles.cardText}>Sélection du module dans la barre latérale, configuration des paramètres et clic sur le bouton de déclenchement principal.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🗣️ Voix-off / Explication</div>
                      <p className={styles.cardText}>Utilisez les fonctionnalités avancées conformes à la charte méthodologique RECIF et aux exigences de la Loi 18-11 Santé.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>💡 Export & Sauvegarde</div>
                      <p className={styles.cardText}>Tous vos documents peuvent être exportés au format PDF officiel A4 ou sauvegardés dans votre profil académique.</p>
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
