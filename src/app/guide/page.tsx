'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

export default function GuidePage() {
  const [copyStates, setCopyStates] = useState<{ [key: string]: boolean }>({});

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopyStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const codeSnippets = {
    qwen3b: 'ollama run qwen2.5:3b',
    qwen7b: 'ollama run qwen2.5:7b',
    gemma2b: 'ollama run gemma2:2b',
    gemma9b: 'ollama run gemma2:9b',
  };

  return (
    <div className={styles.mainContent}>
      <header className={styles.header}>
        <h1 className={styles.title}>Guide d'Utilisation Hors-ligne</h1>
        <p className={styles.subtitle}>
          Configurez votre environnement local pour exécuter l'intelligence artificielle sans connexion internet.
        </p>
      </header>

      {/* Section 1 : Prérequis Matériels */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="16" x="4" y="4" rx="2" />
            <rect width="6" height="6" x="9" y="9" rx="1" />
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
          </svg>
          1. Prérequis Matériels Recommandés
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
          Pour faire tourner un modèle d'IA local de manière fluide, votre ordinateur doit respecter la configuration matérielle minimale suivante :
        </p>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Composant</th>
                <th>Configuration Minimale (Modèles 2B - 3B)</th>
                <th>Configuration Recommandée (Modèles 7B - 9B)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Processeur (CPU)</strong></td>
                <td>Intel Core i5 / AMD Ryzen 5 (Génération récente)</td>
                <td>Apple Silicon (M1/M2/M3/M4) ou Intel Core i7 / AMD Ryzen 7</td>
              </tr>
              <tr>
                <td><strong>Mémoire (RAM)</strong></td>
                <td>8 Go</td>
                <td>16 Go ou plus (hautement recommandé)</td>
              </tr>
              <tr>
                <td><strong>Carte Graphique (GPU)</strong></td>
                <td>Puce graphique intégrée (Intel Iris Xe, Radeon)</td>
                <td>Carte dédiée NVIDIA RTX (6 Go VRAM+) ou GPU Apple Silicon</td>
              </tr>
              <tr>
                <td><strong>Stockage</strong></td>
                <td>SSD (indispensable)</td>
                <td>SSD ultra rapide (NVMe)</td>
              </tr>
              <tr>
                <td><strong>Espace Libre</strong></td>
                <td>10 Go libres sur le disque</td>
                <td>20 Go libres sur le disque</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`${styles.alert} ${styles.alertImportant}`}>
          <span className={styles.alertIcon}>⚠️</span>
          <div>
            <strong>Disque SSD Obligatoire :</strong> N'installez pas les modèles sur un disque dur mécanique classique (HDD). Le chargement des données en mémoire vive serait extrêmement lent, ralentissant le tuteur à un mot par seconde.
          </div>
        </div>
      </section>

      {/* Section 2 : Guide pas-à-pas */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          2. Guide d'Installation de l'IA Locale
        </h2>

        <ul className={styles.stepList}>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>1</span>
            <div className={styles.stepText}>
              <p><strong>Installer Ollama :</strong></p>
              <p>Rendez-vous sur le site officiel <a href="https://ollama.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}><strong>ollama.com</strong></a> et téléchargez la version adaptée à votre système (Windows, macOS ou Linux). Installez l'application en suivant l'assistant.</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Une fois lancé, une petite icône d'animal apparaît dans votre barre d'outils, confirmant que le serveur local tourne en arrière-plan.</p>
            </div>
          </li>

          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>2</span>
            <div className={styles.stepText}>
              <p><strong>Télécharger un modèle d'IA :</strong></p>
              <p>Ouvrez votre console locale (Terminal sur Mac, PowerShell ou Invite de commandes sur Windows) et copiez-collez l'une des commandes ci-dessous pour récupérer un modèle de langue :</p>
              
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Options Qwen 2.5 (Précis & Léger)</h4>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pour 8 Go RAM (Qwen 2.5 3B) :</span>
                    <div className={styles.codeBlockContainer}>
                      <div className={styles.codeBlock}>{codeSnippets.qwen3b}</div>
                      <button className={styles.copyBtn} onClick={() => handleCopy('qwen3b', codeSnippets.qwen3b)}>
                        {copyStates.qwen3b ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pour 16 Go RAM (Qwen 2.5 7B) :</span>
                    <div className={styles.codeBlockContainer}>
                      <div className={styles.codeBlock}>{codeSnippets.qwen7b}</div>
                      <button className={styles.copyBtn} onClick={() => handleCopy('qwen7b', codeSnippets.qwen7b)}>
                        {copyStates.qwen7b ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Options Gemma 2 (Performant par Google)</h4>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pour 8 Go RAM (Gemma 2 2B) :</span>
                    <div className={styles.codeBlockContainer}>
                      <div className={styles.codeBlock}>{codeSnippets.gemma2b}</div>
                      <button className={styles.copyBtn} onClick={() => handleCopy('gemma2b', codeSnippets.gemma2b)}>
                        {copyStates.gemma2b ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pour 16 Go RAM (Gemma 2 9B) :</span>
                    <div className={styles.codeBlockContainer}>
                      <div className={styles.codeBlock}>{codeSnippets.gemma9b}</div>
                      <button className={styles.copyBtn} onClick={() => handleCopy('gemma9b', codeSnippets.gemma9b)}>
                        {copyStates.gemma9b ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${styles.alert} ${styles.alertTip}`} style={{ marginTop: '1rem', marginBottom: 0 }}>
                <span className={styles.alertIcon}>💡</span>
                <div>
                  La première exécution va télécharger les fichiers du modèle (entre 2 et 5 Go). Une fois l'opération terminée, vous pouvez fermer le terminal en écrivant <code>/bye</code>.
                </div>
              </div>
            </div>
          </li>

          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>3</span>
            <div className={styles.stepText}>
              <p><strong>Activer le mode local dans l'application :</strong></p>
              <p>Ouvrez votre barre de navigation de gauche (Sidebar) dans **Methodo Clinique** :</p>
              <p style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--accent-primary)', marginTop: '0.5rem' }}>
                1. Repérez la section <strong>Moteur d'IA</strong>.<br />
                2. Cliquez sur le commutateur pour basculer sur <strong>Ollama (Local)</strong>.<br />
                3. Dans la liste déroulante qui s'affiche, sélectionnez le modèle que vous venez d'installer (par exemple <code>qwen2.5:7b</code>).
              </p>
              <p style={{ marginTop: '0.5rem' }}>C'est tout ! Votre Tuteur Virtuel interroge désormais l'IA localement de manière 100% autonome, sans passer par Internet.</p>
            </div>
          </li>
        </ul>
      </section>

      {/* Section 3 : Mode Invité */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          3. Utilisation en mode Invité (Sans Compte en Ligne)
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
          Si vous ne possédez pas de compte en ligne ou que la connexion à la base de données distante est interrompue, cliquez sur **Accéder en Mode Invité** sur la page de connexion.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Toutes vos saisies, réponses de tuteur, fiches de protocoles créées et progressions de quiz sont enregistrées localement dans la mémoire de votre navigateur. Dès que vous retrouvez du réseau et vous connectez à votre profil, vos données se synchronisent de façon transparente avec le serveur pour permettre le suivi par votre enseignant référent.
        </p>
      </section>
    </div>
  );
}
