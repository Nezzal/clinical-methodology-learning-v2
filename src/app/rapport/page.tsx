'use client';

import React, { useState, useEffect } from 'react';
import { getProgress, LocalStats } from '@/utils/storage';
import { APP_VERSION_LABEL } from '@/utils/constants';
import { useAuth } from '@/context/AuthContext';
import { getUserTier, getQuotaConfig } from '@/utils/quota';
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

interface ReportSectionState {
  id: number;
  title: string;
  shortTitle: string;
  description: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  content: string | null;
}

const INITIAL_SECTIONS: ReportSectionState[] = [
  {
    id: 1,
    title: "1. Bilan Général de Progression et Positionnement",
    shortTitle: "Bilan Général",
    description: "Analyse du volume d'interactions, de l'assiduité et du niveau global.",
    status: 'idle',
    content: null
  },
  {
    id: 2,
    title: "2. Synthèse Détaillée des Compétences Méthodologiques",
    shortTitle: "Compétences & Réglementation",
    description: "Évaluation PICOT/FINE, Loi 18-11, éthique, NSN et maîtrise des biais.",
    status: 'idle',
    content: null
  },
  {
    id: 3,
    title: "3. Analyse des Acquis (Forces) et des Axes d'Amélioration",
    shortTitle: "Acquis & Axes de Progrès",
    description: "Synthèse des points forts identifiés et des lacunes prioritaires.",
    status: 'idle',
    content: null
  },
  {
    id: 4,
    title: "4. Focus Méthodologique Personnalisé (RECIF & STROBE)",
    shortTitle: "Focus RECIF & STROBE",
    description: "Conseils sur mesure liés à vos questions récentes et projets de protocole.",
    status: 'idle',
    content: null
  },
  {
    id: 5,
    title: "5. Plan d'Action Opérationnel et Recommandations Pédagogiques",
    shortTitle: "Plan d'Action",
    description: "Programme de travail recommandé en 4 étapes opérationnelles.",
    status: 'idle',
    content: null
  }
];

