'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProgress, updateProgress } from '@/utils/storage';
import { useAuth } from '@/context/AuthContext';
import { saveFirestoreArticle, loadFirestoreArticles, syncUserProfile, deleteFirestoreArticle } from '@/utils/firestore';
import { APP_NAME, APP_VERSION } from '@/utils/constants';
import { getUserTier, getQuotaConfig } from '@/utils/quota';
import { QuotaModal } from '@/components/QuotaModal';
import SubscriptionModal from '@/components/SubscriptionModal';
import styles from './page.module.css';

function renderMarkdown(text: string): string {
  if (!text) return '';
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
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2 style="margin-top: 1.75rem; margin-bottom: 0.75rem; color: var(--accent-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.25rem; font-size:1.25rem;">$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--text-primary); font-size:1.5rem; text-align:center;">$1</h1>');

  // Horizontal rules
  formatted = formatted.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid var(--border-glass); margin: 1.5rem 0;" />');

  // List items
  formatted = formatted.replace(/^\s*[-*]\s+(.*?)$/gm, '<li style="margin-left: 1.25rem; list-style-type: disc; margin-bottom: 0.35rem;">$1</li>');

  // Double newlines to paragraphs
  formatted = formatted.split(/\n\n+/).map(p => {
    if (p.trim().startsWith('<h') || p.trim().startsWith('<li') || p.trim().startsWith('<ul') || p.trim().startsWith('<table') || p.trim().startsWith('<div') || p.trim().startsWith('<hr')) {
      return p;
    }
    return `<p style="margin-bottom: 1rem;">${p.replace(/\n/g, '<br />')}</p>`;
  }).join('\n');

  return formatted;
}

