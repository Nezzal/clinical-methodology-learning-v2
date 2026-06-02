'use client';

import React, { useState, useEffect } from 'react';
import { getProgress, LocalStats } from '@/utils/storage';
import styles from './page.module.css';

// Markdown parser helper for report rendering
function formatReportMarkdown(text: string): string {
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Headers
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3 style="margin-top: 1.25rem; margin-bottom: 0.5rem; color: var(--accent-secondary); font-size:1.1rem;">$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2 style="margin-top: 1.75rem; margin-bottom: 0.75rem; color: var(--accent-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.25rem; font-size:1.3rem;">$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--text-primary); font-size:1.6rem; text-align:center;">$1</h1>');

  // Horizontal rules
  formatted = formatted.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid var(--border-glass); margin: 1.5rem 0;" />');

  // List items
  formatted = formatted.replace(/^\s*[-*]\s+(.*?)$/gm, '<li style="margin-left: 1.25rem; list-style-type: disc; margin-bottom: 0.35rem;">$1</li>');

  // Double newlines to paragraphs
  formatted = formatted.split('\n').join('<br />');

  // Cleanup redundant br tags
  formatted = formatted.replace(/(<\/h1>|<\/h2>|<\/h3>|<\/li>|<hr \/>)<br \/>/g, '$1');

  return formatted;
}

export default function RapportPage() {
  const [stats, setStats] = useState<LocalStats | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = () => {
    setStats(getProgress());
  };

  useEffect(() => {
    loadStats();
    window.addEventListener('progress_changed', loadStats);
    return () => {
      window.removeEventListener('progress_changed', loadStats);
    };
  }, []);

  const handleGenerateReport = async () => {
    if (!stats) return;
    setLoading(true);
    setReport(null);

    const payload = {
      questionsAsked: stats.questionsAsked,
      protocolsGenerated: stats.protocolsGenerated,
      quizScore: { correct: stats.quizCorrect, total: stats.quizTotal },
      flashcardsMastered: { mastered: stats.flashcardsMastered.length, total: 12 },
      recentQuestions: stats.recentQuestions,
      recentProtocols: stats.recentProtocols.map(p => `[${p.acronym}] ${p.title}`),
    };

    try {
      const response = await fetch('/api/pedagogical-report', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-ai-provider': localStorage.getItem('recif_ai_provider') || 'gemini'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setReport(data.report);
      } else {
        throw new Error(data.error || 'Erreur de génération du rapport.');
      }
    } catch (error: any) {
      alert(`⚠️ Échec de l'analyse : ${error.message || 'Le serveur n\'a pas répondu.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport_pedagogique_recif_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Chargement du rapport...</p>
      </div>
    );
  }

  const quizPct = stats.quizTotal > 0 ? Math.round((stats.quizCorrect / stats.quizTotal) * 100) : 0;
  const fcPct = Math.round((stats.flashcardsMastered.length / 12) * 100);

  return (
    <div className={styles.container}>
      <header className={`${styles.header} no-print`}>
        <h1 className={styles.title}>Rapport Pédagogique & Suivi</h1>
        <p className={styles.subtitle}>
          Visualisez votre progression globale et obtenez un bilan méthodologique personnalisé généré par l'IA.
        </p>
      </header>

      {/* Grid de récapitulatif des indicateurs bruts */}
      <section className={`${styles.overviewGrid} no-print`}>
        <div className={`${styles.metricCard} glass-card`}>
          <div className={styles.metricValue}>{stats.questionsAsked}</div>
          <div className={styles.metricLabel}>Questions Tuteur</div>
        </div>
        <div className={`${styles.metricCard} glass-card`}>
          <div className={styles.metricValue}>{stats.protocolsGenerated}</div>
          <div className={styles.metricLabel}>Protocoles Créés</div>
        </div>
        <div className={`${styles.metricCard} glass-card`}>
          <div className={styles.metricValue}>{quizPct}%</div>
          <div className={styles.metricLabel}>Réussite Quiz ({stats.quizCorrect}/{stats.quizTotal})</div>
        </div>
        <div className={`${styles.metricCard} glass-card`}>
          <div className={styles.metricValue}>{fcPct}%</div>
          <div className={styles.metricLabel}>Flashcards ({stats.flashcardsMastered.length}/12)</div>
        </div>
      </section>

      {/* Bouton de génération si aucun rapport n'a été fait */}
      {!report && !loading && (
        <div className={`${styles.generateBox} glass-card no-print`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Bilan de Compétences Personnalisé</h3>
          <p>
            Notre IA va analyser vos questions posées au Tuteur, les titres de vos protocoles cliniques rédigés et vos réussites aux quiz afin de dresser une synthèse de vos points forts, de vos axes d'amélioration et de vous proposer un plan de travail sur-mesure.
          </p>
          <button className="btn btn-primary" onClick={handleGenerateReport}>
            Générer mon rapport pédagogique IA
          </button>
        </div>
      )}

      {/* Écran de chargement */}
      {loading && (
        <div className={`${styles.generateBox} glass-card no-print`} style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 2s linear infinite', marginBottom: '1.5rem' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Analyse méthodologique en cours...</h3>
          <p style={{ color: 'var(--text-muted)' }}>L'IA compile votre historique d'apprentissage pour structurer vos recommandations.</p>
        </div>
      )}

      {/* Feuille de rapport imprimable */}
      {report && (
        <div className="animate-fade-in">
          {/* Actions sur le rapport */}
          <div className={`${styles.reportActions} no-print`}>
            <button className="btn btn-secondary" onClick={handleDownload}>
              Télécharger .md
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Imprimer / PDF
            </button>
          </div>

          <div className={styles.reportPaper}>
            <div dangerouslySetInnerHTML={{ __html: formatReportMarkdown(report) }} />
          </div>
          
          <div className={`${styles.reportActions} no-print`} style={{ justifyContent: 'center', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setReport(null)}>
              Nouveau Bilan
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
