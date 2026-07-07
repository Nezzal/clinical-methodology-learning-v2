'use client';

import React, { useState, useEffect } from 'react';
import { getProgress, LocalStats } from '@/utils/storage';
import { APP_VERSION_LABEL } from '@/utils/constants';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

// Simple table rendering helper for report
function renderReportHtmlTable(rows: string[]): string {
  if (rows.length === 0) return '';
  
  let html = '<div style="overflow-x: auto; margin: 1rem 0; width: 100%;"><table style="width: 100%; min-width: 500px; border-collapse: collapse; border: 1px solid var(--border-glass); font-size: 0.9rem; background-color: rgba(255, 255, 255, 0.01);">';
  
  // Parse rows
  let parsedRows = rows.map(row => {
    let cells = row.split('|').map(c => c.trim());
    if (row.startsWith('|')) cells.shift();
    if (row.endsWith('|')) cells.pop();
    return cells;
  });
  
  let separatorIndex = -1;
  if (parsedRows.length > 1) {
    const secondRow = parsedRows[1];
    const isSeparator = secondRow.every(cell => /^:?-+:?$/.test(cell));
    if (isSeparator) {
      separatorIndex = 1;
    }
  }
  
  for (let i = 0; i < parsedRows.length; i++) {
    if (i === separatorIndex) continue;
    
    const isHeader = (i === 0 && separatorIndex !== -1);
    html += `<tr style="${isHeader ? 'background-color: rgba(255, 255, 255, 0.05); border-bottom: 2px solid var(--border-glass); font-weight: 600;' : 'border-bottom: 1px solid var(--border-glass);'}">`;
    
    const cells = parsedRows[i];
    for (let j = 0; j < cells.length; j++) {
      const cellContent = cells[j];
      const tag = isHeader ? 'th' : 'td';
      const padding = isHeader ? '0.75rem 1rem' : '0.65rem 1rem';
      
      html += `<${tag} style="padding: ${padding}; text-align: left; border: 1px solid var(--border-glass);">${cellContent}</${tag}>`;
    }
    html += '</tr>';
  }
  
  html += '</table></div>';
  return html;
}