export default function RapportPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<LocalStats | null>(null);
  const [sections, setSections] = useState<ReportSectionState[]>(INITIAL_SECTIONS);
  const [isAutoProgressing, setIsAutoProgressing] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadStats = () => {
    setStats(getProgress());
  };

  useEffect(() => {
    loadStats();
    window.addEventListener('progress_changed', loadStats);
    
    const handleProviderChange = () => {
      setSections(INITIAL_SECTIONS);
    };
    window.addEventListener('ai_provider_changed', handleProviderChange);

    return () => {
      window.removeEventListener('progress_changed', loadStats);
      window.removeEventListener('ai_provider_changed', handleProviderChange);
    };
  }, []);

  const getPayload = () => {
    if (!stats) return null;
    return {
      questionsAsked: stats.questionsAsked,
      protocolsGenerated: stats.protocolsGenerated,
      quizScore: { correct: stats.quizCorrect, total: stats.quizTotal },
      flashcardsMastered: { mastered: stats.flashcardsMastered.length, total: 12 },
      recentQuestions: stats.recentQuestions,
      recentProtocols: stats.recentProtocols.map(p => `[${p.acronym}] ${p.title}`),
    };
  };

  const fetchSection = async (sectionId: number): Promise<boolean> => {
    const payload = getPayload();
    if (!payload) return false;

    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, status: 'loading' } : s));

    try {
      const provider = localStorage.getItem('recif_ai_provider') || 'gemini';
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
        body: JSON.stringify({ ...payload, sectionId })
      });

      const data = await response.json();

      if (response.ok && data.content) {
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, status: 'done', content: data.content } : s));
        return true;
      } else {
        throw new Error(data.error || 'Erreur lors de la génération de la section.');
      }
    } catch (err: any) {
      console.warn(`Erreur section ${sectionId}:`, err);
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, status: 'error' } : s));
      return false;
    }
  };

  const handleGenerateSingleSection = (sectionId: number) => {
    fetchSection(sectionId);
  };

  const handleContinueNextSection = () => {
    const nextSec = sections.find(s => s.status !== 'done');
    if (nextSec) {
      fetchSection(nextSec.id);
    }
  };

  const handleGenerateAllSequentially = async () => {
    setIsAutoProgressing(true);
    for (let i = 1; i <= 5; i++) {
      await fetchSection(i);
    }
    setIsAutoProgressing(false);
  };

  const handleResetSections = () => {
    setSections(INITIAL_SECTIONS);
  };

  const completedSectionsCount = sections.filter(s => s.status === 'done').length;
  const combinedReportMarkdown = sections
    .filter(s => s.content)
    .map(s => s.content)
    .join('\n\n---\n\n');

  const fullReportText = combinedReportMarkdown ? `# REPORTING PÉDAGOGIQUE ET BILAN DE SUIVI\n*Plateforme d'Apprentissage RECIF*\n\n` + combinedReportMarkdown : null;

  const handlePrint = () => {
    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);
    const paperEl = document.querySelector(`.${styles.reportPaper}`);
    if (!paperEl) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const paperHtml = paperEl.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Bilan Pédagogique et Suivi - RECIF Méthodologie</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --font-title: 'Outfit', sans-serif;
            --font-body: 'Inter', sans-serif;
          }

          @page {
            size: A4;
            margin: 1.8cm 1.6cm 1.8cm 1.6cm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: var(--font-body);
            color: #111827;
            background: #ffffff;
            line-height: 1.6;
            font-size: 10pt;
            margin: 0;
            padding: 0;
          }

          .print-only-header {
            display: block !important;
            border-bottom: 2px solid #005a70;
            padding-bottom: 0.5rem;
            margin-bottom: 1.5rem;
          }

          @media print, screen {
            body {
              margin: 0;
              padding: 0;
            }
            ${quotaConfig.watermark ? `
              body::before {
                content: "${quotaConfig.watermarkText}";
                position: fixed;
                top: 40%;
                left: -10%;
                right: -10%;
                text-align: center;
                font-size: 2.2rem;
                font-weight: 800;
                color: rgba(220, 38, 38, 0.16);
                transform: rotate(-30deg);
                pointer-events: none;
                z-index: 9999;
                letter-spacing: 3px;
                font-family: sans-serif;
              }
            ` : ''}
          }

          h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-title);
            color: #111827;
            page-break-after: avoid;
            break-after: avoid;
          }

          h1 {
            font-size: 18pt;
            text-align: center;
            margin-top: 0;
            margin-bottom: 1rem;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 0.5rem;
          }

          h2 {
            font-size: 13pt;
            color: #005a70;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 0.25rem;
          }

          h3 {
            font-size: 11pt;
            color: #0d9488;
            margin-top: 1.2rem;
            margin-bottom: 0.4rem;
          }

          p {
            margin-bottom: 0.75rem;
            text-align: justify;
            page-break-inside: auto;
            break-inside: auto;
          }

          ul, ol {
            margin-top: 0.25rem;
            margin-bottom: 0.75rem;
            padding-left: 1.5rem;
            page-break-inside: auto;
            break-inside: auto;
          }

          li {
            margin-bottom: 0.35rem;
            page-break-inside: auto;
            break-inside: auto;
          }

          hr {
            border: 0;
            border-top: 1px solid #e5e7eb;
            margin: 1.5rem 0;
          }

          blockquote {
            margin: 1rem 0;
            padding: 0.5rem 1rem;
            border-left: 4px solid #005a70;
            background: #f9fafb;
            font-style: italic;
          }

          /* Radar Chart Styling in Print Window */
          div[class*="printRadarContainer"] {
            display: block !important;
            text-align: center !important;
            margin: 0 auto 1.5rem auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          div[class*="printRadarBox"] {
            display: inline-block !important;
            background: transparent !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 8px;
            padding: 1rem;
            color: black !important;
            max-width: 340px;
            width: 100%;
          }

          h4[class*="printRadarTitle"] {
            color: #005a70 !important;
            margin: 0 0 0.5rem 0 !important;
            font-size: 10pt !important;
            font-family: var(--font-title);
          }

          svg {
            max-width: 100%;
            height: auto;
          }

          polygon[class*="radarGrid"] { stroke: #e5e7eb !important; }
          line[class*="radarAxis"] { stroke: #d1d5db !important; }
          polygon[class*="radarPolygon"] { stroke: #0284c7 !important; }
          circle[class*="radarPoint"] { fill: #0284c7 !important; stroke: white !important; }
          text[class*="radarText"] { fill: #111827 !important; font-size: 8pt !important; }

          @media print {
            body {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${paperHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    if (!fullReportText) return;
    const blob = new Blob([fullReportText], { type: 'text/plain;charset=utf-8' });
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
          Visualisez votre progression globale et rédigez votre bilan méthodologique personnalisé section par section (Approche Interactive A).
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

      {/* Dashboard Interactif des Cartes de Section (Approche A) */}
      <section className={`${styles.planSection} glass-card no-print`}>
        <div className={styles.planHeader}>
          <div>
            <h3 className={styles.planTitle}>
              Tableau de bord de rédaction par section ({completedSectionsCount}/5 rédigées)
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pilotez la génération de chaque chapitre indépendamment pour une analyse complète sans limitation de longueur.
            </p>
          </div>
          <div className={styles.planControls}>
            <button 
              className="btn btn-primary" 
              onClick={handleGenerateAllSequentially}
              disabled={isAutoProgressing}
            >
              {isAutoProgressing ? 'Rédaction pas-à-pas en cours...' : 'Lancer la rédaction complète pas-à-pas'}
            </button>
            {completedSectionsCount < 5 && (
              <button 
                className="btn btn-secondary" 
                onClick={handleContinueNextSection}
                disabled={isAutoProgressing}
              >
                Continuer (Section suivante)
              </button>
            )}
            {completedSectionsCount > 0 && (
              <button 
                className="btn" 
                style={{ background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-muted)' }} 
                onClick={handleResetSections}
                disabled={isAutoProgressing}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        <div className={styles.sectionCardsGrid}>
          {sections.map((sec) => (
            <div 
              key={sec.id} 
              className={`${styles.sectionCard} ${sec.status === 'loading' ? styles.sectionCardActive : sec.status === 'done' ? styles.sectionCardDone : ''}`}
            >
              <div>
                <div className={styles.sectionCardHeader}>
                  <span className={styles.sectionNumber}>Chapitre 0{sec.id}</span>
                  {sec.status === 'idle' && <span className={styles.badgeIdle}>Attente</span>}
                  {sec.status === 'loading' && <span className={styles.badgeLoading}><span className="animate-spin">⏳</span> Rédaction...</span>}
                  {sec.status === 'done' && <span className={styles.badgeDone}>✓ Rédigée ({sec.content ? sec.content.split(' ').length : 0} mots)</span>}
                  {sec.status === 'error' && <span className={styles.badgeError}>⚠️ Erreur</span>}
                </div>
                <h4 className={styles.sectionTitle}>{sec.shortTitle}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
                  {sec.description}
                </p>
              </div>
              <div className={styles.sectionActions}>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => handleGenerateSingleSection(sec.id)}
                  disabled={sec.status === 'loading' || isAutoProgressing}
                >
                  {sec.status === 'done' ? 'Régénérer cette section' : 'Générer la section'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feuille de rapport imprimable (Assemblage en direct) */}
      {fullReportText && (
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
              Imprimer / PDF ({completedSectionsCount}/5 sections)
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

            <div dangerouslySetInnerHTML={{ __html: formatReportMarkdown(fullReportText) }} />
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
                display: block !important;
                flex: none !important;
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
