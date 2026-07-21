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

function stripEmojis(text: string): string {
  // Regex mapping all standard emojis, pictographs, symbols and warning signs
  return text.replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F000}-\u{1F1FF}\u{26A0}-\u{26A1}\u{FE0F}]/gu, '');
}

// Markdown parser helper for report rendering with clean page-break elements
function formatReportMarkdown(text: string): string {
  let cleaned = stripEmojis(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let lines = cleaned.split('\n');
  let inTable = false;
  let inList = false;
  let tableRows: string[] = [];
  let processedBlocks: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join('<br />').trim();
      if (pText) {
        processedBlocks.push(`<p style="margin-bottom: 1rem; line-height: 1.65; page-break-inside: auto; break-inside: auto;">${pText}</p>`);
      }
      currentParagraphLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Headers
    if (line.startsWith('#')) {
      flushParagraph();
      if (inList) { processedBlocks.push('</ul>'); inList = false; }
      if (inTable) { processedBlocks.push(renderReportHtmlTable(tableRows)); inTable = false; }

      if (line.startsWith('###### ')) processedBlocks.push(`<h6 style="margin-top: 1rem; margin-bottom: 0.3rem; color: var(--text-muted); font-size:0.9rem; page-break-after: avoid; break-after: avoid;">${line.substring(7)}</h6>`);
      else if (line.startsWith('##### ')) processedBlocks.push(`<h5 style="margin-top: 1.1rem; margin-bottom: 0.35rem; color: var(--text-secondary); font-size:0.95rem; page-break-after: avoid; break-after: avoid;">${line.substring(6)}</h5>`);
      else if (line.startsWith('#### ')) processedBlocks.push(`<h4 style="margin-top: 1.25rem; margin-bottom: 0.4rem; color: var(--text-primary); font-size:1rem; font-weight:600; page-break-after: avoid; break-after: avoid;">${line.substring(5)}</h4>`);
      else if (line.startsWith('### ')) processedBlocks.push(`<h3 style="margin-top: 1.4rem; margin-bottom: 0.5rem; color: var(--accent-secondary); font-size:1.1rem; page-break-after: avoid; break-after: avoid;">${line.substring(4)}</h3>`);
      else if (line.startsWith('## ')) processedBlocks.push(`<h2 style="margin-top: 1.75rem; margin-bottom: 0.75rem; color: var(--accent-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.3rem; font-size:1.25rem; page-break-after: avoid; break-after: avoid;">${line.substring(3)}</h2>`);
      else if (line.startsWith('# ')) processedBlocks.push(`<h1 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--text-primary); font-size:1.5rem; text-align:center; page-break-after: avoid; break-after: avoid;">${line.substring(2)}</h1>`);
      continue;
    }

    // Horizontal Rule
    if (line === '---' || line === '***') {
      flushParagraph();
      if (inList) { processedBlocks.push('</ul>'); inList = false; }
      if (inTable) { processedBlocks.push(renderReportHtmlTable(tableRows)); inTable = false; }
      processedBlocks.push('<hr style="border: 0; border-top: 1px solid var(--border-glass); margin: 1.5rem 0;" />');
      continue;
    }

    // Tables
    const isTableRow = line.startsWith('|') && line.endsWith('|');
    if (isTableRow) {
      flushParagraph();
      if (inList) { processedBlocks.push('</ul>'); inList = false; }
      if (!inTable) { inTable = true; tableRows = []; }
      tableRows.push(rawLine);
      continue;
    } else if (inTable) {
      processedBlocks.push(renderReportHtmlTable(tableRows));
      inTable = false;
    }

    // Lists
    const isListItem = line.startsWith('- ') || line.startsWith('* ');
    if (isListItem) {
      flushParagraph();
      if (!inList) {
        inList = true;
        processedBlocks.push('<ul style="margin-left: 1.5rem; margin-bottom: 1rem; list-style-type: disc; page-break-inside: auto; break-inside: auto;">');
      }
      const itemContent = line.substring(2).trim();
      processedBlocks.push(`<li style="margin-bottom: 0.35rem; list-style-type: disc; page-break-inside: auto; break-inside: auto;">${itemContent}</li>`);
      continue;
    } else if (inList) {
      processedBlocks.push('</ul>');
      inList = false;
    }

    // Empty line -> ends paragraph
    if (!line) {
      flushParagraph();
      continue;
    }

    // Paragraph text line
    currentParagraphLines.push(line);
  }

  flushParagraph();
  if (inTable) processedBlocks.push(renderReportHtmlTable(tableRows));
  if (inList) processedBlocks.push('</ul>');

  let formatted = processedBlocks.join('\n');

  // Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

  return formatted;
}