export default function ArticleGenerator() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'intro' | 'methodo' | 'results' | 'discussion' | 'funding'>('info');
  const [articles, setArticles] = useState<any[]>([]);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [studyType, setStudyType] = useState<'cohort' | 'case-control' | 'cross-sectional'>('cohort');
  const [abstract, setAbstract] = useState('');
  const [rationale, setRationale] = useState('');
  const [objectives, setObjectives] = useState('');
  const [design, setDesign] = useState('');
  const [setting, setSetting] = useState('');
  const [participants, setParticipants] = useState('');
  const [variables, setVariables] = useState('');
  const [dataSources, setDataSources] = useState('');
  const [bias, setBias] = useState('');
  const [studySize, setStudySize] = useState('');
  const [quantitativeVariables, setQuantitativeVariables] = useState('');
  const [statisticalMethods, setStatisticalMethods] = useState('');
  const [participantsFlow, setParticipantsFlow] = useState('');
  const [descriptiveData, setDescriptiveData] = useState('');
  const [outcomeData, setOutcomeData] = useState('');
  const [mainResults, setMainResults] = useState('');
  const [otherAnalyses, setOtherAnalyses] = useState('');
  const [keyResults, setKeyResults] = useState('');
  const [limitations, setLimitations] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [generalisability, setGeneralisability] = useState('');
  const [funding, setFunding] = useState('');

  const [generatedArticle, setGeneratedArticle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Load articles on mount
  useEffect(() => {
    const fetchArticles = async () => {
      setLoadingArticles(true);
      try {
        if (user) {
          const list = await loadFirestoreArticles(user.uid);
          if (list && list.length > 0) {
            setArticles(list);
          } else {
            setArticles(getProgress().recentArticles || []);
          }
        } else {
          setArticles(getProgress().recentArticles || []);
        }
      } catch (e) {
        console.error("Error loading articles:", e);
        setArticles(getProgress().recentArticles || []);
      } finally {
        setLoadingArticles(false);
      }
    };
    fetchArticles();
  }, [user]);

  // Import from localStorage if direct redirect from Tutor STROBE Mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('import') === 'direct') {
        const stored = localStorage.getItem('recif_imported_strobe_params');
        if (stored) {
          try {
            const params = JSON.parse(stored);
            fillFormFields(params);
            setExtractionSuccess(true);
            setExtractionError(null);
            
            localStorage.removeItem('recif_imported_strobe_params');
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.error("Failed to parse STROBE params:", e);
            setExtractionError("Erreur lors de la lecture des paramètres importés.");
          }
        }
      }
    }
  }, []);

  const fillFormFields = (p: any) => {
    if (!p) return;
    setTitle(p.title || '');
    setStudyType(p.studyType || 'cohort');
    setAbstract(p.abstract || '');
    setRationale(p.rationale || '');
    setObjectives(p.objectives || '');
    setDesign(p.design || '');
    setSetting(p.setting || '');
    setParticipants(p.participants || '');
    setVariables(p.variables || '');
    setDataSources(p.dataSources || '');
    setBias(p.bias || '');
    setStudySize(p.studySize || '');
    setQuantitativeVariables(p.quantitativeVariables || '');
    setStatisticalMethods(p.statisticalMethods || '');
    setParticipantsFlow(p.participantsFlow || '');
    setDescriptiveData(p.descriptiveData || '');
    setOutcomeData(p.outcomeData || '');
    setMainResults(p.mainResults || '');
    setOtherAnalyses(p.otherAnalyses || '');
    setKeyResults(p.keyResults || '');
    setLimitations(p.limitations || '');
    setInterpretation(p.interpretation || '');
    setGeneralisability(p.generalisability || '');
    setFunding(p.funding || '');
  };

  const handleNewArticle = () => {
    setActiveArticleId(null);
    setGeneratedArticle(null);
    setTitle('');
    setStudyType('cohort');
    setAbstract('');
    setRationale('');
    setObjectives('');
    setDesign('');
    setSetting('');
    setParticipants('');
    setVariables('');
    setDataSources('');
    setBias('');
    setStudySize('');
    setQuantitativeVariables('');
    setStatisticalMethods('');
    setParticipantsFlow('');
    setDescriptiveData('');
    setOutcomeData('');
    setMainResults('');
    setOtherAnalyses('');
    setKeyResults('');
    setLimitations('');
    setInterpretation('');
    setGeneralisability('');
    setFunding('');
    setExtractionSuccess(false);
    setActiveTab('info');
  };

  const handleSelectArticle = (art: any) => {
    setActiveArticleId(art.id);
    setGeneratedArticle(art.content);
    fillFormFields(art.formData || art);
    if (art.studyType) {
      setStudyType(art.studyType);
    }
    setExtractionSuccess(false);
    setActiveTab('info');
  };

  const handleSaveArticle = async (contentToSave: string) => {
    setSaving(true);
    const artId = activeArticleId || `article_${Math.random().toString(36).substring(7)}`;
    const artTitle = title || "Article STROBE sans titre";

    const articleData = {
      id: artId,
      title: artTitle,
      studyType,
      date: new Date().toISOString(),
      content: contentToSave,
      formData: {
        title, studyType, abstract, rationale, objectives, design, setting, participants,
        variables, dataSources, bias, studySize, quantitativeVariables, statisticalMethods,
        participantsFlow, descriptiveData, outcomeData, mainResults, otherAnalyses,
        keyResults, limitations, interpretation, generalisability, funding
      }
    };

    updateProgress((stats) => {
      const recent = stats.recentArticles || [];
      const filtered = recent.filter((a) => a.id !== artId);
      const updatedArticles = [articleData, ...filtered].slice(0, 15);
      return {
        ...stats,
        recentArticles: updatedArticles
      };
    });

    setArticles((prev) => {
      const filtered = prev.filter((a) => a.id !== artId);
      return [articleData, ...filtered];
    });

    if (user) {
      try {
        await saveFirestoreArticle(user.uid, articleData);
        setActiveArticleId(artId);
        const list = await loadFirestoreArticles(user.uid);
        if (list && list.length > 0) setArticles(list);
      } catch (e) {
        console.error("Error saving article to Firestore:", e);
      }
    }
    setSaving(false);
  };

  const handleRegenerateArticle = async (e: React.MouseEvent, art: any) => {
    e.stopPropagation();
    if (!window.confirm(`Souhaitez-vous régénérer entièrement l'article "${art.title}" avec l'IA ?`)) return;

    handleSelectArticle(art);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      handleGenerateArticle();
    }, 200);
  };

  const handleDeleteArticleClick = async (e: React.MouseEvent, artId: string) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer définitivement cet article ?")) return;

    setArticles((prev) => prev.filter((a) => a.id !== artId));

    if (activeArticleId === artId) {
      handleNewArticle();
    }

    updateProgress((stats) => {
      const updatedArticles = (stats.recentArticles || []).filter((a) => a.id !== artId);
      return {
        ...stats,
        recentArticles: updatedArticles
      };
    });

    if (user) {
      try {
        await deleteFirestoreArticle(user.uid, artId);
      } catch (err) {
        console.error("Error deleting article on Firestore:", err);
      }
    }
  };

  const { profile } = useAuth();
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const handleGenerateArticle = async () => {
    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);
    const isExistingArticle = !!activeArticleId;

    if (!isExistingArticle && articles.length >= quotaConfig.articlesMax) {
      setShowQuotaModal(true);
      setGenerating(false);
      return;
    }

    setGenerating(true);
    setGeneratedArticle(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-ai-provider': localStorage.getItem('recif_ai_provider') || 'gemini',
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

      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title, studyType, abstract, rationale, objectives, design, setting, participants,
          variables, dataSources, bias, studySize, quantitativeVariables, statisticalMethods,
          participantsFlow, descriptiveData, outcomeData, mainResults, otherAnalyses,
          keyResults, limitations, interpretation, generalisability, funding
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue lors de la génération.");
      }

      setGeneratedArticle(data.article);
      
      // Update student stats in localStorage and Firestore
      updateProgress((prev) => ({ protocolsGenerated: (prev.protocolsGenerated || 0) + 1 }));
      if (user) {
        await syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, getProgress());
      }
      
      // Auto save article
      await handleSaveArticle(data.article);
    } catch (err: any) {
      alert(`⚠️ Échec de la génération de l'article : ${err.message || err}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!generatedArticle) return;
    const blob = new Blob([generatedArticle], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanTitle = (title || 'article_strobe').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `article_strobe_${cleanTitle}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!generatedArticle) return;
    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);
    const htmlContent = renderMarkdown(generatedArticle);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres contextuelles pour imprimer l'article.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${title || "Article Scientifique STROBE"}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #333;
              line-height: 1.6;
              padding: 2.5rem;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              font-size: 2rem;
              color: #0d9488;
              border-bottom: 2px solid #0d9488;
              padding-bottom: 0.5rem;
              margin-bottom: 1.5rem;
              text-align: center;
            }
            h2 {
              font-size: 1.4rem;
              color: #0f766e;
              margin-top: 2rem;
              border-bottom: 1px solid #ddd;
              padding-bottom: 0.25rem;
            }
            h3 {
              font-size: 1.15rem;
              color: #115e59;
              margin-top: 1.5rem;
            }
            p, li {
              font-size: 0.95rem;
              text-align: justify;
            }
            li {
              margin-bottom: 0.5rem;
            }
            hr {
              border: 0;
              border-top: 1px solid #eee;
              margin: 2rem 0;
            }
            .meta-block {
              margin-bottom: 2rem;
              font-size: 0.9rem;
              color: #555;
              background: #f9f9f9;
              padding: 1.25rem;
              border-radius: 6px;
              border-left: 4px solid #0d9488;
            }
            .footer {
              margin-top: 4rem;
              font-size: 0.8rem;
              color: #666;
              text-align: center;
              border-top: 1px solid #eee;
              padding-top: 1rem;
            }
            @media print, screen {
              body {
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
          </style>
        </head>
        <body>
          <h1>${title || "Article d'Étude Observationnelle STROBE"}</h1>
          <div class="meta-block">
            <strong>Schéma méthodologique :</strong> ${studyType === 'cohort' ? 'Étude de cohorte' : (studyType === 'case-control' ? 'Étude cas-témoins' : 'Étude transversale')} (Normes STROBE)<br/>
            <strong>Date de rédaction :</strong> ${new Date().toLocaleDateString('fr-FR')}
          </div>
          <div>
            ${htmlContent}
          </div>
          <div class="footer">
            ${APP_NAME} v${APP_VERSION}
          </div>
          ${quotaConfig.watermark ? `
            <div style="text-align:center; font-size:8.5pt; color:#ef4444; font-weight:700; border-top:1px dashed #fca5a5; padding-top:8px; margin-top:28px; font-family: sans-serif;">
              ⚠️ ${quotaConfig.watermarkText} — Surclassez votre compte vers la Formule ULTRA pour exporter sans filigrane
            </div>
          ` : ''}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className={styles.title} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', margin: 0 }}>
            <span>Rédacteur d'Article STROBE</span>
            {activeArticleId && (
              <span style={{ fontSize: '0.85rem', fontWeight: 500, padding: '0.25rem 0.6rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '4px', verticalAlign: 'middle' }}>
                Chargé
              </span>
            )}
          </h1>
          <p className={styles.subtitle} style={{ margin: '0.25rem 0 0 0' }}>
            Rédigez votre article scientifique pas-à-pas selon les 22 critères de publication STROBE.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <a
            href="/docs/strobe_checklist_fr.md"
            download
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Grille STROBE (MD)
          </a>
          {activeArticleId && (
            <button className="btn btn-secondary" onClick={handleNewArticle}>
              Nouvel Article
            </button>
          )}
        </div>
      </header>

      {extractionSuccess && (
        <div className={styles.successNotice}>
          🎉 <b>Bilan STROBE importé du Tuteur !</b> Les réponses synthétisées ont été chargées dans le formulaire. Vous pouvez maintenant relire les sections, compléter les données descriptives de vos résultats, puis cliquer sur <b>Générer l'article par l'IA</b>.
        </div>
      )}

      {extractionError && (
        <div className={styles.errorNotice}>
          ⚠️ {extractionError}
        </div>
      )}

      <div className={styles.layout}>
        {/* FORM CARD (LEFT) */}
        <div className={`${styles.formCard} glass-card`}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'info' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('info')}
            >
              1. Titre & Résumé
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'intro' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('intro')}
            >
              2. Introduction
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'methodo' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('methodo')}
            >
              3. Méthodes
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'results' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('results')}
            >
              4. Résultats
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'discussion' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('discussion')}
            >
              5. Discussion
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'funding' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('funding')}
            >
              6. Financement
            </button>
          </div>

          <div className={styles.stepContainer}>
            {/* 1. Titre & Résumé */}
            {activeTab === 'info' && (
              <>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-title" className={styles.strobeLabel}>Titre de l'article</label>
                    <span className={styles.strobeBadge}>STROBE 1</span>
                  </div>
                  <textarea
                    id="art-title"
                    className={styles.strobeTextarea}
                    rows={2}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Facteurs associés à la mortalité par maladies cardiovasculaires en Algérie : étude transversale..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-type" className={styles.strobeLabel}>Type d'étude observationnelle</label>
                    <span className={styles.strobeBadge}>STROBE 1</span>
                  </div>
                  <select
                    id="art-type"
                    className={styles.strobeSelect}
                    value={studyType}
                    onChange={(e) => setStudyType(e.target.value as any)}
                  >
                    <option value="cohort">Étude de Cohorte (Suivi temporel)</option>
                    <option value="case-control">Étude Cas-Témoins (Rétrospective comparée)</option>
                    <option value="cross-sectional">Étude Transversale (Observation à un instant t)</option>
                  </select>
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-abstract" className={styles.strobeLabel}>Résumé structuré</label>
                    <span className={styles.strobeBadge}>STROBE 2</span>
                  </div>
                  <textarea
                    id="art-abstract"
                    className={styles.strobeTextarea}
                    rows={6}
                    value={abstract}
                    onChange={(e) => setAbstract(e.target.value)}
                    placeholder="Présenter un résumé informatif et équilibré de ce qui a été fait et trouvé..."
                  />
                </div>
              </>
            )}

            {/* 2. Introduction */}
            {activeTab === 'intro' && (
              <>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-rationale" className={styles.strobeLabel}>Contexte & Justification</label>
                    <span className={styles.strobeBadge}>STROBE 3</span>
                  </div>
                  <textarea
                    id="art-rationale"
                    className={styles.strobeTextarea}
                    rows={5}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Expliquer le contexte scientifique, les motifs de la recherche et l'état actuel des connaissances..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-objectives" className={styles.strobeLabel}>Objectifs & Hypothèses</label>
                    <span className={styles.strobeBadge}>STROBE 4</span>
                  </div>
                  <textarea
                    id="art-objectives"
                    className={styles.strobeTextarea}
                    rows={4}
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    placeholder="Indiquer les objectifs spécifiques, y compris toute hypothèse pré-spécifiée..."
                  />
                </div>
              </>
            )}

            {/* 3. Méthodes */}
            {activeTab === 'methodo' && (
              <>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-design" className={styles.strobeLabel}>Schéma d'étude</label>
                    <span className={styles.strobeBadge}>STROBE 5</span>
                  </div>
                  <textarea
                    id="art-design"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={design}
                    onChange={(e) => setDesign(e.target.value)}
                    placeholder="Ex: Étude observationnelle transversale multicentrique..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-setting" className={styles.strobeLabel}>Cadre (dates, lieux, recrutement)</label>
                    <span className={styles.strobeBadge}>STROBE 6</span>
                  </div>
                  <textarea
                    id="art-setting"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={setting}
                    onChange={(e) => setSetting(e.target.value)}
                    placeholder="Décrire le cadre, les lieux et les dates importantes (recrutement, expositions, collecte)..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-participants" className={styles.strobeLabel}>Sélection des participants & Éligibilité</label>
                    <span className={styles.strobeBadge}>STROBE 6</span>
                  </div>
                  <textarea
                    id="art-participants"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="Critères d'éligibilité, sources et méthodes de sélection des participants..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-variables" className={styles.strobeLabel}>Variables étudiées</label>
                    <span className={styles.strobeBadge}>STROBE 7</span>
                  </div>
                  <textarea
                    id="art-variables"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={variables}
                    onChange={(e) => setVariables(e.target.value)}
                    placeholder="Définir clairement toutes les variables : exposition, critères d'évaluation, confusion..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-datasources" className={styles.strobeLabel}>Sources de données & Mesures</label>
                    <span className={styles.strobeBadge}>STROBE 8</span>
                  </div>
                  <textarea
                    id="art-datasources"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={dataSources}
                    onChange={(e) => setDataSources(e.target.value)}
                    placeholder="Indiquer les sources des données et le détail des méthodes d'évaluation (mesures)..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-bias" className={styles.strobeLabel}>Efforts contre les biais</label>
                    <span className={styles.strobeBadge}>STROBE 9</span>
                  </div>
                  <textarea
                    id="art-bias"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={bias}
                    onChange={(e) => setBias(e.target.value)}
                    placeholder="Décrire toutes les mesures prises pour faire face aux biais potentiels..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-size" className={styles.strobeLabel}>Taille de l'étude</label>
                    <span className={styles.strobeBadge}>STROBE 10</span>
                  </div>
                  <textarea
                    id="art-size"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={studySize}
                    onChange={(e) => setStudySize(e.target.value)}
                    placeholder="Expliquer comment la taille de l'échantillon a été déterminée (formule, logiciel)..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-quantitative" className={styles.strobeLabel}>Variables quantitatives</label>
                    <span className={styles.strobeBadge}>STROBE 11</span>
                  </div>
                  <textarea
                    id="art-quantitative"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={quantitativeVariables}
                    onChange={(e) => setQuantitativeVariables(e.target.value)}
                    placeholder="Expliquer comment les variables quantitatives ont été traitées dans les analyses..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-statistical" className={styles.strobeLabel}>Méthodes statistiques</label>
                    <span className={styles.strobeBadge}>STROBE 12</span>
                  </div>
                  <textarea
                    id="art-statistical"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={statisticalMethods}
                    onChange={(e) => setStatisticalMethods(e.target.value)}
                    placeholder="Décrire toutes les méthodes statistiques, y compris celles utilisées pour contrôler les facteurs de confusion..."
                  />
                </div>
              </>
            )}

            {/* 4. Résultats */}
            {activeTab === 'results' && (
              <>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-flow" className={styles.strobeLabel}>Flux des participants</label>
                    <span className={styles.strobeBadge}>STROBE 13</span>
                  </div>
                  <textarea
                    id="art-flow"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={participantsFlow}
                    onChange={(e) => setParticipantsFlow(e.target.value)}
                    placeholder="Donner le nombre de participants à chaque étape (éligibles, inclus, suivis, analysés)..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-descriptive" className={styles.strobeLabel}>Données descriptives</label>
                    <span className={styles.strobeBadge}>STROBE 14</span>
                  </div>
                  <textarea
                    id="art-descriptive"
                    className={styles.strobeTextarea}
                    rows={4}
                    value={descriptiveData}
                    onChange={(e) => setDescriptiveData(e.target.value)}
                    placeholder="Donner les caractéristiques des participants (démographiques, cliniques, sociales) et les expositions..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-outcomes" className={styles.strobeLabel}>Données sur les résultats</label>
                    <span className={styles.strobeBadge}>STROBE 15</span>
                  </div>
                  <textarea
                    id="art-outcomes"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={outcomeData}
                    onChange={(e) => setOutcomeData(e.target.value)}
                    placeholder="Nombre d'événements d'intérêt ou mesures de résumé au fil du temps..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-mainresults" className={styles.strobeLabel}>Résultats principaux</label>
                    <span className={styles.strobeBadge}>STROBE 16</span>
                  </div>
                  <textarea
                    id="art-mainresults"
                    className={styles.strobeTextarea}
                    rows={4}
                    value={mainResults}
                    onChange={(e) => setMainResults(e.target.value)}
                    placeholder="Donner les estimations non ajustées et, le cas échéant, ajustées, avec les intervalles de confiance à 95%..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-otheranalyses" className={styles.strobeLabel}>Analyses secondaires</label>
                    <span className={styles.strobeBadge}>STROBE 17</span>
                  </div>
                  <textarea
                    id="art-otheranalyses"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={otherAnalyses}
                    onChange={(e) => setOtherAnalyses(e.target.value)}
                    placeholder="Indiquer les autres analyses effectuées (sous-groupes, interactions, analyses de sensibilité)..."
                  />
                </div>
              </>
            )}

            {/* 5. Discussion */}
            {activeTab === 'discussion' && (
              <>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-keyresults" className={styles.strobeLabel}>Résultats clés</label>
                    <span className={styles.strobeBadge}>STROBE 18</span>
                  </div>
                  <textarea
                    id="art-keyresults"
                    className={styles.strobeTextarea}
                    rows={4}
                    value={keyResults}
                    onChange={(e) => setKeyResults(e.target.value)}
                    placeholder="Résumer les principaux résultats en lien avec les objectifs de l'étude..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-limitations" className={styles.strobeLabel}>Limites de l'étude</label>
                    <span className={styles.strobeBadge}>STROBE 19</span>
                  </div>
                  <textarea
                    id="art-limitations"
                    className={styles.strobeTextarea}
                    rows={4}
                    value={limitations}
                    onChange={(e) => setLimitations(e.target.value)}
                    placeholder="Discuter des limites de l'étude, en tenant compte des sources de biais potentiels ou d'imprécision..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-interpretation" className={styles.strobeLabel}>Interprétation des résultats</label>
                    <span className={styles.strobeBadge}>STROBE 20</span>
                  </div>
                  <textarea
                    id="art-interpretation"
                    className={styles.strobeTextarea}
                    rows={4}
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                    placeholder="Donner une interprétation globale et prudente des résultats en s'appuyant sur d'autres études..."
                  />
                </div>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-generalisability" className={styles.strobeLabel}>Généralisabilité</label>
                    <span className={styles.strobeBadge}>STROBE 21</span>
                  </div>
                  <textarea
                    id="art-generalisability"
                    className={styles.strobeTextarea}
                    rows={3}
                    value={generalisability}
                    onChange={(e) => setGeneralisability(e.target.value)}
                    placeholder="Discuter de la possibilité de généraliser les résultats de l'étude (validité externe)..."
                  />
                </div>
              </>
            )}

            {/* 6. Financement */}
            {activeTab === 'funding' && (
              <>
                <div className={styles.strobeFormGroup}>
                  <div className={styles.strobeLabelHeader}>
                    <label htmlFor="art-funding" className={styles.strobeLabel}>Sources de financement</label>
                    <span className={styles.strobeBadge}>STROBE 22</span>
                  </div>
                  <textarea
                    id="art-funding"
                    className={styles.strobeTextarea}
                    rows={4}
                    value={funding}
                    onChange={(e) => setFunding(e.target.value)}
                    placeholder="Indiquer les sources de financement et le rôle des financeurs pour la recherche présente..."
                  />
                </div>
              </>
            )}
          </div>

          {/* Navigation & Action buttons */}
          <div className={styles.navButtons}>
            <div>
              {activeTab !== 'info' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (activeTab === 'intro') setActiveTab('info');
                    else if (activeTab === 'methodo') setActiveTab('intro');
                    else if (activeTab === 'results') setActiveTab('methodo');
                    else if (activeTab === 'discussion') setActiveTab('results');
                    else if (activeTab === 'funding') setActiveTab('discussion');
                  }}
                >
                  Précédent
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {activeTab !== 'funding' ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (activeTab === 'info') setActiveTab('intro');
                    else if (activeTab === 'intro') setActiveTab('methodo');
                    else if (activeTab === 'methodo') setActiveTab('results');
                    else if (activeTab === 'results') setActiveTab('discussion');
                    else if (activeTab === 'discussion') setActiveTab('funding');
                  }}
                >
                  Suivant
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)', border: 'none' }}
                  onClick={handleGenerateArticle}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <div className={styles.spinner}></div>
                      <span style={{ marginLeft: '0.5rem' }}>Génération IA...</span>
                    </>
                  ) : (
                    "Générer l'article par l'IA ✨"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PREVIEW CARD (RIGHT) */}
        <div className={`${styles.previewCard} glass-card`}>
          {generatedArticle ? (
            <>
              <div className={styles.previewHeader}>
                <span className={styles.previewTitle}>Article Rédigé STROBE</span>
                <div className={styles.previewActions}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }} onClick={handleDownloadMarkdown}>
                    Télécharger (MD)
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }} onClick={handleDownloadPdf}>
                    Télécharger (PDF)
                  </button>
                </div>
              </div>
              <div className={styles.previewBody}>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedArticle) }} />
              </div>
            </>
          ) : (
            <div className={styles.emptyPreview}>
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Aucun article généré</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Remplissez les formulaires de gauche, puis cliquez sur <b>Générer l'article par l'IA</b> dans le dernier onglet pour obtenir la trame de publication rédigée aux normes de la checklist STROBE.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HISTORY SECTION */}
      {articles.length > 0 && (
        <section className={styles.historySection}>
          <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            Articles enregistrés
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Sélectionnez un article sauvegardé pour le lire, le régénérer ou le supprimer.
          </p>
          <div className={styles.historyList}>
            {articles.map((art) => (
              <div
                key={art.id}
                className={`${styles.historyItem} glass-card`}
                onClick={() => handleSelectArticle(art)}
                style={{ position: 'relative', cursor: 'pointer', padding: '1.25rem' }}
              >
                <div className={styles.historyMeta} style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.82rem' }}>
                    {art.studyType === 'cohort' ? 'Étude de cohorte' : (art.studyType === 'case-control' ? 'Étude cas-témoins' : 'Étude transversale')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Enregistré le {new Date(art.date).toLocaleDateString('fr-FR')} à {new Date(art.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4 className={styles.historyTitle} style={{ marginBottom: '12px' }}>
                  {art.title.length > 60 ? art.title.substring(0, 60) + '...' : (art.title || 'Article STROBE sans titre')}
                </h4>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSelectArticle(art)}
                    style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Ouvrir cet article dans le lecteur"
                  >
                    👁️ Ouvrir
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => handleRegenerateArticle(e, art)}
                    style={{ padding: '4px 10px', fontSize: '0.78rem', background: 'rgba(13, 148, 136, 0.15)', color: '#2dd4bf', border: '1px solid rgba(13, 148, 136, 0.4)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Régénérer cet article avec l'IA"
                  >
                    🔄 Régénérer
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => handleDeleteArticleClick(e, art.id)}
                    style={{ padding: '4px 10px', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
                    title="Supprimer cet article"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <QuotaModal
        isOpen={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        featureName="Articles Scientifiques STROBE"
        currentTier={getUserTier(profile)}
        maxLimit={getQuotaConfig(getUserTier(profile)).articlesMax}
        onUpgradeClick={() => setShowSubscriptionModal(true)}
      />

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </div>
  );
}
