'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function GuidePage() {
  const { user, profile } = useAuth();
  const [copyStates, setCopyStates] = useState<{ [key: string]: boolean }>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');
  const [requestError, setRequestError] = useState('');

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopyStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);

  const handleRequestLicense = async () => {
    if (!user?.email) {
      setRequestError("Vous devez être connecté à votre compte pour obtenir votre clé de licence.");
      return;
    }
    
    setIsSubmitting(true);
    setRequestError('');
    setRequestSuccess('');
    
    try {
      const res = await fetch('/api/auth/generate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          tier: profile?.subscription?.tier || (profile?.role === 'admin' ? 'ultra' : 'pro'),
          expiresAt: profile?.subscription?.validUntil ? new Date(profile.subscription.validUntil).getTime() : (Date.now() + 365 * 24 * 3600 * 1000)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de générer la clé.");

      setGeneratedLicense(data.licenseKey);
      setRequestSuccess("Votre clé de licence Desktop a été générée avec succès ! Vous pouvez la copier ci-dessous.");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Erreur lors de la génération de licence :", errMsg);
      setRequestError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className={styles.title}>Acquisition de l'Exécutable Hors-ligne & Licences</h1>
        <p className={styles.subtitle}>
          Ce guide est destiné aux enseignants et aux étudiants souhaitant utiliser l'application de formation <strong>Methodo&Clinique</strong> en local, de façon autonome et <strong>sans aucune connexion internet</strong>.
        </p>
      </header>

      {/* Section 1 : Acquisition de l'Exécutable et Licences */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          🔑 1. Pourquoi acquérir l'Exécutable de bureau ?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
          La version exécutable de bureau (disponible aux formats <strong>.exe</strong> pour Windows, <strong>.app / .dmg</strong> pour macOS et <strong>.AppImage / .deb</strong> pour Linux) vous permet d'emporter toute l'intelligence méthodologique de <strong>Methodo&Clinique</strong> partout avec vous, même dans les zones blanches ou les sous-sols d'hôpitaux totalement coupés du réseau.
        </p>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6', fontWeight: 600 }}>
          Avantages majeurs de la version locale :
        </p>
        <ul style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6', paddingLeft: '1.5rem', listStyleType: 'disc' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Confidentialité 100% absolue :</strong> Vos données de recherche et vos fiches de protocoles cliniques sont stockées et traitées uniquement sur votre disque dur, sans aucun transfert cloud.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Zéro Dépendance Internet :</strong> Le tuteur virtuel RECIF continue de répondre intelligemment en exploitant un modèle d'IA local (Ollama).</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Zéro Latence & Zéro Quota :</strong> Pas de limitation de jetons ou de ralentissements dus à la bande passante.</li>
        </ul>

        <div style={{ border: '1px solid rgba(45, 212, 191, 0.2)', padding: '1.25rem', borderRadius: '12px', background: 'rgba(45, 212, 191, 0.02)', marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '1rem' }}>
            💼 Tarifs & Offre Spéciale :
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '0.75rem' }}>
            Vous pouvez faire l'acquisition de clés de licences individuelles (pack de 1, 2 ou 3 licences actives avec code d'activation unique).
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(45, 212, 191, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            🎁 <strong>Offre Promotionnelle :</strong> 1 licence exécutable hors-ligne vous est <strong>offerte gratuitement</strong> pour toute souscription annuelle (12 mois) aux formules <strong>EXPERT</strong> ou <strong>ULTRA</strong>.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
          <button 
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem', fontWeight: 600, background: 'linear-gradient(135deg, #0d9488, #0284c7)' }}
            onClick={handleRequestLicense}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner}></span> Génération de votre clé...
              </>
            ) : (
              <>
                🔑 Obtenir / Afficher ma Clé de Licence Desktop
              </>
            )}
          </button>
          
          {requestSuccess && (
            <div style={{ color: '#10b981', fontSize: '0.88rem', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', width: '100%' }}>
              ✅ {requestSuccess}
            </div>
          )}
          
          {requestError && (
            <div style={{ color: '#ef4444', fontSize: '0.88rem', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', width: '100%' }}>
              ⚠️ {requestError}
            </div>
          )}

          {/* CARTE DORÉE D'AFFICHAGE ET COPIE DE LA LICENCE */}
          {generatedLicense && (
            <div style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(30, 41, 59, 0.95))',
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '1.25rem',
              marginTop: '1rem',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ color: '#fbbf24', margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔑 Votre Clé de Licence Desktop Officielle
                </h4>
                <span style={{ background: '#f59e0b', color: '#000', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                  {profile?.subscription?.tier?.toUpperCase() || (profile?.role === 'admin' ? 'ADMIN' : 'PRO')}
                </span>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Copiez le code ci-dessous et collez-le dans le champ <strong>« Code de Licence Hors-Ligne »</strong> au lancement de votre application Desktop :
              </p>

              <textarea
                readOnly
                value={generatedLicense}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fef08a',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  resize: 'none',
                  marginBottom: '0.75rem'
                }}
              />

              <button
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  padding: '0.65rem 1.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => handleCopy('license_key', generatedLicense)}
              >
                {copyStates['license_key'] ? '✅ Clé Copiée dans le presse-papier !' : '📋 Copier ma Clé de Licence'}
              </button>
            </div>
          )}
        </div>

      </section>

      {/* Section 2 : Téléchargement des Exécutables de Bureau & Instructions par OS */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          📦 2. Télécharger l&apos;Application selon votre Système (v1.9.0)
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
          Sélectionnez ci-dessous l&apos;exécutable certifié v1.9.0 correspondant à votre système d&apos;exploitation (Mac ou Windows).
        </p>

        {/* Banner OBLIGATOIRE sur la licence */}
        <div style={{ background: 'rgba(45, 212, 191, 0.08)', border: '1px solid rgba(45, 212, 191, 0.3)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#2dd4bf', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚡</span> ACTIVATION EN 2 ÉTAPES SIMPLES
          </h4>
          <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: '1.7' }}>
            <li><strong>Obtenez votre clé</strong> : Cliquez sur le bouton bleu ci-dessus <strong>« 🔑 Obtenir / Afficher ma Clé de Licence Desktop »</strong> pour copier votre code personnel.</li>
            <li><strong>Téléchargez &amp; installez</strong> : Cliquez sur l&apos;installateur ci-dessous (Mac <code>.dmg</code> ou Windows <code>.exe</code>).</li>
            <li><strong>Activez l&apos;application</strong> : Au premier démarrage, collez votre clé dans le champ <strong>« Code de Licence Hors-Ligne »</strong>.</li>
          </ol>
        </div>


        {/* 3 Cartes OS : Windows, macOS, Linux */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
          
          {/* Windows */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🪟</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Windows (.exe)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Windows 10 / 11 (64-bit)</span>
              </div>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.5', flexGrow: 1, marginBottom: '1rem' }}>
              <strong>Instructions :</strong> Téléchargez l'installateur <code>.exe</code>, double-cliquez dessus et suivez l'assistant d'installation. Un raccourci « Plateforme RECIF » sera créé sur votre bureau.
            </p>
            <a 
              href="https://github.com/Nezzal/clinical-methodology-learning-v2/releases/download/v1.9.0/RECIF-MethodoClinique.Setup.1.9.0.exe" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ textAlign: 'center', padding: '0.65rem 0.85rem', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 600 }}
            >
              📥 Télécharger Directement (.exe)
            </a>
          </div>

          {/* macOS */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🍎</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>macOS (.dmg / .app)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>macOS 11+ (Apple Silicon &amp; Intel)</span>
              </div>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.5', flexGrow: 1, marginBottom: '1rem' }}>
              <strong>Instructions :</strong> Ouvrez le fichier <code>.dmg</code> et glissez l&apos;application dans votre dossier Applications.
            </p>
            <a 
              href="https://github.com/Nezzal/clinical-methodology-learning-v2/releases/download/v1.9.0/RECIF-MethodoClinique-1.9.0-arm64.dmg" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ textAlign: 'center', padding: '0.65rem 0.85rem', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 600 }}
            >
              📥 Télécharger Directement (.dmg)
            </a>
          </div>


          {/* Linux */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🐧</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Linux (.AppImage / .deb)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ubuntu, Debian, Fedora, Arch</span>
              </div>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.5', flexGrow: 1, marginBottom: '1rem' }}>
              <strong>Instructions (dans le Terminal Linux) :</strong><br/>
              • <code>AppImage</code> : Rendre le fichier exécutable dans le terminal (<code>chmod +x RECIF-MethodoClinique-*.AppImage</code>) puis double-cliquer pour lancer.<br/>
              • <code>.deb</code> : Lancer la commande d'installation dans le terminal (<code>sudo dpkg -i clinical-methodology-learning_*.deb</code>) ou installer via le Centre Logiciels.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a 
                href="https://github.com/Nezzal/clinical-methodology-learning-v2/releases/download/v1.8.4/RECIF-MethodoClinique-1.8.4.AppImage" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ flex: 1, textAlign: 'center', padding: '0.55rem 0.4rem', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 600 }}
              >
                AppImage
              </a>
              <a 
                href="https://github.com/Nezzal/clinical-methodology-learning-v2/releases/download/v1.8.4/clinical-methodology-learning_1.8.4_amd64.deb" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ flex: 1, textAlign: 'center', padding: '0.55rem 0.4rem', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 600 }}
              >
                Paquet .deb
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Section 2 : Prérequis Matériels */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="16" x="4" y="4" rx="2" />
            <rect width="6" height="6" x="9" y="9" rx="1" />
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
          </svg>
          💻 2. Prérequis Matériels Recommandés
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
          Faire tourner une intelligence artificielle en local sur son ordinateur nécessite des ressources matérielles adéquates pour garantir des temps de réponse rapides et fluides.
        </p>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Composant</th>
                <th>PC Windows & Linux (Intel / AMD / NVIDIA)</th>
                <th>Mac Apple (Apple Silicon M1/M2/M3/M4 & Intel)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Processeur (CPU)</strong></td>
                <td>Intel Core i5 / i7 / i9 <strong>OU</strong> AMD Ryzen 5 / 7 / 9</td>
                <td>Puce Apple Silicon (M1, M2, M3, M4) <strong>OU</strong> Intel Core i5 / i7</td>
              </tr>
              <tr>
                <td><strong>Mémoire (RAM)</strong></td>
                <td><strong>8 Go</strong> (Minimale) — <strong>16 Go+</strong> (Recommandée pour l'IA)</td>
                <td><strong>8 Go</strong> (Minimale) — <strong>16 Go+</strong> (Mémoire Unifiée Recommandée)</td>
              </tr>
              <tr>
                <td><strong>Carte Graphique (GPU)</strong></td>
                <td>Carte dédiée <strong>NVIDIA RTX / GTX</strong> (4-6 Go VRAM+) <strong>OU</strong> AMD Radeon <strong>OU</strong> Intel Iris Xe</td>
                <td>GPU intégré <strong>Apple Silicon</strong> (M1/M2/M3/M4) <strong>OU</strong> AMD Radeon Mac</td>
              </tr>
              <tr>
                <td><strong>Stockage (Disque)</strong></td>
                <td><strong>SSD obligatoire</strong> (NVMe recommandé) — 15 à 20 Go d'espace libre</td>
                <td><strong>SSD Mac obligatoire</strong> — 15 à 20 Go d'espace libre</td>
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
          📥 3. Étape 1 : Installer le moteur d'IA locale (Ollama)
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
          🤖 4. Étape 2 : Télécharger un modèle d'IA (Gemma ou Qwen)
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
          🚀 5. Étape 3 : Lancer l'application Methodo&Clinique
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
          Une fois Ollama installé et le modèle téléchargé :
        </p>

        <ul className={styles.stepList}>
          <li className={styles.stepItem}>
            <span className={styles.stepNumber}>1</span>
            <div className={styles.stepText}>
              <p>Démarrez l'application <strong>Methodo&Clinique</strong> (soit en ouvrant le dossier et en saisissant <code>npm run dev</code> dans le terminal, soit en lançant l'application de bureau Electron).</p>
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

    </div>
  );
}