// Helper to classify quiz topics into 5 core competencies
const mapTopicToCompetency = (topic: string): string => {
  const t = topic.toLowerCase();
  if (t.includes('loi') || t.includes('comité') || t.includes('art. 382') || t.includes('ethique') || t.includes('éthique') || t.includes('valorisation')) {
    return 'Éthique & Réglementation';
  }
  if (t.includes('transvers') || t.includes('témoin') || t.includes('cohorte') || t.includes('essai') || t.includes('méta-analyse') || t.includes('diagnostique') || t.includes('schéma')) {
    return 'Schémas d\'Étude';
  }
  if (t.includes('sujets') || t.includes('nsn') || t.includes('statistique') || t.includes('économique') || t.includes('décision') || t.includes('calcul')) {
    return 'Calculs & Statistiques';
  }
  if (t.includes('biais') || t.includes('confond') || t.includes('mesure') || t.includes('questionnaire') || t.includes('qualité de vie')) {
    return 'Gestion des Biais';
  }
  return 'Hypothèse & Question';
};

// Calculate competency scores using stats history and activity fallbacks
const getCompetencyScores = (stats: LocalStats) => {
  const competencies = [
    { name: 'Éthique & Réglementation', score: 0, count: 0 },
    { name: 'Schémas d\'Étude', score: 0, count: 0 },
    { name: 'Hypothèse & Question', score: 0, count: 0 },
    { name: 'Calculs & Statistiques', score: 0, count: 0 },
    { name: 'Gestion des Biais', score: 0, count: 0 }
  ];

  const history = stats.quizHistory || [];
  history.forEach(attempt => {
    const compName = mapTopicToCompetency(attempt.topic);
    const comp = competencies.find(c => c.name === compName);
    if (comp) {
      comp.score += attempt.scorePct;
      comp.count += 1;
    }
  });

  return competencies.map(comp => {
    let finalScore = 0;
    if (comp.count > 0) {
      finalScore = comp.score / comp.count;
    } else {
      // Activity fallbacks
      if (comp.name === 'Schémas d\'Étude' && stats.protocolsGenerated > 0) {
        finalScore = Math.min(75, 30 + stats.protocolsGenerated * 15);
      } else if (comp.name === 'Calculs & Statistiques' && stats.protocolsGenerated > 0) {
        finalScore = Math.min(60, 20 + stats.protocolsGenerated * 10);
      } else if (comp.name === 'Hypothèse & Question' && stats.questionsAsked > 0) {
        finalScore = Math.min(50, 15 + stats.questionsAsked * 5);
      } else if (stats.questionsAsked > 5) {
        finalScore = 15;
      }
    }
    return {
      name: comp.name,
      value: Math.round(finalScore)
    };
  });
};

