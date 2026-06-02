'use client';

import React, { useState, useEffect } from 'react';
import { getProgress, updateProgress, LocalStats } from '@/utils/storage';
import { useAuth } from '@/context/AuthContext';
import { saveFirestoreProtocol, loadFirestoreProtocols, syncUserProfile } from '@/utils/firestore';
import styles from './page.module.css';

function renderProtocolHtmlTable(rows: string[]): string {
  if (rows.length === 0) return '';
  
  let html = '<div style="overflow-x: auto; margin: 1rem 0; width: 100%;"><table style="width: 100%; border-collapse: collapse; border: 1px solid var(--border-glass); font-size: 0.9rem; background-color: rgba(255, 255, 255, 0.01);">';
  
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

// Simple markdown formatter helper for protocol preview
function formatProtocolMarkdown(text: string): string {
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
        const htmlTable = renderProtocolHtmlTable(tableRows);
        processedLines.push(htmlTable);
        inTable = false;
      }
      processedLines.push(lines[i]);
    }
  }
  
  if (inTable) {
    const htmlTable = renderProtocolHtmlTable(tableRows);
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

export default function ProtocoleGenerator() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'methodo' | 'endpoints' | 'logistics' | 'finance'>('info');
  
  // Form State
  const [title, setTitle] = useState('');
  const [acronym, setAcronym] = useState('');
  const [methodology, setMethodology] = useState<'interventional' | 'observational'>('observational');
  const [benefitType, setBenefitType] = useState<'bid' | 'sbid'>('sbid');
  const [question, setQuestion] = useState('');
  const [design, setDesign] = useState('Essai Clinique Randomisé Contrôlé (ECR)');
  const [intervention, setIntervention] = useState('');
  const [population, setPopulation] = useState('');
  const [inclusion, setInclusion] = useState('');
  const [exclusion, setExclusion] = useState('');
  const [primaryEndpoint, setPrimaryEndpoint] = useState('');
  const [secondaryEndpoints, setSecondaryEndpoints] = useState('');

  // New Form State for 19 steps (Approche B)
  const [objectives, setObjectives] = useState('');
  const [bias, setBias] = useState('');
  const [justification, setJustification] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [logistics, setLogistics] = useState('');
  const [personnel, setPersonnel] = useState('');
  const [budget, setBudget] = useState('');
  const [calendar, setCalendar] = useState('');
  const [ethics, setEthics] = useState('');
  const [references, setReferences] = useState('');

  // App State
  const [generatedProtocol, setGeneratedProtocol] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<LocalStats['recentProtocols']>([]);
  const [hasLoadedFromUrl, setHasLoadedFromUrl] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        try {
          const firestoreProtos = await loadFirestoreProtocols(user.uid);
          setHistory(firestoreProtos);
        } catch (err) {
          console.error("Erreur lors de la récupération de l'historique des protocoles:", err);
          setHistory(getProgress().recentProtocols || []);
        }
      } else {
        setHistory(getProgress().recentProtocols || []);
      }
    };
    fetchHistory();
  }, [user]);

  // Load protocol from URL query param if present
  useEffect(() => {
    if (history.length > 0 && !hasLoadedFromUrl) {
      const params = new URLSearchParams(window.location.search);
      const protocolId = params.get('id');
      if (protocolId) {
        const selectedProto = history.find((h) => h.id === protocolId);
        if (selectedProto) {
          setGeneratedProtocol(selectedProto.content);
          setTitle(selectedProto.title);
          setAcronym(selectedProto.acronym);
        }
      }
      setHasLoadedFromUrl(true);
    }
  }, [history, hasLoadedFromUrl]);

  const handleGenerate = async () => {
    if (!title.trim() || !question.trim()) {
      alert('Veuillez remplir au moins le titre de l\'étude et la question de recherche.');
      return;
    }

    setLoading(true);
    setGeneratedProtocol(null);

    const formData = {
      title,
      acronym,
      methodology,
      benefitType,
      question,
      design,
      intervention,
      population,
      inclusion,
      exclusion,
      primaryEndpoint,
      secondaryEndpoints,
      objectives,
      bias,
      justification,
      hypothesis,
      logistics,
      personnel,
      budget,
      calendar,
      ethics,
      references
    };

    try {
      const response = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-ai-provider': localStorage.getItem('recif_ai_provider') || 'gemini'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedProtocol(data.protocol);
        
        // Sauvegarder dans l'historique local
        const newProtocolItem = {
          id: Math.random().toString(36).substring(7),
          title: title,
          acronym: acronym || 'SANS ACRONYME',
          date: new Date().toISOString(),
          content: data.protocol
        };

        updateProgress((stats) => {
          const updatedHistory = [newProtocolItem, ...stats.recentProtocols];
          return {
            protocolsGenerated: stats.protocolsGenerated + 1,
            recentProtocols: updatedHistory.slice(0, 15) // Garder les 15 derniers
          };
        });

        // Si connecté, synchroniser avec Firestore en arrière-plan sans bloquer l'UI
        if (user) {
          saveFirestoreProtocol(user.uid, newProtocolItem)
            .catch(e => console.error("Erreur de sauvegarde du protocole sur Firestore:", e));
          
          syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, getProgress())
            .catch(e => console.error("Erreur de synchronisation du profil sur Firestore:", e));
        }

        // Mettre à jour l'état local de l'historique
        setHistory((prev) => [newProtocolItem, ...prev].slice(0, 15));
      } else {
        throw new Error(data.error || 'Erreur lors de la génération.');
      }
    } catch (error: any) {
      alert(`⚠️ Échec de la génération : ${error.message || 'Le serveur n\'a pas pu répondre.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedProtocol) return;
    navigator.clipboard.writeText(generatedProtocol);
    alert('Protocole copié dans le presse-papiers !');
  };

  const handleDownload = (format: 'md' | 'txt') => {
    if (!generatedProtocol) return;
    const blob = new Blob([generatedProtocol], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `protocole_${acronym || 'recherche'}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (!generatedProtocol) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour pouvoir exporter le PDF.');
      return;
    }

    const formattedHtml = formatProtocolMarkdown(generatedProtocol);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Protocole [${acronym || 'SANS ACRONYME'}] - ${title || 'Sans titre'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --font-title: 'Outfit', sans-serif;
            --font-body: 'Inter', sans-serif;
            --accent-primary: #005a70;
            --accent-secondary: #0d9488;
            --border-glass: #e5e7eb;
            --text-primary: #111827;
          }

          
          body {
            font-family: var(--font-body);
            color: #1f2937;
            line-height: 1.6;
            padding: 2cm 2.5cm;
            font-size: 11pt;
            background: #ffffff;
          }

          @page {
            size: A4;
            margin: 2cm;
          }

          /* En-tête */
          .doc-header {
            border-bottom: 2px solid #005a70;
            padding-bottom: 0.5rem;
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }

          .doc-header h3 {
            margin: 0;
            font-family: var(--font-title);
            font-size: 13pt;
            color: #005a70;
            font-weight: 700;
          }

          .doc-header p {
            margin: 2px 0 0 0;
            font-size: 9pt;
            color: #6b7280;
          }

          .doc-header-date {
            font-size: 9pt;
            color: #6b7280;
          }

          /* Titre */
          h1 {
            font-family: var(--font-title);
            font-size: 20pt;
            color: #111827;
            text-align: center;
            margin-top: 2rem;
            margin-bottom: 1rem;
            font-weight: 700;
            line-height: 1.25;
          }

          .acronym-badge {
            display: block;
            text-align: center;
            font-family: var(--font-title);
            font-size: 12pt;
            background: #0f172a;
            color: #ffffff;
            padding: 0.35rem 1rem;
            border-radius: 4px;
            width: fit-content;
            margin: 0 auto 2rem auto;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          /* Sections */
          h2 {
            font-family: var(--font-title);
            font-size: 14pt;
            color: #005a70;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 0.25rem;
            margin-top: 2.5rem;
            margin-bottom: 0.75rem;
            font-weight: 600;
            page-break-after: avoid;
          }

          h3 {
            font-family: var(--font-title);
            font-size: 11pt;
            color: #111827;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
            page-break-after: avoid;
          }

          p {
            margin-top: 0;
            margin-bottom: 0.85rem;
            text-align: justify;
          }

          ul, ol {
            margin-top: 0;
            margin-bottom: 1rem;
            padding-left: 1.5rem;
          }

          li {
            margin-bottom: 0.35rem;
          }

          /* Bas de page */
          .doc-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            border-top: 1px solid #e5e7eb;
            padding-top: 0.5rem;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #9ca3af;
          }

          hr {
            border: 0;
            border-top: 1px solid #e5e7eb;
            margin: 2rem 0;
          }

          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div>
            <h3>PROTOCOLE DE RECHERCHE CLINIQUE</h3>
            <p>Conforme aux recommandations RECIF & Loi n° 18-11 Santé (Algérie)</p>
          </div>
          <div class="doc-header-date">
            Généré le ${new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>

        <h1>${title}</h1>
        ${acronym ? `<div class="acronym-badge">${acronym}</div>` : ''}

        <div class="doc-body">
          ${formattedHtml}
        </div>

        <div class="doc-footer">
          <span>Plateforme RECIF Éducation - Formation en Méthodologie</span>
          <span>Algérie • Ministère de la Santé</span>
        </div>

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

  const handleSelectHistory = (content: string, histTitle: string, histAcronym: string) => {
    setGeneratedProtocol(content);
    setTitle(histTitle);
    setAcronym(histAcronym);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Générateur de Protocole de Recherche</h1>
        <p className={styles.subtitle}>
          Remplissez les détails cliniques pour générer une trame de protocole formalisée selon les exigences du RECIF.
        </p>
      </header>

      <div className={styles.layout}>
        {/* Formulaire de gauche */}
        <div className={`${styles.formCard} glass-card`}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'info' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('info')}
            >
              1. Identité & Régles
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'methodo' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('methodo')}
            >
              2. Objectifs & Schéma
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'endpoints' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('endpoints')}
            >
              3. Critères & Population
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'logistics' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('logistics')}
            >
              4. Logistique & Personnel
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'finance' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('finance')}
            >
              5. Budget & Calendrier
            </button>
          </div>

          <div className={styles.stepContainer}>
            {activeTab === 'info' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="title">Titre Complet de l'étude *</label>
                  <input
                    id="title"
                    type="text"
                    className="form-input"
                    placeholder="ex. Évaluation de l'efficacité de la thérapie X..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="acronym">Acronyme</label>
                  <input
                    id="acronym"
                    type="text"
                    className="form-input"
                    placeholder="ex. COVID-CARE"
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="methodology">Type de Recherche (Méthodologie)</label>
                  <select
                    id="methodology"
                    className="form-select"
                    value={methodology}
                    onChange={(e) => setMethodology(e.target.value as 'interventional' | 'observational')}
                  >
                    <option value="observational">Étude clinique observationnelle (Épidémiologique ou pharmaco-épidémiologique)</option>
                    <option value="interventional">Étude clinique interventionnelle (Essai thérapeutique, diagnostique ou préventif)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="benefitType">Bénéfice individuel attendu (Loi n° 18-11)</label>
                  <select
                    id="benefitType"
                    className="form-select"
                    value={benefitType}
                    onChange={(e) => setBenefitType(e.target.value as 'bid' | 'sbid')}
                  >
                    <option value="sbid">Étude sans bénéfice individuel direct (SBID, Art. 391)</option>
                    <option value="bid">Étude avec bénéfice individuel direct (Art. 388)</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === 'methodo' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="question">Question de recherche principale *</label>
                  <textarea
                    id="question"
                    className="form-textarea"
                    placeholder="Quelle est la question clinique précise à laquelle l'étude doit répondre ?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="justification">Justification de l'étude (Le "Pourquoi")</label>
                  <textarea
                    id="justification"
                    className="form-textarea"
                    placeholder="Pourquoi cette étude est-elle importante ? Originalité, urgence ou saisine d'hôpitaux..."
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="objectives">Objectifs secondaires</label>
                  <textarea
                    id="objectives"
                    className="form-textarea"
                    placeholder="Décrivez les objectifs secondaires ou intermédiaires..."
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hypothesis">Hypothèse(s) de recherche</label>
                  <textarea
                    id="hypothesis"
                    className="form-textarea"
                    placeholder="Quelle est la réponse théorique ou l'hypothèse principale à valider ?"
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="design">Schéma d'étude préconisé</label>
                  <select
                    id="design"
                    className="form-select"
                    value={design}
                    onChange={(e) => setDesign(e.target.value)}
                  >
                    <option value="Essai Clinique Randomisé Contrôlé (ECR)">Essai Clinique Randomisé Contrôlé (ECR)</option>
                    <option value="Étude de Cohorte prospective">Étude de Cohorte prospective</option>
                    <option value="Étude de Cohorte rétrospective">Étude de Cohorte rétrospective</option>
                    <option value="Étude Cas-Témoins">Étude Cas-Témoins</option>
                    <option value="Étude Transversale">Étude Transversale</option>
                    <option value="Série de cas cliniques">Série de cas cliniques (Descriptive pure)</option>
                    <option value="Étude d'évaluation diagnostique">Étude d'évaluation diagnostique (Sensibilité, spécificité, Gold Standard)</option>
                    <option value="Méta-analyse">Méta-analyse (Revue systématique quantitative)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="intervention">Description de l'intervention ou de l'exposition</label>
                  <textarea
                    id="intervention"
                    className="form-textarea"
                    placeholder="Décrivez précisément le traitement, le protocole de soin ou le paramètre évalué..."
                    value={intervention}
                    onChange={(e) => setIntervention(e.target.value)}
                  />
                </div>
              </>
            )}

            {activeTab === 'endpoints' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="pop">Population cible</label>
                  <input
                    id="pop"
                    type="text"
                    className="form-input"
                    placeholder="ex. Patients adultes atteints de diabète de type 2..."
                    value={population}
                    onChange={(e) => setPopulation(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="primary">Critère de Jugement Principal *</label>
                  <input
                    id="primary"
                    type="text"
                    className="form-input"
                    placeholder="Mesure clé (ex. Taux d'HbA1c à 6 mois)"
                    value={primaryEndpoint}
                    onChange={(e) => setPrimaryEndpoint(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="secondary">Critères de Jugement Secondaires</label>
                  <input
                    id="secondary"
                    type="text"
                    className="form-input"
                    placeholder="ex. Tolérance biologique, qualité de vie, coûts"
                    value={secondaryEndpoints}
                    onChange={(e) => setSecondaryEndpoints(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="inclusion">Critères d'inclusion principaux (un par ligne)</label>
                  <textarea
                    id="inclusion"
                    className="form-textarea"
                    placeholder="ex. Âge >= 18 ans&#10;Diagnostic confirmé depuis > 1 an"
                    value={inclusion}
                    onChange={(e) => setInclusion(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="exclusion">Critères d'exclusion (un par ligne)</label>
                  <textarea
                    id="exclusion"
                    className="form-textarea"
                    placeholder="ex. Insuffisance rénale sévère&#10;Grossesse ou allaitement"
                    value={exclusion}
                    onChange={(e) => setExclusion(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bias">Biais de recherche et facteurs de confusion</label>
                  <textarea
                    id="bias"
                    className="form-textarea"
                    placeholder="ex. Biais de mémorisation, biais de sélection lié à la clandestinité..."
                    value={bias}
                    onChange={(e) => setBias(e.target.value)}
                  />
                </div>
              </>
            )}

            {activeTab === 'logistics' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="logistics">Récolte des données & Étude pilote</label>
                  <textarea
                    id="logistics"
                    className="form-textarea"
                    placeholder="Logistique pratique, chaîne du froid, stockage, validation des questionnaires via une étude pilote..."
                    value={logistics}
                    onChange={(e) => setLogistics(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="personnel">Personnel et rôles requis</label>
                  <textarea
                    id="personnel"
                    className="form-textarea"
                    placeholder="Qui participe (ARC, statisticiens, enquêteurs, psychologue clinicien...) et quels sont leurs rôles ?"
                    value={personnel}
                    onChange={(e) => setPersonnel(e.target.value)}
                  />
                </div>
              </>
            )}

            {activeTab === 'finance' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="budget">Budget et Financement</label>
                  <textarea
                    id="budget"
                    className="form-textarea"
                    placeholder="Chiffrage estimé (dosages, chélatants, licences de tests, promoteurs) et sources de financement..."
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="calendar">Calendrier prévisionnel</label>
                  <textarea
                    id="calendar"
                    className="form-textarea"
                    placeholder="Jalons principaux, recrutement, délais éthiques, soumissions et rédaction..."
                    value={calendar}
                    onChange={(e) => setCalendar(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ethics">Considérations éthiques supplémentaires</label>
                  <textarea
                    id="ethics"
                    className="form-textarea"
                    placeholder="Détails sur l'anonymisation, la notice d'information ou les dilemmes éthiques spécifiques..."
                    value={ethics}
                    onChange={(e) => setEthics(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="references">Références bibliographiques & Annexes</label>
                  <textarea
                    id="references"
                    className="form-textarea"
                    placeholder="Conventions, études toxicologiques de référence, grilles d'inspection environnementale à joindre..."
                    value={references}
                    onChange={(e) => setReferences(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className={styles.navButtons}>
            {activeTab === 'info' && (
              <button className="btn btn-secondary" style={{ visibility: 'hidden' }}>Précédent</button>
            )}
            {activeTab === 'methodo' && (
              <button className="btn btn-secondary" onClick={() => setActiveTab('info')}>Précédent</button>
            )}
            {activeTab === 'endpoints' && (
              <button className="btn btn-secondary" onClick={() => setActiveTab('methodo')}>Précédent</button>
            )}
            {activeTab === 'logistics' && (
              <button className="btn btn-secondary" onClick={() => setActiveTab('endpoints')}>Précédent</button>
            )}
            {activeTab === 'finance' && (
              <button className="btn btn-secondary" onClick={() => setActiveTab('logistics')}>Précédent</button>
            )}

            {activeTab !== 'finance' ? (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (activeTab === 'info') setActiveTab('methodo');
                  else if (activeTab === 'methodo') setActiveTab('endpoints');
                  else if (activeTab === 'endpoints') setActiveTab('logistics');
                  else if (activeTab === 'logistics') setActiveTab('finance');
                }}
              >
                Suivant
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={loading || !title.trim() || !question.trim()}
              >
                {loading ? 'Génération en cours...' : 'Générer le Protocole'}
              </button>
            )}
          </div>
        </div>

        {/* Prévisualisation de droite */}
        <div className={`${styles.previewCard} glass-card`}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>Prévisualisation du Protocole</span>
            {generatedProtocol && (
              <div className={styles.previewActions}>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleCopy}>
                  Copier
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleDownload('md')}>
                  Télécharger .md
                </button>
                <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleExportPDF}>
                  Exporter en PDF
                </button>
              </div>
            )}
          </div>

          <div className={styles.previewBody}>
            {loading ? (
              <div className={styles.emptyPreview}>
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <svg className="animate-pulse" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 2s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>L'IA de Méthodo Clinique rédige votre protocole méthodologique...</span>
                </div>
              </div>
            ) : generatedProtocol ? (
              <div dangerouslySetInnerHTML={{ __html: formatProtocolMarkdown(generatedProtocol) }} />
            ) : (
              <div className={styles.emptyPreview}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>Remplissez le formulaire de gauche et cliquez sur "Générer" pour obtenir un protocole de recherche complet et structuré.</span>
              </div>
            )}
          </div>
        </div>

        {/* Historique des protocoles récents */}
        {history.length > 0 && (
          <section className={styles.historySection}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Protocoles sauvegardés</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sélectionnez un protocole pour le recharger dans la fenêtre de prévisualisation.</p>
            <div className={styles.historyList}>
              {history.map((h) => (
                <div
                  key={h.id}
                  className={`${styles.historyItem} glass-card`}
                  onClick={() => handleSelectHistory(h.content, h.title, h.acronym)}
                >
                  <div className={styles.historyMeta}>
                    <span>{h.acronym}</span>
                    <span>{new Date(h.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <h4 className={styles.historyTitle}>{h.title.length > 40 ? h.title.substring(0, 40) + '...' : h.title}</h4>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