// Markdown parser helper for report rendering
function formatReportMarkdown(text: string): string {
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert markdown tables to HTML tables
  let lines = formatted.split('\n');
  let inTable = false;
  let tableRows: string[] = [];
  let processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableRow = line.startsWith('|') && line.endsWith('|');
    
    if (isTableRow) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(lines[i]);
    } else {
      if (inTable) {
        const htmlTable = renderReportHtmlTable(tableRows);
        processedLines.push(htmlTable);
        inTable = false;
      }
      processedLines.push(lines[i]);
    }
  }
  
  if (inTable) {
    const htmlTable = renderReportHtmlTable(tableRows);
    processedLines.push(htmlTable);
  }

  formatted = processedLines.join('\n');

  // Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Headers
  formatted = formatted.replace(/^###### (.*?)$/gm, '<h6 style="margin-top: 0.6rem; margin-bottom: 0.2rem; color: var(--text-muted); font-size:0.9rem;">$1</h6>');
  formatted = formatted.replace(/^##### (.*?)$/gm, '<h5 style="margin-top: 0.7rem; margin-bottom: 0.25rem; color: var(--text-secondary); font-size:0.95rem;">$1</h5>');
  formatted = formatted.replace(/^#### (.*?)$/gm, '<h4 style="margin-top: 0.85rem; margin-bottom: 0.3rem; color: var(--text-primary); font-size:1rem; font-weight:600;">$1</h4>');
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3 style="margin-top: 1.1rem; margin-bottom: 0.4rem; color: var(--accent-secondary); font-size:1.1rem;">$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2 style="margin-top: 1.5rem; margin-bottom: 0.6rem; color: var(--accent-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.25rem; font-size:1.25rem;">$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1 style="margin-top: 1.8rem; margin-bottom: 0.8rem; color: var(--text-primary); font-size:1.5rem; text-align:center;">$1</h1>');

  // Horizontal rules
  formatted = formatted.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid var(--border-glass); margin: 1.5rem 0;" />');

  // List items
  formatted = formatted.replace(/^\s*[-*]\s+(.*?)$/gm, '<li style="margin-left: 1.25rem; list-style-type: disc; margin-bottom: 0.35rem;">$1</li>');

  // Double newlines to paragraphs
  formatted = formatted.split('\n').join('<br />');

  // Cleanup redundant br tags
  formatted = formatted.replace(/(<\/h1>|<\/h2>|<\/h3>|<\/h4>|<\/h5>|<\/h6>|<\/li>|<hr \/>)<br \/>/g, '$1');

  return formatted;
}

export default function RapportPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<LocalStats | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = () => {
    setStats(getProgress());
  };

  useEffect(() => {
    loadStats();
    window.addEventListener('progress_changed', loadStats);
    
    const handleProviderChange = () => {
      setReport(null);
    };
    window.addEventListener('ai_provider_changed', handleProviderChange);

    return () => {
      window.removeEventListener('progress_changed', loadStats);
      window.removeEventListener('ai_provider_changed', handleProviderChange);
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

    const provider = localStorage.getItem('recif_ai_provider') || 'gemini';

    // 1. Si Ollama est sélectionné, tenter d'abord un appel en direct depuis le navigateur pour l'application en ligne
    if (provider === 'ollama') {
      try {
        console.log("🤖 Tentative d'appel direct à Ollama depuis le navigateur...");
        const prompt = `Tu es un conseiller pédagogique et méthodologique expert en recherche clinique. Tu dois rédiger un bilan de compétences personnalisé et un rapport de suivi pour un utilisateur étudiant la méthodologie de recherche clinique (manuel RECIF).

Voici les statistiques d'activité de l'utilisateur :
- Questions posées au tuteur virtuel : ${payload.questionsAsked}
- Protocoles générés : ${payload.protocolsGenerated}
- Score aux quiz : ${payload.quizScore.correct}/${payload.quizScore.total} (${payload.quizScore.total > 0 ? Math.round((payload.quizScore.correct / payload.quizScore.total) * 100) : 0}%)
- Flashcards maîtrisées : ${payload.flashcardsMastered.mastered}/${payload.flashcardsMastered.total} (${Math.round((payload.flashcardsMastered.mastered / payload.flashcardsMastered.total) * 100)}%)
- Dernières questions posées : ${payload.recentQuestions.length > 0 ? payload.recentQuestions.join(', ') : 'Aucune'}
- Protocoles initiés : ${payload.recentProtocols.length > 0 ? payload.recentProtocols.join(', ') : 'Aucun'}

Instructions pour le rapport :
1. Rédige un rapport formel et encourageant en Markdown, destiné à l'étudiant.
2. Divise le rapport en sections claires :
   - Bilan général de progression
   - Analyse des acquis (forces) et des lacunes potentielles (sur la base de son score au quiz et des questions qu'il pose)
   - Focus méthodologique spécifique lié à ses centres d'intérêt ou ses questions récentes
   - Plan d'action personnalisé et recommandations concrètes pour s'améliorer (étapes de lecture dans le RECIF, exercices ciblés).
3. Le style doit être constructif, haut de gamme, et rédigé entièrement en français.
4. IMPORTANT : N'utilise absolument aucun émoji ni émoticône dans le rapport (aucun symbole graphique comme 🔬, 🧠, ✅, 🛡️, etc., ni dans les titres ni dans le texte).`;

        // Tenter d'interroger les tags pour voir si Ollama est actif et lister ses modèles
        const tagsResponse = await fetch('http://127.0.0.1:11434/api/tags');
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          const models = tagsData.models || [];
          
          if (models.length > 0) {
            // Utiliser le modèle sélectionné ou fallback
            let activeModel = localStorage.getItem('recif_ollama_model') || 'gemma4:latest';
            const hasModel = models.some((m: any) => m.name === activeModel);
            if (!hasModel && models.length > 0) {
              const matchingModel = models.find((m: any) => m.name.includes('gemma4') || m.name.includes('gemma'));
              if (matchingModel) {
                activeModel = matchingModel.name;
              } else {
                activeModel = models[0].name;
              }
            }

            const chatResponse = await fetch('http://127.0.0.1:11434/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: activeModel,
                messages: [
                  { 
                    role: 'system', 
                    content: "Tu es un conseiller pédagogique et méthodologique expert en recherche clinique RECIF. Tu dois formuler un rapport de suivi personnalisé et constructif en français sous forme de Markdown, sans préambule ni conclusion, et sans utiliser aucun émoji ou émoticône." 
                  },
                  { role: 'user', content: prompt }
                ],
                stream: false,
                options: { temperature: 0.6 }
              })
            });

            if (chatResponse.ok) {
              const chatData = await chatResponse.json();
              const content = chatData.message?.content;
              if (content) {
                setReport(content + `\n\n---\n*Note : Ce bilan a été généré en direct de votre navigateur par votre IA locale (${activeModel}) via Ollama.*`);
                setLoading(false);
                return; // Succès !
              }
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Impossible de contacter Ollama directement depuis le navigateur (CORS ou service éteint). Tentative via le serveur...", err);
      }
    }

    // 2. Repli classique via l'API route du serveur
    try {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-ai-provider': provider,
        'x-ollama-model': localStorage.getItem('recif_ollama_model') || ''
      };
      if (user) {
        try {
          const idToken = await user.getIdToken(true);
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch (tokenErr) {
          console.warn("Erreur token:", tokenErr);
        }
      }

      const response = await fetch('/api/pedagogical-report', {
        method: 'POST',
        headers,
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
            <div className="print-only-header" style={{ display: 'none', borderBottom: '2px solid #005a70', paddingBottom: '0.5rem', marginBottom: '2rem', fontFamily: "'Outfit', sans-serif" }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '13pt', color: '#005a70', fontWeight: 700 }}>BILAN PÉDAGOGIQUE ET SUIVI</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '9pt', color: '#6b7280' }}>{APP_VERSION_LABEL}</p>
                </div>
                <div style={{ fontSize: '9pt', color: '#6b7280' }}>
                  Généré le {new Date().toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
            <div dangerouslySetInnerHTML={{ __html: formatReportMarkdown(report) }} />
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4;
                margin: 2.5cm 2.2cm 2.5cm 2.2cm;
                @bottom-left {
                  content: "${APP_VERSION_LABEL}";
                  font-family: 'Inter', sans-serif;
                  font-size: 8pt;
                  color: #9ca3af;
                  border-top: 1px solid #e5e7eb;
                  vertical-align: top;
                  padding-top: 8px;
                }
                @bottom-center {
                  content: "";
                  border-top: 1px solid #e5e7eb;
                  vertical-align: top;
                  padding-top: 8px;
                }
                @bottom-right {
                  content: "Page " counter(page);
                  font-family: 'Inter', sans-serif;
                  font-size: 8pt;
                  color: #9ca3af;
                  border-top: 1px solid #e5e7eb;
                  vertical-align: top;
                  padding-top: 8px;
                }
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              .print-only-header {
                display: block !important;
              }
              div, table {
                overflow: visible !important;
              }
              p, li, blockquote, pre, tr, td, th {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}} />
          
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