// Pure SVG RadarChart Component
const RadarChart = ({ scores }: { scores: { name: string; value: number }[] }) => {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2 - 10;
  const r = 62;
  const numAxes = 5;

  const getCoordinates = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / numAxes;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  };

  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const gridPolygons = gridRings.map(pct => {
    const points = Array.from({ length: numAxes }, (_, i) => {
      const { x, y } = getCoordinates(i, r * pct);
      return `${x},${y}`;
    }).join(' ');
    return points;
  });

  const axisLines = Array.from({ length: numAxes }, (_, i) => {
    return getCoordinates(i, r);
  });

  const dataPoints = scores.map((s, i) => {
    const valuePct = s.value / 100;
    const radius = r * Math.max(0.05, valuePct);
    return getCoordinates(i, radius);
  });
  
  const dataPointsStr = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', maxWidth: '320px' }}>
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Rings */}
        {gridPolygons.map((pts, idx) => (
          <polygon
            key={idx}
            points={pts}
            fill="none"
            className={styles.radarGrid}
            strokeWidth="1"
          />
        ))}

        {/* Axes */}
        {axisLines.map((p, idx) => (
          <line
            key={idx}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            className={styles.radarAxis}
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}

        {/* Data polygon */}
        <polygon
          points={dataPointsStr}
          fill="url(#radarGradient)"
          className={styles.radarPolygon}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dataPoints.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="4"
            className={styles.radarPoint}
            strokeWidth="1.5"
          />
        ))}

        {/* Labels */}
        {scores.map((s, idx) => {
          const { x, y } = getCoordinates(idx, r + 14);
          
          let textAnchor: "inherit" | "end" | "start" | "middle" | undefined = 'middle';
          let dy = '0.35em';
          let dx = '0';
          
          if (idx === 0) {
            textAnchor = 'middle';
            dy = '-8px';
          } else if (idx === 1) {
            textAnchor = 'start';
            dx = '5px';
            dy = '0px';
          } else if (idx === 2) {
            textAnchor = 'start';
            dx = '5px';
            dy = '10px';
          } else if (idx === 3) {
            textAnchor = 'end';
            dx = '-5px';
            dy = '10px';
          } else if (idx === 4) {
            textAnchor = 'end';
            dx = '-5px';
            dy = '0px';
          }

          return (
            <text
              key={idx}
              x={x}
              y={y}
              dx={dx}
              dy={dy}
              textAnchor={textAnchor}
              className={styles.radarText}
              style={{
                fontSize: '8.5px',
                fontWeight: '600',
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '0.02em'
              }}
            >
              {s.name} ({s.value}%)
            </text>
          );
        })}
      </svg>
    </div>
  );
};

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
  const compScores = getCompetencyScores(stats);

  return (
    <div className={styles.container}>
      <header className={`${styles.header} no-print`}>
        <h1 className={styles.title}>Rapport Pédagogique & Suivi</h1>
        <p className={styles.subtitle}>
          Visualisez votre progression globale et obtenez un bilan méthodologique personnalisé généré par l'IA.
        </p>
      </header>

      {/* Dashboard : Statistiques + Graphique Radar */}
      <section className={`${styles.dashboardSection} no-print`}>
        <div className={styles.statsColumn}>
          <div className={`${styles.metricCard} glass-card`}>
            <div className={stats.questionsAsked > 0 ? styles.metricActiveValue : styles.metricValue}>{stats.questionsAsked}</div>
            <div className={styles.metricLabel}>Questions Tuteur</div>
          </div>
          <div className={`${styles.metricCard} glass-card`}>
            <div className={stats.protocolsGenerated > 0 ? styles.metricActiveValue : styles.metricValue}>{stats.protocolsGenerated}</div>
            <div className={styles.metricLabel}>Protocoles Créés</div>
          </div>
          <div className={`${styles.metricCard} glass-card`}>
            <div className={stats.quizTotal > 0 ? styles.metricActiveValue : styles.metricValue}>{quizPct}%</div>
            <div className={styles.metricLabel}>Réussite Quiz ({stats.quizCorrect}/{stats.quizTotal})</div>
          </div>
          <div className={`${styles.metricCard} glass-card`}>
            <div className={stats.flashcardsMastered.length > 0 ? styles.metricActiveValue : styles.metricValue}>{fcPct}%</div>
            <div className={styles.metricLabel}>Flashcards ({stats.flashcardsMastered.length}/12)</div>
          </div>
        </div>
        <div className={`${styles.radarCard} glass-card`}>
          <h3 className={styles.radarTitle}>Profil de Compétences Méthodologiques</h3>
          <RadarChart scores={compScores} />
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

            {/* Graphique radar dans le rapport imprimable */}
            <div className={styles.printRadarContainer}>
              <div className={styles.printRadarBox}>
                <h4 className={styles.printRadarTitle}>
                  Cartographie des Compétences de Recherche Clinique
                </h4>
                <RadarChart scores={compScores} />
              </div>
            </div>

            <div dangerouslySetInnerHTML={{ __html: formatReportMarkdown(report) }} />
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4;
                margin: 2cm 1.8cm 2cm 1.8cm;
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
              * {
                animation: none !important;
                transition: none !important;
                transform: none !important;
                box-shadow: none !important;
                text-shadow: none !important;
              }
              html, body, main, div, section, article {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                width: 100% !important;
                position: static !important;
                float: none !important;
                transform: none !important;
                overflow: visible !important;
              }
              .print-only-header {
                display: block !important;
              }
              h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid !important;
                break-after: avoid !important;
                color: black !important;
              }
              p, li, tr, td, th {
                page-break-inside: auto !important;
                break-inside: auto !important;
                color: black !important;
              }
              ul, ol {
                page-break-inside: auto !important;
                break-inside: auto !important;
              }
              .no-print,
              .no-print *,
              .faq-fab,
              .faq-drawer,
              .faq-overlay,
              [class*="faq-fab"],
              [class*="faq-drawer"],
              [class*="faq-overlay"],
              button,
              aside {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
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
