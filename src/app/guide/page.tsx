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
        <h1 className={styles.title}>Guide d'Utilisation Hors-ligne & IA Locale (Ollama)</h1>
        <p className={styles.subtitle}>
          Ce guide est destiné aux enseignants et aux étudiants souhaitant utiliser l'application de formation <strong>Methodo Clinique</strong> en local, de façon autonome et <strong>sans aucune connexion internet</strong>.
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
          💻 1. Prérequis Matériels Recommandés
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
          Faire tourner une intelligence artificielle en local sur son ordinateur nécessite des ressources matérielles adéquates pour garantir des temps de réponse rapides et fluides.
        </p>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Composant</th>
                <th>Configuration Minimale (Modèles légers : 2B - 3B)</th>
                <th>Configuration Recommandée (Modèles standards : 7B - 9B)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Processeur (CPU)</strong></td>
                <td>Intel Core i5 / AMD Ryzen 5 (Génération récente)</td>
                <td>Apple Silicon (M1/M2/M3/M4) <strong>OU</strong> Intel Core i7 / AMD Ryzen 7</td>
              </tr>
              <tr>
                <td><strong>Mémoire (RAM)</strong></td>
                <td><strong>8 Go</strong></td>
                <td><strong>16 Go</strong> (ou plus)</td>
              </tr>
              <tr>
                <td><strong>Carte Graphique (GPU)</strong></td>
                <td>Graphiques intégrés (Intel Iris Xe, Radeon)</td>
                <td>Carte dédiée NVIDIA RTX (6 Go VRAM ou plus) <strong>OU</strong> GPU intégré Apple Silicon</td>
              </tr>
              <tr>
                <td><strong>Disque Dur</strong></td>
                <td><strong>SSD obligatoire</strong></td>
                <td><strong>SSD rapide (NVMe)</strong></td>
              </tr>
              <tr>
                <td><strong>Espace Libre</strong></td>
                <td>10 Go d'espace libre sur le disque</td>
                <td>20 Go d'espace libre sur le disque</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`${styles.alert} ${styles.alertImportant}`}>
          <span className={styles.alertIcon}>⚠️</span>
          <div>
            <strong>Un disque de type SSD est indispensable.</strong> Les disques durs classiques (HDD) sont trop lents pour charger les modèles d'IA en mémoire, ce qui rendrait le tuteur inutilisable.
          </div>
        </div>
      </section>

      {/* Section 2 : Étape 1 - Installation */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          📥 2. Étape 1 : Installer le moteur d'IA locale (Ollama)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
          Ollama est le logiciel gratuit qui permet d'exécuter des modèles d'IA directement sur votre machine.
        </p>

        <ul className={styles.stepList}>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>A</span>
            <div className={styles.stepText}>
              <p><strong>Windows :</strong> Lancez l'installateur <code>.exe</code> téléchargé et suivez les instructions à l'écran.</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>B</span>
            <div className={styles.stepText}>
              <p><strong>macOS :</strong> Décompressez l'archive et glissez l'application dans votre dossier <code>Applications</code>.</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>C</span>
            <div className={styles.stepText}>
              <p><strong>Linux :</strong> Exécutez la commande d'installation rapide fournie sur le site dans votre terminal.</p>
            </div>
          </li>
        </ul>

        <div className={`${styles.alert} ${styles.alertTip}`} style={{ marginTop: '1.5rem', marginBottom: 0 }}>
          <span className={styles.alertIcon}>💡</span>
          <div>
            Une fois installé, Ollama s'exécute silencieusement en tâche de fond (une petite icône d'animal apparaît dans votre barre des tâches ou de menus).
          </div>
        </div>
      </section>

      {/* Section 3 : Étape 2 - Modèles */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          🤖 3. Étape 2 : Télécharger un modèle d'IA (Gemma ou Qwen)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
          <em>Le téléchargement initial du modèle nécessite une connexion Internet (une seule fois). Une fois téléchargé, il fonctionnera indéfiniment hors-ligne.</em>
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
          Ouvrez le <strong>Terminal</strong> (sur macOS/Linux) ou l'application <strong>PowerShell / Invite de commandes</strong> (sur Windows), puis saisissez la commande de votre choix :
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ border: '1px solid rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🇨🇳</span> Qwen 2.5 (Précis & Rapide)
            </h4>
            
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pour les ordinateurs légers (8 Go RAM) :</span>
              <div className={styles.codeBlockContainer}>
                <div className={styles.codeBlock}>{codeSnippets.qwen3b}</div>
                <button className={styles.copyBtn} onClick={() => handleCopy('qwen3b', codeSnippets.qwen3b)}>
                  {copyStates.qwen3b ? 'Copié !' : 'Copier'}
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pour les ordinateurs performants (16 Go RAM+) :</span>
              <div className={styles.codeBlockContainer}>
                <div className={styles.codeBlock}>{codeSnippets.qwen7b}</div>
                <button className={styles.copyBtn} onClick={() => handleCopy('qwen7b', codeSnippets.qwen7b)}>
                  {copyStates.qwen7b ? 'Copié !' : 'Copier'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🇺🇸</span> Gemma 2 (Par Google)
            </h4>
            
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pour les ordinateurs légers (8 Go RAM) :</span>
              <div className={styles.codeBlockContainer}>
                <div className={styles.codeBlock}>{codeSnippets.gemma2b}</div>
                <button className={styles.copyBtn} onClick={() => handleCopy('gemma2b', codeSnippets.gemma2b)}>
                  {copyStates.gemma2b ? 'Copié !' : 'Copier'}
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pour les ordinateurs performants (16 Go RAM+) :</span>
              <div className={styles.codeBlockContainer}>
                <div className={styles.codeBlock}>{codeSnippets.gemma9b}</div>
                <button className={styles.copyBtn} onClick={() => handleCopy('gemma9b', codeSnippets.gemma9b)}>
                  {copyStates.gemma9b ? 'Copié !' : 'Copier'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.alert} ${styles.alertTip}`} style={{ marginBottom: 0 }}>
          <span className={styles.alertIcon}>💡</span>
          <div>
            La commande va télécharger le modèle (compter 2 à 5 Go selon le modèle choisi) puis ouvrir une session de chat dans votre terminal. Pour quitter cette session dans le terminal, tapez simplement <code>/bye</code>.
          </div>
        </div>
      </section>

      {/* Section 4 : Étape 3 - Lancement */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          🚀 4. Étape 3 : Lancer l'application Methodo Clinique
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
          Une fois Ollama installé et le modèle téléchargé :
        </p>

        <ul className={styles.stepList}>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>1</span>
            <div className={styles.stepText}>
              <p>Démarrez l'application <strong>Methodo Clinique</strong> (soit en ouvrant le dossier et en saisissant <code>npm run dev</code> dans le terminal, soit en lançant l'application de bureau Electron).</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>2</span>
            <div className={styles.stepText}>
              <p>Dans l'application, ouvrez le menu latéral (Sidebar) à gauche.</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>3</span>
            <div className={styles.stepText}>
              <p>Dans la section <strong>Moteur d'IA</strong>, cliquez sur le bouton pour basculer de <strong>Cloud</strong> à <strong>Ollama (Local)</strong>.</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>4</span>
            <div className={styles.stepText}>
              <p>Un menu déroulant apparaît : sélectionnez le modèle d'IA que vous venez d'installer (par exemple <code>qwen2.5:7b</code> ou <code>gemma2:2b</code>).</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>5</span>
            <div className={styles.stepText}>
              <p>Accédez au <strong>Tuteur Virtuel</strong> : vous pouvez maintenant poser vos questions de méthodologie clinique. Le tuteur répondra instantanément, de manière intelligente et sans aucune connexion internet.</p>
            </div>
          </li>
        </ul>
      </section>

      {/* Section 5 : Étape 4 - Mode Invité */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          🔒 5. Étape 4 : Utiliser le Mode Invité (Sans Internet)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
          Si vous n'avez pas d'accès internet pour vous connecter à votre compte utilisateur :
        </p>

        <ul className={styles.stepList}>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>1</span>
            <div className={styles.stepText}>
              <p>Sur la page de connexion, cliquez sur <strong>Accéder en Mode Invité</strong>.</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>2</span>
            <div className={styles.stepText}>
              <p><strong>Sauvegarde :</strong> Vos progrès (quiz, flashcards, fiches de protocoles générées) sont enregistrés automatiquement dans la mémoire cache locale de votre navigateur (<code>localStorage</code>).</p>
            </div>
          </li>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>3</span>
            <div className={styles.stepText}>
              <p><strong>Synchronisation :</strong> Dès que vous retrouverez une connexion internet, connectez-vous simplement à votre compte en ligne. L'application synchronisera automatiquement toutes vos données locales vers le serveur pour que vos enseignants puissent y accéder.</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
