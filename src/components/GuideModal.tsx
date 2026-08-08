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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a
              href="/docs/Manuel_Utilisateur_Officiel_MethodoClinique_v2.0.6.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 3px 10px rgba(2, 132, 199, 0.35)'
              }}
              title="Ouvrir et imprimer / sauvegarder le Manuel Officiel de Référence Complet en PDF"
            >
              📥 Télécharger le Manuel Complet (PDF)
            </a>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
          </div>
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
                  <h2 className={styles.moduleTitle}>🚀 Chapitre 1 : Page d&apos;Accueil, Connexion, Formules &amp; Paiement BaridiMob</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                    Guide complet de première prise en main, modes de connexion, grilles tarifaires régionales et règlement BaridiMob.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.1. Présentation &amp; Cadre Réglementaire (Loi 18-11 Santé)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité &amp; Conformité</div>
                      <p className={styles.cardText}>Point d&apos;entrée officiel assurant un cadre méthodologique strict conforme au manuel Methodo&amp;Clinique et à la Loi n° 18-11 relative à la santé (Algérie).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚙️ Publics Cibles</div>
                      <p className={styles.cardText}>Accès personnalisé pour Résidents, Doctorants, Praticiens-Chercheurs, Enseignants-Encadreurs et Institutions (Facultés &amp; CHU).</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.2. Modes de Connexion (En Ligne vs Licence Hors-Ligne)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🌐 Connexion en Ligne</div>
                      <p className={styles.cardText}>Connectez-vous avec votre e-mail et mot de passe ou directement en 1-clic via &quot;Se connecter avec Google&quot;.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🔑 Licence Autonome Hors-Ligne</div>
                      <p className={styles.cardText}>Pour les utilisateurs des applications Mac, Windows et Linux travaillant sans réseau Internet, activez votre application autonome à l&apos;aide de votre clé de licence dédiée.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.3. Sélection de la Zone Régionale de Résidence</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>🌍 3 Zones Géographiques Tarifaires</div>
                      <p className={styles.cardText}>
                        1. <strong>🇩🇿 Zone Algérie (DZD / DA) :</strong> Tarifs régionaux préférentiels et paiement direct par virement BaridiMob (RIP).<br/>
                        2. <strong>🌍 Zone Afrique Hors-Algérie (€ / FCFA) :</strong> Tarifs adaptés à la zone subsaharienne et Maghreb (PayPal, Western Union).<br/>
                        3. <strong>🇪🇺/🇨🇦 Zone Europe &amp; Occident (€ / $) :</strong> Règlement par Carte Bancaire internationale, Virement SEPA/SWIFT ou PayPal.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.4. Grille Complète des 5 Formules d&apos;Accès</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🟢 Formule Découverte (Gratuit 3 jours)</div>
                      <p className={styles.cardText}>Accès automatique à l&apos;inscription pour tester les fonctionnalités de base (5 Q/jour IA, 1 protocole démo, 1 article STROBE démo).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🔷 Formule PRO (1 500 DZD/mois)</div>
                      <p className={styles.cardText}>Idéale pour Internes, Résidents et Doctorants (100 Q/jour IA, Calculateur NSN illimité, Quiz/Flashcards illimités, 5 protocoles/mois et 5 articles STROBE/mois sans filigrane).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>⚡ Formule EXPERT (3 500 DZD/mois)</div>
                      <p className={styles.cardText}>Conçue pour Chercheurs &amp; Praticiens Solo (Accès 100% ILLIMITÉ pour protocoles, synthèses PubMed, tuteur IA et exports PDF HD propres sans filigrane).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>👑 Formule ULTRA (3 500 DZD/mois + Encadrement)</div>
                      <p className={styles.cardText}>Destinée aux Enseignants &amp; Encadreurs (Accès illimité + Espace de supervision d&apos;étudiants + Messagerie interne d&apos;encadrement + Raccordement direct par Code Affiliation).</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🏛️ Formule INSTITUTION (Sur Devis)</div>
                      <p className={styles.cardText}>Sur mesure pour Facultés de Médecine, CHU et Laboratoires (Accès multi-sièges établissement, Tableau de bord Doyen/Chef de service, Logo institutionnel personnalisé sur les PDF).</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>1.5. Procédure de Règlement BaridiMob &amp; Transmission de Reçu (Algérie)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>💳 Coordonnées Officielles BaridiMob</div>
                      <p className={styles.cardText}>
                        • <strong>RIP BaridiMob :</strong> <code style={{ color: '#2dd4bf', background: 'rgba(45, 212, 191, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>00799999000041210947</code><br/>
                        • <strong>Titulaire du compte :</strong> Professeur Nezzal Abdelmalek<br/>
                        • <strong>NIF Fiscal :</strong> 15007180115910202380
                      </p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📩 Transmission du Reçu &amp; Activation Instantanée</div>
                      <p className={styles.cardText}>
                        1. Effectuez votre virement sur l&apos;application BaridiMob vers le RIP ci-dessus.<br/>
                        2. Saisissez votre e-mail de compte et le N° de transaction.<br/>
                        3. Joignez la photo de votre reçu (JPG, PNG, WebP) puis cliquez sur <strong>&quot;📩 Transmettre le Reçu et la Photo&quot;</strong>.<br/>
                        4. Dès validation, votre accès s&apos;active immédiatement avec des jours bonus offerts (+7j Pro / +14j Ultra) !
                      </p>
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
                  <h4 className={styles.subTitle}>2.1. Cartes de Progression, Quotas &amp; Actions Rapides</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Statistiques &amp; Compteurs en Direct</div>
                      <p className={styles.cardText}>Visualisez en temps réel vos 4 indicateurs clés : le nombre de questions posées au Tuteur Methodo&amp;Clinique, les protocoles cliniques générés, le pourcentage de réussite aux Quiz et le taux de maîtrise des Flashcards.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>⚡ Boutons d&apos;Action Rapide</div>
                      <p className={styles.cardText}>Accédez directement en 1 clic à la création d&apos;un nouveau protocole, au lancement d&apos;une session de quiz ou à la révision de vos cartes mémoires.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>2.2. Parcours &amp; Rapport de Suivi Pédagogique IA</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>🎓 Bilan Pédagogique Automatisé</div>
                      <p className={styles.cardText}>Consultez votre synthèse globale générée par l&apos;IA qui évalue vos compétences méthodologiques en analysant vos résultats et la rigueur de vos travaux.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>2.3. Historique des Protocoles Récents</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📂 Accès Immédiat aux Travaux</div>
                      <p className={styles.cardText}>Retrouvez la liste chronologique de vos derniers protocoles rédigés et ouvrez-les directement en 1-clic pour consultation, édition ou réexport PDF.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>2.4. Module Rédacteur STROBE &amp; Gouvernance Académique</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>✍️ Rédaction STROBE &amp; Superviseur</div>
                      <p className={styles.cardText}>Lancez le rédacteur d&apos;articles scientifiques selon les normes internationales STROBE et consultez la fiche de gouvernance du Superviseur Scientifique (Pr Nezzal Abdelmalek).</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPITRE 3 */}
            {activeModule === 3 && (
              <div>
                <div className={styles.moduleHeader}>
                  <h2 className={styles.moduleTitle}>🤖 Chapitre 3 : Tuteur Intelligent Methodo&amp;Clinique (3 Volets)</h2>
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
                  <h4 className={styles.subTitle}>3.2. Volet 2 : Accompagnement Projet (23 Paramètres Methodo&amp;Clinique)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité &amp; Rôle</div>
                      <p className={styles.cardText}>Vous guide pas-à-pas pour concevoir un protocole clinique complet et valider l&apos;ensemble des 23 paramètres obligatoires.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>3.3. Volet 3 : Rédaction d&apos;Article (STROBE)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>📌 Utilité &amp; Rôle</div>
                      <p className={styles.cardText}>Préparez votre article scientifique selon les critères de la grille internationale STROBE. Idéal pour structurer vos résultats observationnels (cohortes, cas-témoins, transversales) et les exporter pour publication.</p>
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
                    Architecture des accès encadrants, raccordement des étudiants, traçabilité et gouvernance académique.
                  </p>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>11.1. Modèles d&apos;Accès Encadreur &amp; Offres (ULTRA &amp; INSTITUTION)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>👑 Formule ULTRA (Encadreur Autonome)</div>
                      <p className={styles.cardText}>Réservée aux enseignants, professeurs et praticiens souhaitant inscrire, raccorder et superviser directement leurs propres étudiants/résidents via leur <strong>Code d&apos;Affiliation</strong> unique.</p>
                    </div>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🏛️ Formule INSTITUTION (Facultés de Médecine, CHU)</div>
                      <p className={styles.cardText}>L&apos;Administrateur de l&apos;établissement déploie des accès multi-sièges, attribue les comptes Enseignants et gère le tableau de bord Doyen / Chef de service avec personnalisation du logo sur les PDF.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>11.2. Tableau de Bord Global de Supervision &amp; Onglets d&apos;Administration</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowTip}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelTip}`}>📊 5 Onglets de Gestion Centrale</div>
                      <p className={styles.cardText}>
                        • <strong>Utilisateurs inscrits :</strong> Vue globale avec recherche par nom/e-mail, tri alphabétique/formule, export CSV (Excel) et nettoyage des comptes.<br/>
                        • <strong>Demandes Indiv. :</strong> Validation et activation en 1-clic des demandes individuelles en attente.<br/>
                        • <strong>Groupes &amp; Devis :</strong> Gestion des effectifs groupés et devis d&apos;établissement.<br/>
                        • <strong>Messagerie :</strong> Canal de communication pédagogique directe avec les étudiants.<br/>
                        • <strong>📜 Journal des Accès :</strong> Suivi des connexions du jour et historique complet.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>11.3. Fiche Pédagogique Individuelle de l&apos;Étudiant (7 Onglets Détaillés)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowAction}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelAction}`}>🔍 Traçabilité Globale de l&apos;Apprenant</div>
                      <p className={styles.cardText}>
                        1. <strong>Stats :</strong> Compteurs d&apos;activités (questions tuteur, protocoles, scores quiz, flashcards) + options de suspension/suppression.<br/>
                        2. <strong>👤 Fiche Profil :</strong> Informations académiques, grade, établissement et statut d&apos;abonnement.<br/>
                        3. <strong>Protocoles &amp; Articles :</strong> Consultation et révision des protocoles Methodo&amp;Clinique et articles STROBE rédigés par l&apos;étudiant.<br/>
                        4. <strong>Tuteur &amp; Bilan IA :</strong> Consultation de l&apos;historique des questions posées au tuteur et génération du rapport de compétences automatisé.<br/>
                        5. <strong>📜 Accès :</strong> Traçabilité nominative des connexions de l&apos;étudiant (dates, heures, durées et total cumulé en minutes).
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subSection}>
                  <h4 className={styles.subTitle}>11.4. Journal des Accès &amp; Sessions en Temps Réel (Live)</h4>
                  <div className={styles.itemBlock}>
                    <div className={`${styles.cardRow} ${styles.cardRowVoice}`}>
                      <div className={`${styles.cardLabel} ${styles.cardLabelVoice}`}>🟢 Suivi Live &amp; Filtres Temporels</div>
                      <p className={styles.cardText}>
                        • <strong>Statut Live :</strong> Détection automatique des sessions <span style={{ color: '#22c55e', fontWeight: 600 }}>🟢 En cours</span> (ping &lt; 2 min) et fermeture automatique en <span style={{ color: '#94a3b8' }}>⚪ Terminée (durée)</span> dès l&apos;arrêt des pings.<br/>
                        • <strong>Sélecteur de Filtre :</strong> Basculement instantané entre <strong>📅 Connexions du jour</strong> (vue par défaut) et <strong>🌐 Historique global complet</strong>.
                      </p>
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
                      <p className={styles.cardText}>Repli ultime sur la base de connaissances Methodo&amp;Clinique intégrée dans l&apos;application pour un fonctionnement garanti 24h/24.</p>
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
                      <p className={styles.cardText}>Les documents et lois de référence (Guide de Méthodologie Clinique, Loi n° 18-11 relative à la santé, Lignes Directrices pour la Conduite des Études Cliniques en Algérie - MSPRH, grilles STROBE/ICMJE) demeurent la propriété exclusive de leurs institutions émettrices respectives et sont exploités à des fins d&apos;analyse RAG et de citation.</p>
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
