'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MobileOverlay from '@/components/MobileOverlay';
import { PubMedArticle } from '@/utils/pubmed';
import { useAuth } from '@/context/AuthContext';
import { getUserTier, getQuotaConfig } from '@/utils/quota';
import { QuotaModal } from '@/components/QuotaModal';
import SubscriptionModal from '@/components/SubscriptionModal';
import styles from './page.module.css';
import { 
  saveFirestoreSynthesis, 
  loadFirestoreSyntheses, 
  deleteFirestoreSynthesis, 
  FirestoreSynthesis 
} from '@/utils/firestore';
import { getProgress, updateProgress, getSavedSynthesesFromLocal, saveSynthesesToLocal } from '@/utils/storage';

const getBiblioCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const countStr = localStorage.getItem('recif_biblio_count') || localStorage.getItem('recif_biblio_syntheses_count') || '0';
  const val = parseInt(countStr, 10);
  return isNaN(val) ? 0 : val;
};

const incrementBiblioCount = () => {
  if (typeof window === 'undefined') return;
  const current = getBiblioCount();
  const next = current + 1;
  localStorage.setItem('recif_biblio_count', next.toString());
  localStorage.setItem('recif_biblio_syntheses_count', next.toString());
};

export default function BiblioPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Filtres de recherche
  const [query, setQuery] = useState('');
  const [publicationType, setPublicationType] = useState('all');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [retmax, setRetmax] = useState(10);
  const [sort, setSort] = useState<'relevance' | 'pub_date'>('relevance');

  // États des données
  const [articles, setArticles] = useState<PubMedArticle[]>([]);
  const [selectedPmids, setSelectedPmids] = useState<string[]>([]);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});

  // États d'exécution et de résultat
  const [isSearching, setIsSearching] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null);
  const [synthesisProvider, setSynthesisProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Synthèses sauvegardées
  const [savedSyntheses, setSavedSyntheses] = useState<FirestoreSynthesis[]>([]);
  const [activeSynthesisId, setActiveSynthesisId] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Charger les synthèses depuis localStorage immédiatement, puis fusionner avec Firestore
  useEffect(() => {
    const fetchSyntheses = async () => {
      const localSynths = (getSavedSynthesesFromLocal() as FirestoreSynthesis[]) || [];
      setSavedSyntheses(localSynths);

      if (user) {
        try {
          const firestoreSynths = await loadFirestoreSyntheses(user.uid);
          if (firestoreSynths && firestoreSynths.length > 0) {
            const map = new Map<string, FirestoreSynthesis>();
            firestoreSynths.forEach(s => map.set(s.id, s));
            localSynths.forEach(s => { if (!map.has(s.id)) map.set(s.id, s); });
            const merged = Array.from(map.values());
            setSavedSyntheses(merged);
            saveSynthesesToLocal(merged);
          }
        } catch (err) {
          console.error("Erreur lors de la récupération des synthèses Firestore:", err);
        }
      }
    };
    fetchSyntheses();
  }, [user]);

  const handleManualSaveSynthesis = () => {
    if (!synthesisResult) return;
    const selectedArticles = articles.filter(a => selectedPmids.includes(a.pmid));
    const synthesisId = activeSynthesisId || `synth_${Date.now()}`;
    const newSynthItem: FirestoreSynthesis = {
      id: synthesisId,
      query: query.trim() || naturalLanguageQuestion.trim() || 'Revue de la littérature',
      title: `Revue PubMed : ${query.trim() || naturalLanguageQuestion.trim() || 'Recherche'} (${selectedArticles.length} articles)`,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      articlesCount: selectedArticles.length,
      content: synthesisResult,
      articles: selectedArticles,
      provider: synthesisProvider || 'IA'
    };

    setActiveSynthesisId(newSynthItem.id);
    const filtered = savedSyntheses.filter(s => s.id !== newSynthItem.id);
    const updatedList = [newSynthItem, ...filtered];

    setSavedSyntheses(updatedList);
    saveSynthesesToLocal(updatedList);

    if (user) {
      saveFirestoreSynthesis(user.uid, newSynthItem).catch(e => console.error("Erreur sauvegarde Firestore synthèse:", e));
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleOpenSynthesis = (s: FirestoreSynthesis) => {
    setActiveSynthesisId(s.id);
    setSynthesisResult(s.content);
    setSynthesisProvider(s.provider || null);
    if (s.articles && s.articles.length > 0) {
      setArticles(s.articles);
      setSelectedPmids(s.articles.map(a => a.pmid));
    }
    if (s.query) setQuery(s.query);
    setTimeout(() => {
      const el = document.getElementById('synthesis-result-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleRegenerateSynthesis = (s: FirestoreSynthesis) => {
    setActiveSynthesisId(s.id);
    if (s.articles && s.articles.length > 0) {
      setArticles(s.articles);
      setSelectedPmids(s.articles.map(a => a.pmid));
    }
    if (s.query) setQuery(s.query);
    setTimeout(() => {
      handleSynthesize();
    }, 200);
  };

  const handleDeleteSynthesis = async (e: React.MouseEvent, sId: string) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer définitivement cette revue de la littérature ?")) return;

    setSavedSyntheses(prev => {
      const next = prev.filter(s => s.id !== sId);
      saveSynthesesToLocal(next);
      return next;
    });
    if (activeSynthesisId === sId) {
      setActiveSynthesisId(null);
      setSynthesisResult(null);
    }

    if (user) {
      deleteFirestoreSynthesis(user.uid, sId).catch(e => console.error(e));
    }
  };

  const handleNewSynthesis = () => {
    setActiveSynthesisId(null);
    setSynthesisResult(null);
    setQuery('');
    setArticles([]);
    setSelectedPmids([]);
  };

  // Assistant de requêtes MeSH par IA
  const [naturalLanguageQuestion, setNaturalLanguageQuestion] = useState('');
  const [isGeneratingMesh, setIsGeneratingMesh] = useState(false);
  const [showMeshHelper, setShowMeshHelper] = useState(false);

  // Générer la requête MeSH PubMed via l'IA (Qwen / Gemini)
  const handleGenerateMesh = async () => {
    if (!naturalLanguageQuestion.trim()) return;

    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);
    if (getBiblioCount() >= quotaConfig.biblioMax) {
      setError(`Quota atteint pour la Formule ${userTier === 'découverte' ? 'Découverte (1/1 recherche/synthèse effectuée)' : 'PRO'}. Passez en Formule PRO ou ULTRA pour débloquer les recherches PubMed illimitées.`);
      setShowQuotaModal(true);
      return;
    }

    setIsGeneratingMesh(true);
    setError(null);

    try {
      let token = '';
      if (user) {
        token = await user.getIdToken();
      }

      const aiProvider = localStorage.getItem('recif_ai_provider') || 'openrouter';
      const ollamaModel = localStorage.getItem('recif_ollama_model') || '';

      const res = await fetch('/api/pubmed/mesh-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': aiProvider,
          'x-ollama-model': ollamaModel,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: naturalLanguageQuestion.trim(),
          modelProvider: aiProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec de la génération de la requête MeSH');
      }

      if (data.query) {
        setQuery(data.query);
        setShowMeshHelper(false);
      }
    } catch (err: any) {
      console.error('Erreur génération MeSH:', err);
      setError(err.message || 'Erreur lors de la génération de la requête MeSH.');
    } finally {
      setIsGeneratingMesh(false);
    }
  };

  // Recherche PubMed
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);
    if (getBiblioCount() >= quotaConfig.biblioMax) {
      setError(`Quota atteint pour la Formule ${userTier === 'découverte' ? 'Découverte (1/1 recherche/synthèse effectuée)' : 'PRO'}. Passez en Formule PRO ou ULTRA pour débloquer les recherches PubMed illimitées.`);
      setShowQuotaModal(true);
      return;
    }

    setIsSearching(true);
    setError(null);
    setArticles([]);
    setSelectedPmids([]);

    try {
      let token = '';
      if (user) {
        token = await user.getIdToken();
      }

      const res = await fetch('/api/pubmed/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: query.trim(),
          retmax,
          yearStart: yearStart ? parseInt(yearStart, 10) : undefined,
          yearEnd: yearEnd ? parseInt(yearEnd, 10) : undefined,
          publicationType,
          sort,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec de la recherche PubMed');
      }

      setArticles(data.articles || []);
      // Sélectionner tous les articles par défaut
      if (data.articles && data.articles.length > 0) {
        setSelectedPmids(data.articles.map((a: PubMedArticle) => a.pmid));
      }
    } catch (err: any) {
      console.error('Erreur recherche PubMed:', err);
      setError(err.message || 'Impossible d\'effectuer la recherche PubMed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Basculer la sélection d'un article
  const toggleSelectArticle = (pmid: string) => {
    setSelectedPmids(prev =>
      prev.includes(pmid) ? prev.filter(id => id !== pmid) : [...prev, pmid]
    );
  };

  // Tout sélectionner / Tout désélectionner
  const toggleSelectAll = () => {
    if (selectedPmids.length === articles.length) {
      setSelectedPmids([]);
    } else {
      setSelectedPmids(articles.map(a => a.pmid));
    }
  };

  // Supprimer localement un article considéré non pertinent
  const handleDeleteArticle = (pmid: string) => {
    setArticles(prev => prev.filter(a => a.pmid !== pmid));
    setSelectedPmids(prev => prev.filter(id => id !== pmid));
  };

  // Basculer l'affichage du résumé
  const toggleAbstract = (pmid: string) => {
    setExpandedAbstracts(prev => ({ ...prev, [pmid]: !prev[pmid] }));
  };

  // Lancer la synthèse par IA (Qwen / Gemini)
  const handleSynthesize = async () => {
    const selectedArticles = articles.filter(a => selectedPmids.includes(a.pmid));
    if (selectedArticles.length === 0) return;

    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);

    if (getBiblioCount() >= quotaConfig.biblioMax) {
      setError(`Quota atteint pour la Formule ${userTier === 'découverte' ? 'Découverte (1/1 recherche/synthèse effectuée)' : 'PRO'}. Passez en Formule PRO ou ULTRA pour débloquer les recherches PubMed illimitées.`);
      setShowQuotaModal(true);
      return;
    }

    setIsSynthesizing(true);
    setError(null);
    setSynthesisResult(null);

    try {
      let token = '';
      if (user) {
        token = await user.getIdToken();
      }

      const aiProvider = localStorage.getItem('recif_ai_provider') || 'openrouter';
      const ollamaModel = localStorage.getItem('recif_ollama_model') || '';

      const res = await fetch('/api/pubmed/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': aiProvider,
          'x-ollama-model': ollamaModel,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          articles: selectedArticles,
          query,
          modelProvider: aiProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec de la génération de la synthèse');
      }

      setSynthesisResult(data.synthesis);
      setSynthesisProvider(data.provider);
      incrementBiblioCount();

      // Enregistrement automatique de la synthèse
      const synthesisId = activeSynthesisId || `synth_${Date.now()}`;
      const newSynthItem: FirestoreSynthesis = {
        id: synthesisId,
        query: query.trim() || naturalLanguageQuestion.trim() || 'Revue de la littérature',
        title: `Revue PubMed : ${query.trim() || naturalLanguageQuestion.trim() || 'Recherche'} (${selectedArticles.length} articles)`,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
        articlesCount: selectedArticles.length,
        content: data.synthesis,
        articles: selectedArticles,
        provider: data.provider || 'IA'
      };

      setActiveSynthesisId(newSynthItem.id);
      setSavedSyntheses(prev => {
        const filtered = prev.filter(s => s.id !== newSynthItem.id);
        return [newSynthItem, ...filtered];
      });

      updateProgress((stats) => {
        const currentList = (stats.recentSyntheses || []) as FirestoreSynthesis[];
        const filtered = currentList.filter(s => s.id !== newSynthItem.id);
        return {
          ...stats,
          recentSyntheses: [newSynthItem, ...filtered].slice(0, 15)
        };
      });

      if (user) {
        saveFirestoreSynthesis(user.uid, newSynthItem).catch(e => console.error("Erreur sauvegarde Firestore synthèse:", e));
      }
    } catch (err: any) {
      console.error('Erreur synthèse IA:', err);
      setError(err.message || 'Erreur lors de la génération de la synthèse.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Copier dans le presse-papier
  const handleCopy = () => {
    if (!synthesisResult) return;
    navigator.clipboard.writeText(synthesisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Télécharger le fichier texte/markdown
  const handleDownload = () => {
    if (!synthesisResult) return;
    const blob = new Blob([synthesisResult], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revue_bibliographique_pubmed_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Transférer au générateur de protocole
  const handleTransferToProtocol = () => {
    if (!synthesisResult) return;
    localStorage.setItem('recif_biblio_synthesis', synthesisResult);
    router.push('/protocole');
  };

  // Transférer au rédacteur d'article STROBE (Critère 3)
  const handleTransferToStrobeArticle = () => {
    if (!synthesisResult) return;
    localStorage.setItem('recif_strobe_biblio_synthesis', synthesisResult);
    router.push('/article');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0b132b' }}>
      <Sidebar />
      <MobileOverlay />

      <main className={styles.mainContent} style={{ flex: 1 }}>
        {/* En-tête */}
        <header className={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className={styles.title}>Recherche Bibliographique & Revue PubMed</h1>
              <p className={styles.subtitle}>
                Explorez les publications scientifiques sur <strong>PubMed</strong> en temps réel et générez une revue de la littérature structurée assistée par IA (<strong>Qwen / Gemini</strong>).
              </p>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              borderRadius: '20px',
              background: getBiblioCount() >= getQuotaConfig(getUserTier(profile)).biblioMax ? 'rgba(239, 68, 68, 0.15)' : 'rgba(13, 148, 136, 0.15)',
              border: `1px solid ${getBiblioCount() >= getQuotaConfig(getUserTier(profile)).biblioMax ? 'rgba(239, 68, 68, 0.4)' : 'rgba(13, 148, 136, 0.3)'}`,
              color: getBiblioCount() >= getQuotaConfig(getUserTier(profile)).biblioMax ? '#fca5a5' : '#2dd4bf',
              fontSize: '0.85rem',
              fontWeight: 600
            }}>
              <span>📊 Formule {getUserTier(profile) === 'découverte' ? 'Découverte (3j)' : getUserTier(profile).toUpperCase()} : {getBiblioCount()} / {getQuotaConfig(getUserTier(profile)).biblioMax === Infinity ? 'Illimité' : getQuotaConfig(getUserTier(profile)).biblioMax} recherche</span>
              {getBiblioCount() >= getQuotaConfig(getUserTier(profile)).biblioMax && (
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  🚀 Surclasser
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Historique des synthèses et revues sauvegardées */}
        {savedSyntheses.length > 0 && (
          <section className={styles.card} style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📚</span> Mes Revues &amp; Synthèses sauvegardées ({savedSyntheses.length})
              </h3>
              <button
                type="button"
                onClick={handleNewSynthesis}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ➕ Nouvelle Recherche / Revue
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {savedSyntheses.map((s) => {
                const isActive = activeSynthesisId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleOpenSynthesis(s)}
                    style={{
                      background: isActive ? 'rgba(13, 148, 136, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isActive ? '1px solid #0d9488' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#f1f5f9', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {s.title}
                        </h4>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSynthesis(e, s.id)}
                          title="Supprimer cette revue"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            fontSize: '0.9rem'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '10px' }}>
                        📅 {s.date} • 📄 {s.articlesCount || 0} article(s) PubMed
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSynthesis(s);
                        }}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(13, 148, 136, 0.4)',
                          background: 'rgba(13, 148, 136, 0.2)',
                          color: '#2dd4bf',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        📖 Ouvrir
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerateSynthesis(s);
                        }}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Regénérer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Formulaire de recherche */}
        <section className={styles.card} style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchBarRow}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Ex : Type 2 diabetes SGLT2 inhibitors clinical trial, PICO, ou mots-clés MeSH..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button
                type="submit"
                className={styles.searchBtn}
                disabled={isSearching || !query.trim()}
              >
                {isSearching ? (
                  <>
                    <span className={styles.loadingSpinner} />
                    Recherche...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Chercher sur PubMed
                  </>
                )}
              </button>
            </div>

            {/* Assistant MeSH par IA */}
            <div className={styles.meshHelperRow}>
              <button
                type="button"
                className={styles.meshHelperToggleBtn}
                onClick={() => setShowMeshHelper(!showMeshHelper)}
              >
                💡 {showMeshHelper ? "Masquer l'assistant de requête MeSH par IA" : "Besoin d'aide ? Générer une requête MeSH PubMed avec l'IA"}
              </button>
            </div>

            {showMeshHelper && (
              <div className={styles.meshHelperBox}>
                <p className={styles.meshHelperDesc}>
                  Saisissez votre question ou sujet de recherche en langage naturel. L'IA traduira vos concepts médicaux en anglais et structurera une commande PubMed professionnelle avec les descripteurs <strong>MeSH</strong> officiels.
                </p>
                <div className={styles.meshHelperInputArea}>
                  <textarea
                    className={styles.meshHelperInput}
                    placeholder="Ex : Rédige avec les MeSH de Pubmed une commande de recherche sur l'intoxication mercurielle chronique des orpailleurs et mineurs d'or depuis 2000 à 2026..."
                    value={naturalLanguageQuestion}
                    onChange={e => setNaturalLanguageQuestion(e.target.value)}
                    rows={3}
                  />
                  <button
                    type="button"
                    className={styles.meshHelperSubmitBtn}
                    onClick={handleGenerateMesh}
                    disabled={isGeneratingMesh || !naturalLanguageQuestion.trim()}
                  >
                    {isGeneratingMesh ? (
                      <>
                        <span className={styles.loadingSpinner} />
                        Génération...
                      </>
                    ) : (
                      "Générer la requête"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Filtres de recherche */}
            <div className={styles.filtersGrid}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Type d'étude</label>
                <select
                  className={styles.filterSelect}
                  value={publicationType}
                  onChange={e => setPublicationType(e.target.value)}
                >
                  <option value="all">Tous les types</option>
                  <option value="clinical_trial">Essais Cliniques (RCT)</option>
                  <option value="meta_analysis">Méta-Analyses</option>
                  <option value="systematic_review">Revues Systématiques</option>
                  <option value="review">Revues Générales</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Année Début</label>
                <input
                  type="number"
                  className={styles.filterInput}
                  placeholder="Ex : 2018"
                  value={yearStart}
                  onChange={e => setYearStart(e.target.value)}
                />
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Année Fin</label>
                <input
                  type="number"
                  className={styles.filterInput}
                  placeholder="Ex : 2026"
                  value={yearEnd}
                  onChange={e => setYearEnd(e.target.value)}
                />
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Nombre de résultats</label>
                <select
                  className={styles.filterSelect}
                  value={retmax}
                  onChange={e => setRetmax(parseInt(e.target.value, 10))}
                >
                  <option value={5}>5 articles</option>
                  <option value={10}>10 articles</option>
                  <option value={20}>20 articles</option>
                  <option value={30}>30 articles</option>
                  <option value={50}>50 articles</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Trier par</label>
                <select
                  className={styles.filterSelect}
                  value={sort}
                  onChange={e => setSort(e.target.value as any)}
                >
                  <option value="relevance">Pertinence</option>
                  <option value="pub_date">Date de publication</option>
                </select>
              </div>
            </div>
          </form>
        </section>

        {/* Message d'erreur / Alerte de Quota */}
        {error && (
          <div style={{
            padding: '1.25rem',
            marginBottom: '1.5rem',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            alignItems: 'flex-start'
          }}>
            <div style={{ fontSize: '0.98rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ {error}
            </div>
            {error.includes('Quota') && (
              <button
                type="button"
                onClick={() => setShowSubscriptionModal(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0d9488, #0284c7)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)'
                }}
              >
                🚀 Découvrir les Formules PRO & ULTRA (Accès Illimité)
              </button>
            )}
          </div>
        )}

        {/* Grille principale : Articles et Synthèse IA */}
        <div className={`${styles.layout} ${synthesisResult ? styles.layoutWithResults : ''}`}>
          {/* Colonne Gauche : Liste des articles PubMed */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Articles PubMed ({articles.length})
            </h2>

            {articles.length === 0 ? (
              <div className={styles.emptyState}>
                <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>
                  Saisissez une question de recherche ou des mots-clés ci-dessus pour rechercher sur PubMed.
                </p>
              </div>
            ) : (
              <>
                {/* Barre d'action sélection */}
                <div className={styles.actionBar}>
                  <div className={styles.selectionInfo}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedPmids.length === articles.length && articles.length > 0}
                      onChange={toggleSelectAll}
                    />
                    <span>
                      {selectedPmids.length} / {articles.length} sélectionnés
                    </span>
                  </div>

                  <button
                    className={styles.synthesizeBtn}
                    onClick={handleSynthesize}
                    disabled={isSynthesizing || selectedPmids.length === 0}
                  >
                    {isSynthesizing ? (
                      <>
                        <span className={styles.loadingSpinner} />
                        Synthèse en cours...
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        Générer la Revue IA
                      </>
                    )}
                  </button>
                </div>

                {/* Liste des cartes d'articles */}
                <div className={styles.articlesList}>
                  {articles.map((art) => {
                    const isSelected = selectedPmids.includes(art.pmid);
                    const isExpanded = expandedAbstracts[art.pmid] ?? false;

                    return (
                      <div
                        key={art.pmid}
                        className={`${styles.articleCard} ${isSelected ? styles.articleCardSelected : ''}`}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={isSelected}
                          onChange={() => toggleSelectArticle(art.pmid)}
                        />

                        <div className={styles.articleContent}>
                          <div className={styles.articleHeader}>
                            <h3 className={styles.articleTitle}>{art.title}</h3>
                            <button
                              type="button"
                              className={styles.deleteArticleBtn}
                              onClick={() => handleDeleteArticle(art.pmid)}
                              title="Exclure cet article"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              Exclure
                            </button>
                          </div>

                          <div className={styles.pubMeta}>
                            <span className={styles.journalTag}>{art.journal}</span>
                            <span>• {art.year}</span>
                            {art.evidenceLevel && (
                              <span className={styles.pubTypeBadge} style={{ background: 'rgba(13, 148, 136, 0.25)', color: '#2dd4bf', borderColor: 'rgba(13, 148, 136, 0.4)' }}>
                                ⚡ {art.evidenceLevel}
                              </span>
                            )}
                            {art.hasFullText && (
                              <span className={styles.pubTypeBadge} style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                                🟢 Texte Intégral {art.pmcid ? `(${art.pmcid})` : ''}
                              </span>
                            )}
                            {art.pubTypes.map((pt, i) => (
                              <span key={i} className={styles.pubTypeBadge}>
                                {pt}
                              </span>
                            ))}
                          </div>

                          <div className={styles.authorsList}>
                            {art.authors.slice(0, 5).join(', ')}
                            {art.authors.length > 5 ? ' et al.' : ''}
                          </div>

                          {/* Action afficher/masquer abstract */}
                          <button
                            className={styles.toggleAbstractBtn}
                            onClick={() => toggleAbstract(art.pmid)}
                          >
                            {isExpanded ? '▲ Masquer le résumé' : '▼ Voir le résumé (Abstract)'}
                          </button>

                          {isExpanded && (
                            <div className={styles.abstractBox}>
                              {art.abstract}
                            </div>
                          )}

                          <div className={styles.articleFooter}>
                            <a
                              href={art.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.linkBtn}
                            >
                              PMID: {art.pmid} ↗
                            </a>

                            {art.fullTextUrl && (
                              <a
                                href={art.fullTextUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.linkBtn}
                                style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399', fontWeight: 600 }}
                              >
                                📖 Texte Intégral {art.pmcid ? '(PMC)' : '(DOI)'} ↗
                              </a>
                            )}

                            {art.doi && (!art.fullTextUrl || !art.fullTextUrl.includes('doi.org')) && (
                              <a
                                href={`https://doi.org/${art.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.linkBtn}
                              >
                                DOI ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Colonne Droite : Revue de la littérature IA */}
          {(isSynthesizing || synthesisResult) && (
            <section id="synthesis-result-section" className={styles.card}>
              <h2 className={styles.cardTitle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Revue Bibliographique Générée
              </h2>

              {isSynthesizing ? (
                <div className={styles.pulseBox}>
                  🤖 Analyse de {selectedPmids.length} résumés PubMed en cours par Qwen / l'IA...
                  <br />
                  <span style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.5rem', display: 'inline-block' }}>
                    Extraction des résultats, tableau comparatif et rédaction du rationnel scientifique...
                  </span>
                </div>
              ) : (
                <div className={styles.synthesisContainer}>
                  {/* En-tête des actions */}
                  <div className={styles.synthesisHeader}>
                    <span className={styles.providerBadge}>
                      Moteur : {synthesisProvider || 'IA RECIF'}
                    </span>

                    <div className={styles.actionsGroup}>
                      <button 
                        className={styles.actionBtn} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '46px', background: '#059669', borderColor: '#10b981', color: '#ffffff', padding: '0.65rem 1rem', borderRadius: '10px', cursor: 'pointer' }}
                        onClick={handleManualSaveSynthesis}
                      >
                        <span style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, display: 'inline-block' }}>
                          {savedSuccess ? '✓ Sauvegardé !' : '💾 Sauvegarder la revue'}
                        </span>
                      </button>
                      <button 
                        className={styles.actionBtn} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '46px', background: '#0d9488', borderColor: '#2dd4bf', color: '#ffffff', padding: '0.65rem 1rem', borderRadius: '10px', cursor: 'pointer' }}
                        onClick={() => {
                          const el = document.getElementById('saved-syntheses-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        <span style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, display: 'inline-block' }}>
                          📚 Mes Revues Sauvegardées ({savedSyntheses.length})
                        </span>
                      </button>
                      <button 
                        className={styles.actionBtn} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '46px', background: '#334155', borderColor: '#475569', color: '#ffffff', padding: '0.65rem 1rem', borderRadius: '10px', cursor: 'pointer' }}
                        onClick={handleCopy}
                      >
                        <span style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, display: 'inline-block' }}>
                          {copied ? '✓ Copié !' : '📋 Copier le texte'}
                        </span>
                      </button>
                      <button 
                        className={styles.actionBtn} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '46px', background: '#334155', borderColor: '#475569', color: '#ffffff', padding: '0.65rem 1rem', borderRadius: '10px', cursor: 'pointer' }}
                        onClick={handleDownload}
                      >
                        <span style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, display: 'inline-block' }}>
                          📥 Télécharger (.md)
                        </span>
                      </button>
                      <button
                        className={styles.actionBtn}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '46px', background: '#0284c7', borderColor: '#38bdf8', color: '#ffffff', padding: '0.65rem 1rem', borderRadius: '10px', cursor: 'pointer' }}
                        onClick={handleTransferToProtocol}
                      >
                        <span style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, display: 'inline-block' }}>
                          ⚡ Utiliser dans mon Protocole
                        </span>
                      </button>
                      <button
                        className={styles.actionBtn}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '46px', background: '#9333ea', borderColor: '#c084fc', color: '#ffffff', padding: '0.65rem 1rem', borderRadius: '10px', cursor: 'pointer' }}
                        onClick={handleTransferToStrobeArticle}
                      >
                        <span style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, display: 'inline-block' }}>
                          📝 Utiliser dans Article STROBE (Critère 3)
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Corps de la synthèse rendu */}
                  <div className={styles.synthesisBody}>
                    {renderMarkdown(synthesisResult || '')}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <QuotaModal
        isOpen={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        featureName="Synthèses Bibliographiques PubMed"
        currentTier={getUserTier(profile)}
        maxLimit={getQuotaConfig(getUserTier(profile)).biblioMax}
        onUpgradeClick={() => setShowSubscriptionModal(true)}
      />

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </div>
  );
}

/**
 * Fonction simple et robuste pour rendre le Markdown sans dépendance lourde externe
 */
function renderMarkdown(mdText: string) {
  if (!mdText) return null;

  const lines = mdText.split('\n');
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  const flushTable = (key: string) => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={key} style={{ overflowX: 'auto', margin: '1rem 0' }}>
          <table>
            {tableHeader.length > 0 && (
              <thead>
                <tr>
                  {tableHeader.map((h, i) => (
                    <th key={i}>{h.trim()}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Gestion des tableaux Markdown
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('---')) {
        // Ligne de séparation de tableau, ignorer
        return;
      }

      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map(c => c.trim());

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable(`table-${idx}`);
    }

    // Titres H2 / H3
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={idx}>{trimmed.replace('## ', '')}</h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={idx}>{trimmed.replace('### ', '')}</h3>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={idx} style={{ marginLeft: '1rem' }}>
          {formatInlineFormatting(trimmed.substring(2))}
        </li>
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={idx} style={{ marginBottom: '0.75rem' }}>
          {formatInlineFormatting(trimmed)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable('table-final');
  }

  return elements;
}

function formatInlineFormatting(text: string): React.ReactNode {
  // Format des puces en gras **texte**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
