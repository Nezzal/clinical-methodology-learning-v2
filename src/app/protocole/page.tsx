'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProgress, updateProgress, LocalStats } from '@/utils/storage';
import { useAuth } from '@/context/AuthContext';
import { saveFirestoreProtocol, loadFirestoreProtocols, syncUserProfile, loadFirestoreChats, deleteFirestoreProtocol } from '@/utils/firestore';
import { APP_VERSION_LABEL } from '@/utils/constants';
import { getUserProfileHeaderInfo } from '@/utils/pdf-utils';
import { getUserTier, getQuotaConfig } from '@/utils/quota';
import { QuotaModal } from '@/components/QuotaModal';
import SubscriptionModal from '@/components/SubscriptionModal';
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
  const { user, profile } = useAuth();
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
  const [annexes, setAnnexes] = useState('');

  // Nouveaux états méthodologiques
  const [samplingStrategy, setSamplingStrategy] = useState('');
  const [dataCollection, setDataCollection] = useState('');
  const [dataAnalysis, setDataAnalysis] = useState('');

  // App State
  const [generatedProtocol, setGeneratedProtocol] = useState<string | null>(null);
  const [generatedCrf, setGeneratedCrf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCrf, setLoadingCrf] = useState(false);
  const [previewMode, setPreviewMode] = useState<'protocol' | 'crf'>('protocol');
  const [activeProtocolId, setActiveProtocolId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [hasLoadedFromUrl, setHasLoadedFromUrl] = useState(false);

  // States for importing parameters from tutor chats
  const [tutorChats, setTutorChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    const fetchTutorChats = async () => {
      if (user) {
        try {
          const chats = await loadFirestoreChats(user.uid);
          const activeChats = chats.filter(c => c.messages && c.messages.length > 1);
          setTutorChats(activeChats);
        } catch (err) {
          console.error("Erreur lors de la récupération des chats du tuteur:", err);
        }
      }
    };
    fetchTutorChats();
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('import') === 'direct') {
        const stored = localStorage.getItem('recif_imported_params');
        if (stored) {
          try {
            const params = JSON.parse(stored);
            fillFormFields(params);
            setExtractionSuccess(true);
            setExtractionError(null);
            
            // Nettoyer la clé localStorage et purifier l'URL sans recharger la page
            localStorage.removeItem('recif_imported_params');
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.error("Échec de la lecture des paramètres importés directement :", e);
            setExtractionError("Erreur lors de la lecture des paramètres importés.");
          }
        }
      }
    }
  }, []);

  const fillFormFields = (p: any) => {
    if (!p) return;
    setTitle(p.title || '');
    setAcronym(p.acronym || '');
    setMethodology((p.methodology as 'interventional' | 'observational') || 'observational');
    setBenefitType((p.benefitType as 'bid' | 'sbid') || 'sbid');
    setQuestion(p.question || '');
    setDesign(p.design || 'Essai Clinique Randomisé Contrôlé (ECR)');
    setIntervention(p.intervention || '');
    setPopulation(p.population || '');
    setInclusion(p.inclusion || '');
    setExclusion(p.exclusion || '');
    setPrimaryEndpoint(p.primaryEndpoint || '');
    setSecondaryEndpoints(p.secondaryEndpoints || '');
    setObjectives(p.objectives || '');
    setBias(p.bias || '');
    setJustification(p.justification || '');
    setHypothesis(p.hypothesis || '');
    setLogistics(p.logistics || '');
    setPersonnel(p.personnel || '');
    setBudget(p.budget || '');
    setCalendar(p.calendar || '');
    setEthics(p.ethics || '');
    setReferences(p.references || '');
    setAnnexes(p.annexes || '');
    setSamplingStrategy(p.samplingStrategy || '');
    setDataCollection(p.dataCollection || '');
    setDataAnalysis(p.dataAnalysis || '');
  };

  const loadProtocolParameters = async (item: any) => {
    if (item.formData) {
      fillFormFields(item.formData);
    } else if (item.content) {
      setExtractionError(null);
      setExtracting(true);
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

        const res = await fetch('/api/extract-protocol-params', {
          method: 'POST',
          headers,
          body: JSON.stringify({ protocolContent: item.content })
        });
        const data = await res.json();
        if (data.params) {
          fillFormFields(data.params);
          
          const updatedItem = { ...item, formData: data.params };
          setHistory(prev => prev.map(h => h.id === item.id ? updatedItem : h));
          
          updateProgress((stats) => {
            const updatedHistory = stats.recentProtocols.map((proto: any) => 
              proto.id === item.id ? updatedItem : proto
            );
            return {
              ...stats,
              recentProtocols: updatedHistory
            };
          });

          if (user) {
            saveFirestoreProtocol(user.uid, updatedItem)
              .catch(e => console.error("Erreur de mise à jour du protocole extrait sur Firestore:", e));
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'extraction des paramètres:", err);
      } finally {
        setExtracting(false);
      }
    }
  };

  const handleImportFromChat = async () => {
    if (!selectedChatId) return;
    
    const selectedChat = tutorChats.find(c => c.id === selectedChatId);
    if (!selectedChat || !selectedChat.messages) {
      setExtractionError("La discussion sélectionnée est introuvable ou vide.");
      return;
    }

    setExtracting(true);
    setExtractionSuccess(false);
    setExtractionError(null);

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

      const response = await fetch('/api/extract-protocol-params', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: selectedChat.messages })
      });

      const data = await response.json();

      if (response.ok && data.params) {
        fillFormFields(data.params);
        setExtractionSuccess(true);
        if (data.notice) {
          setExtractionError(data.notice);
        }
      } else {
        throw new Error(data.error || "Impossible d'extraire les paramètres.");
      }
    } catch (err: any) {
      console.error(err);
      setExtractionError(err.message || "Une erreur s'est produite lors de l'extraction des paramètres.");
    } finally {
      setExtracting(false);
    }
  };

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
          setActiveProtocolId(selectedProto.id);
          setGeneratedProtocol(selectedProto.content);
          setGeneratedCrf(selectedProto.crfContent || null);
          setTitle(selectedProto.title);
          setAcronym(selectedProto.acronym);
          loadProtocolParameters(selectedProto);
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
      references,
      annexes,
      samplingStrategy,
      dataCollection,
      dataAnalysis
    };

    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);
    const isExistingProtocol = !!activeProtocolId;

    if (!isExistingProtocol && history.length >= quotaConfig.protocolsMax) {
      setShowQuotaModal(true);
      setLoading(false);
      return;
    }

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

      const response = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedProtocol(data.protocol);
        setGeneratedCrf(null);
        setPreviewMode('protocol');
        
        // Réutiliser l'ID actif si disponible, sinon en générer un nouveau
        const isExisting = !!activeProtocolId;
        const protocolId = activeProtocolId || Math.random().toString(36).substring(7);
        if (!isExisting) {
          setActiveProtocolId(protocolId);
        }
        
        // Sauvegarder dans l'historique local
        const newProtocolItem = {
          id: protocolId,
          title: title,
          acronym: acronym || 'SANS ACRONYME',
          date: new Date().toISOString(),
          content: data.protocol,
          crfContent: null,
          formData: formData
        };

        updateProgress((stats) => {
          const recent = stats.recentProtocols || [];
          const exists = recent.some((proto: any) => proto.id === protocolId);
          let updatedHistory;
          
          if (exists) {
            // Remplacer et remonter en haut de l'historique
            const filtered = recent.filter((proto: any) => proto.id !== protocolId);
            updatedHistory = [newProtocolItem, ...filtered];
          } else {
            updatedHistory = [newProtocolItem, ...recent];
          }
          
          return {
            protocolsGenerated: exists ? stats.protocolsGenerated : (stats.protocolsGenerated || 0) + 1,
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
        setHistory((prev) => {
          const exists = prev.some((proto: any) => proto.id === protocolId);
          if (exists) {
            const filtered = prev.filter((proto: any) => proto.id !== protocolId);
            return [newProtocolItem, ...filtered].slice(0, 15);
          } else {
            return [newProtocolItem, ...prev].slice(0, 15);
          }
        });
      } else {
        throw new Error(data.error || 'Erreur lors de la génération.');
      }
    } catch (error: any) {
      alert(`⚠️ Échec de la génération : ${error.message || 'Le serveur n\'a pas pu répondre.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCrf = async () => {
    if (!activeProtocolId || !generatedProtocol) {
      alert("Veuillez d'abord générer le protocole de recherche.");
      return;
    }

    setLoadingCrf(true);
    setGeneratedCrf(null);
    setPreviewMode('crf');

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
      references,
      annexes,
      samplingStrategy,
      dataCollection,
      dataAnalysis
    };

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

      const response = await fetch('/api/generate-crf', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          protocolContent: generatedProtocol
        })
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedCrf(data.crf);
        
        // Mettre à jour l'historique local avec le crfContent
        updateProgress((stats) => {
          const updatedHistory = stats.recentProtocols.map((proto: any) => {
            if (proto.id === activeProtocolId) {
              return { ...proto, crfContent: data.crf };
            }
            return proto;
          });
          return {
            ...stats,
            recentProtocols: updatedHistory
          };
        });

        // Mettre à jour l'état local de l'historique
        setHistory((prev) => 
          prev.map((proto: any) => {
            if (proto.id === activeProtocolId) {
              return { ...proto, crfContent: data.crf };
            }
            return proto;
          })
        );

        // Si connecté, synchroniser avec Firestore en arrière-plan
        if (user) {
          const updatedProtocolItem = {
            id: activeProtocolId,
            title,
            acronym: acronym || 'SANS ACRONYME',
            date: new Date().toISOString(),
            content: generatedProtocol || '',
            crfContent: data.crf,
            formData: formData
          };
          saveFirestoreProtocol(user.uid, updatedProtocolItem)
            .catch(e => console.error("Erreur de sauvegarde du CRF sur Firestore:", e));
          
          syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, getProgress())
            .catch(e => console.error("Erreur de synchronisation du profil sur Firestore après génération du CRF:", e));
        }
      } else {
        throw new Error(data.error || 'Erreur lors de la génération du CRF.');
      }
    } catch (error: any) {
      alert(`⚠️ Échec de la génération du CRF : ${error.message || 'Le serveur n\'a pas pu répondre.'}`);
      setPreviewMode('protocol');
    } finally {
      setLoadingCrf(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = previewMode === 'protocol' ? generatedProtocol : generatedCrf;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    alert(`${previewMode === 'protocol' ? 'Protocole' : 'Cahier d\'observation'} copié dans le presse-papiers !`);
  };

  const handleDownload = (format: 'md' | 'txt') => {
    const textToDownload = previewMode === 'protocol' ? generatedProtocol : generatedCrf;
    if (!textToDownload) return;
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${previewMode === 'protocol' ? 'protocole' : 'cahier_observation'}_${acronym || 'recherche'}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const userTier = getUserTier(profile);
    const quotaConfig = getQuotaConfig(userTier);
    const textToExport = previewMode === 'protocol' ? generatedProtocol : generatedCrf;
    if (!textToExport) return;

    const { authorName, profession, institution, city } = getUserProfileHeaderInfo(profile, user);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour pouvoir exporter le PDF.');
      return;
    }

    const formattedHtml = formatProtocolMarkdown(textToExport);
    const docTitle = previewMode === 'protocol' ? 'PROTOCOLE DE RECHERCHE CLINIQUE' : 'CAHIER D\'OBSERVATION CLINIQUE (CRF)';
    const filenameTitle = previewMode === 'protocol' ? `Protocole [${acronym || 'SANS ACRONYME'}]` : `CRF [${acronym || 'SANS ACRONYME'}]`;
    const patientFields = previewMode === 'crf' ? `
      <div style="border: 1px solid #e5e7eb; padding: 0.5rem; margin-bottom: 2rem; font-size: 10pt; background: #f9fafb; font-family: 'Inter', sans-serif;">
        <strong>Numéro de Centre :</strong> ______________  &nbsp;&nbsp;&nbsp;&nbsp;  <strong>Numéro de Patient :</strong> ______________  &nbsp;&nbsp;&nbsp;&nbsp;  <strong>Initiales :</strong> [___][___]
      </div>
    ` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${filenameTitle} - ${title || 'Sans titre'}</title>
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
            margin: 0;
            padding: 0;
            font-size: 11pt;
            background: #ffffff;
          }

          @page {
            size: A4;
            margin: 2.5cm 2.2cm 2.5cm 2.2cm;
            @bottom-left {
              content: "${authorName}${institution ? ' • ' + institution : ''}";
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

          .doc-header {
            border-bottom: 2px solid #005a70;
            padding-bottom: 0.75rem;
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .doc-header h3 {
            margin: 0 0 0.35rem 0;
            font-family: var(--font-title);
            font-size: 13pt;
            color: #005a70;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
            break-after: avoid;
          }

          h3 {
            font-family: var(--font-title);
            font-size: 11pt;
            color: #111827;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
            page-break-after: avoid;
            break-after: avoid;
          }

          p {
            margin-top: 0;
            margin-bottom: 0.85rem;
            text-align: justify;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          ul, ol {
            margin-top: 0;
            margin-bottom: 1rem;
            padding-left: 1.5rem;
          }

          li {
            margin-bottom: 0.35rem;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          table, tr, td, th {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          div, table {
            overflow: visible !important;
          }

          tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          hr {
            border: 0;
            border-top: 1px solid #e5e7eb;
            margin: 2rem 0;
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
                font-family: 'Outfit', sans-serif;
              }
            ` : ''}
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div style="flex: 1;">
            <h3>${docTitle}</h3>
            <div style="font-size: 9.5pt; color: #374151; line-height: 1.45; margin-top: 4px;">
              <div><strong>Auteur / Rédacteur :</strong> ${authorName}${profession ? ` <span style="color:#6b7280;">(${profession})</span>` : ''}</div>
              <div><strong>Institution :</strong> ${institution ? `${institution}${city ? ` — ${city}` : ''}` : '<span style="color:#9ca3af; font-style:italic;">Non renseignée</span>'}</div>
            </div>
          </div>
          <div class="doc-header-date" style="font-size: 8.5pt; color: #6b7280; text-align: right; white-space: nowrap; margin-left: 1rem;">
            Généré le ${new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>

        <h1>${title}</h1>
        ${acronym ? `<div class="acronym-badge">${acronym}</div>` : ''}

        ${patientFields}

        <div class="doc-body">
          ${formattedHtml}
        </div>

        ${quotaConfig.watermark ? `
          <div style="text-align:center; font-size:8.5pt; color:#ef4444; font-weight:700; border-top:1px dashed #fca5a5; padding-top:8px; margin-top:28px; font-family: sans-serif;">
            ⚠️ ${quotaConfig.watermarkText} — Surclassez votre compte vers la Formule ULTRA pour exporter sans filigrane
          </div>
        ` : ''}

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

  const handleNewProtocol = () => {
    setActiveProtocolId(null);
    setGeneratedProtocol(null);
    setGeneratedCrf(null);
    setTitle('');
    setAcronym('');
    setMethodology('observational');
    setBenefitType('sbid');
    setQuestion('');
    setDesign('Essai Clinique Randomisé Contrôlé (ECR)');
    setIntervention('');
    setPopulation('');
    setInclusion('');
    setExclusion('');
    setPrimaryEndpoint('');
    setSecondaryEndpoints('');
    setObjectives('');
    setBias('');
    setJustification('');
    setHypothesis('');
    setLogistics('');
    setPersonnel('');
    setBudget('');
    setCalendar('');
    setEthics('');
    setReferences('');
    setAnnexes('');
    setSamplingStrategy('');
    setDataCollection('');
    setDataAnalysis('');
    setActiveTab('info');
  };

  const handleSelectHistory = (item: any) => {
    setActiveProtocolId(item.id);
    setGeneratedProtocol(item.content);
    setGeneratedCrf(item.crfContent || null);
    setTitle(item.title);
    setAcronym(item.acronym);
    setPreviewMode('protocol');
    loadProtocolParameters(item);
  };

  const handleRegenerateProtocol = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (!confirm(`Souhaitez-vous régénérer entièrement le protocole "${item.title}" avec l'IA ?`)) return;
    
    await loadProtocolParameters(item);
    setActiveProtocolId(item.id);
    setPreviewMode('protocol');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      handleGenerate();
    }, 200);
  };

  const handleDeleteProtocol = async (e: React.MouseEvent, protocolId: string) => {
    e.stopPropagation();
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement ce protocole ?")) {
      return;
    }

    // Mettre à jour l'état local
    setHistory((prev) => prev.filter((p) => p.id !== protocolId));

    // Si le protocole supprimé était le protocole actif, réinitialiser la prévisualisation
    if (activeProtocolId === protocolId) {
      setActiveProtocolId(null);
      setGeneratedProtocol(null);
      setGeneratedCrf(null);
    }

    // Mettre à jour le localStorage
    updateProgress((stats) => {
      const updatedHistory = (stats.recentProtocols || []).filter((proto: any) => proto.id !== protocolId);
      return {
        ...stats,
        recentProtocols: updatedHistory
      };
    });

    // Supprimer sur Firestore si l'utilisateur est connecté
    if (user) {
      try {
        await deleteFirestoreProtocol(user.uid, protocolId);
        // Synchroniser le profil pour mettre à jour les statistiques
        await syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, getProgress());
      } catch (err) {
        console.error("Erreur lors de la suppression du protocole sur Firestore :", err);
      }
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className={styles.title} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', margin: 0 }}>
            <span>Générateur de Protocole de Recherche</span>
            {activeProtocolId && (
              <span style={{ fontSize: '0.85rem', fontWeight: 500, padding: '0.25rem 0.6rem', background: '#0d9488', color: 'white', borderRadius: '4px', verticalAlign: 'middle' }}>
                Chargé : {acronym || 'Sans acronyme'}
              </span>
            )}
          </h1>
          <p className={styles.subtitle} style={{ margin: '0.25rem 0 0 0' }}>
            Remplissez les détails cliniques pour générer une trame de protocole formalisée selon les exigences du RECIF.
          </p>
        </div>
        {activeProtocolId && (
          <button className="btn btn-secondary" onClick={handleNewProtocol}>
            Nouveau protocole
          </button>
        )}
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
              4. Logistique, Budget & Calendrier
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'finance' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('finance')}
            >
              5. Éthique & Références
            </button>
          </div>

          {extracting && (
            <div className={styles.extractionBanner}>
              <div className={styles.spinner}></div>
              <span>Extraction des 23 paramètres méthodologiques en cours...</span>
            </div>
          )}

          <div className={styles.stepContainer}>
            {activeTab === 'info' && (
              <>
                {!user ? (
                  <div className={styles.importPanelDisabled}>
                    <h4 className={styles.importTitle}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Pré-remplissage via le Tuteur IA
                    </h4>
                    <p className={styles.importText}>
                      Cette fonctionnalité de pré-remplissage automatique à partir de vos discussions avec le tuteur nécessite de vous connecter à votre compte.
                    </p>
                    <Link href="/login" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'inline-block', textDecoration: 'none' }}>
                      Se connecter
                    </Link>
                  </div>
                ) : (
                  <div className={styles.importPanel}>
                    <h4 className={styles.importTitle}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: 'var(--accent-primary)', verticalAlign: 'middle' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Pré-remplissage via le Tuteur IA
                    </h4>
                    <p className={styles.importText}>
                      Vous pouvez pré-remplir automatiquement les 23 paramètres méthodologiques de ce protocole à partir de l'une de vos discussions enregistrées avec le tuteur.
                    </p>
                    
                    <div className={styles.importRow}>
                      <select 
                        className="form-select" 
                        value={selectedChatId || ''} 
                        onChange={(e) => setSelectedChatId(e.target.value)}
                        disabled={extracting}
                        style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                      >
                        <option value="">-- Sélectionner une discussion --</option>
                        {tutorChats.length === 0 ? (
                          <option value="" disabled>Aucune discussion enregistrée avec le tuteur</option>
                        ) : (
                          tutorChats.map((chat) => (
                            <option key={chat.id} value={chat.id}>
                              {chat.title || 'Discussion sans titre'} ({chat.messages?.length || 0} messages)
                            </option>
                          ))
                        )}
                      </select>
                      
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={handleImportFromChat}
                        disabled={!selectedChatId || extracting}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                      >
                        {extracting ? (
                          <>
                            <div className={styles.spinner}></div>
                            Extraction...
                          </>
                        ) : "Importer"}
                      </button>
                    </div>

                    {extractionSuccess && (
                      <div className={styles.successNotice}>
                        ✅ 23 paramètres méthodologiques ont été importés et complétés avec succès ! Veuillez relire les onglets pour vérifier les informations.
                      </div>
                    )}
                    {extractionError && (
                      <div className={styles.errorNotice}>
                        ⚠️ {extractionError}
                      </div>
                    )}
                  </div>
                )}

                {/* 1. Informations Générales */}
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="title">Titre Complet de l'étude *</label>
                    <span className={styles.protoBadge}>RECIF Titre</span>
                  </div>
                  <textarea
                    id="title"
                    className={styles.protoTextarea}
                    rows={2}
                    placeholder="ex. Évaluation de l'efficacité de la thérapie X chez les patients atteints de Y..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="acronym">Acronyme</label>
                    <span className={styles.protoBadge}>Identification</span>
                  </div>
                  <input
                    id="acronym"
                    type="text"
                    className={styles.protoInput}
                    placeholder="ex. COVID-CARE"
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="methodology">Type de Recherche (Méthodologie)</label>
                    <span className={styles.protoBadge}>Schéma Clinique</span>
                  </div>
                  <select
                    id="methodology"
                    className={styles.protoSelect}
                    value={methodology}
                    onChange={(e) => setMethodology(e.target.value as 'interventional' | 'observational')}
                  >
                    <option value="observational">Étude clinique observationnelle (Épidémiologique ou pharmaco-épidémiologique)</option>
                    <option value="interventional">Étude clinique interventionnelle (Essai thérapeutique, diagnostique ou préventif)</option>
                  </select>
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="benefitType">Bénéfice individuel attendu</label>
                    <span className={styles.protoBadge}>Loi n° 18-11</span>
                  </div>
                  <select
                    id="benefitType"
                    className={styles.protoSelect}
                    value={benefitType}
                    onChange={(e) => setBenefitType(e.target.value as 'bid' | 'sbid')}
                  >
                    <option value="sbid">Étude sans bénéfice individuel direct (SBID, Art. 391)</option>
                    <option value="bid">Étude avec bénéfice individuel direct (Art. 388)</option>
                  </select>
                </div>
              </>
            )}

            {/* 2. Méthodologie */}
            {activeTab === 'methodo' && (
              <>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="question">Question de recherche principale *</label>
                    <span className={styles.protoBadge}>FINE & PICOT</span>
                  </div>
                  <textarea
                    id="question"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Quelle est la question clinique précise à laquelle l'étude doit répondre ?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="justification">Justification de l'étude (Rationnel scientifique)</label>
                    <span className={styles.protoBadge}>Justification</span>
                  </div>
                  <textarea
                    id="justification"
                    className={styles.protoTextarea}
                    rows={4}
                    placeholder="Pourquoi cette étude est-elle importante ? Originalité, urgence ou saisine d'hôpitaux..."
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="objectives">Objectifs secondaires</label>
                    <span className={styles.protoBadge}>Objectifs</span>
                  </div>
                  <textarea
                    id="objectives"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Décrivez les objectifs secondaires ou intermédiaires..."
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="hypothesis">Hypothèse(s) de recherche</label>
                    <span className={styles.protoBadge}>Hypothèse</span>
                  </div>
                  <textarea
                    id="hypothesis"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Quelle est la réponse théorique ou l'hypothèse principale à valider ?"
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="design">Schéma d'étude préconisé</label>
                    <span className={styles.protoBadge}>Design</span>
                  </div>
                  <select
                    id="design"
                    className={styles.protoSelect}
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
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="intervention">Description de l'intervention ou de l'exposition</label>
                    <span className={styles.protoBadge}>Intervention</span>
                  </div>
                  <textarea
                    id="intervention"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Décrivez précisément le traitement, le protocole de soin ou le paramètre évalué..."
                    value={intervention}
                    onChange={(e) => setIntervention(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* 3. Population & Critères */}
            {activeTab === 'endpoints' && (
              <>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="pop">Population cible</label>
                    <span className={styles.protoBadge}>Population</span>
                  </div>
                  <textarea
                    id="pop"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="ex. Patients adultes de 18 à 75 ans atteints de diabète de type 2 réfractaire..."
                    value={population}
                    onChange={(e) => setPopulation(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="primary">Critère de Jugement Principal *</label>
                    <span className={styles.protoBadge}>Critère Principal</span>
                  </div>
                  <textarea
                    id="primary"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Mesure clé objective (ex. Variation du taux d'HbA1c à 6 mois par rapport à l'inclusion)"
                    value={primaryEndpoint}
                    onChange={(e) => setPrimaryEndpoint(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="secondary">Critères de Jugement Secondaires</label>
                    <span className={styles.protoBadge}>Critères Secondaires</span>
                  </div>
                  <textarea
                    id="secondary"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="ex. Tolérance biologique, fréquence des accès d'hypoglycémie, qualité de vie (EQ-5D), analyse médico-économique"
                    value={secondaryEndpoints}
                    onChange={(e) => setSecondaryEndpoints(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="inclusion">Critères d'inclusion principaux (un par ligne)</label>
                    <span className={styles.protoBadge}>Inclusion</span>
                  </div>
                  <textarea
                    id="inclusion"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="ex. Âge >= 18 ans&#10;Diagnostic confirmé depuis > 1 an"
                    value={inclusion}
                    onChange={(e) => setInclusion(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="exclusion">Critères d'exclusion (un par ligne)</label>
                    <span className={styles.protoBadge}>Exclusion</span>
                  </div>
                  <textarea
                    id="exclusion"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="ex. Insuffisance rénale sévère&#10;Grossesse ou allaitement"
                    value={exclusion}
                    onChange={(e) => setExclusion(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="samplingStrategy">Stratégie d'échantillonnage</label>
                    <span className={styles.protoBadge}>Échantillonnage</span>
                  </div>
                  <textarea
                    id="samplingStrategy"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="ex. Échantillonnage aléatoire simple, échantillonnage consécutif, échantillonnage de convenance..."
                    value={samplingStrategy}
                    onChange={(e) => setSamplingStrategy(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="bias">Biais de recherche et facteurs de confusion</label>
                    <span className={styles.protoBadge}>Contrôle des Biais</span>
                  </div>
                  <textarea
                    id="bias"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="ex. Biais de mémorisation, biais de sélection lié à la clandestinité..."
                    value={bias}
                    onChange={(e) => setBias(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* 4. Logistique & Analyse */}
            {activeTab === 'logistics' && (
              <>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="dataCollection">Collecte des données</label>
                    <span className={styles.protoBadge}>Recueil</span>
                  </div>
                  <textarea
                    id="dataCollection"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Méthode et outils de collecte (ex. questionnaires standardisés, dossiers médicaux électroniques, observations directes...)"
                    value={dataCollection}
                    onChange={(e) => setDataCollection(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="logistics">Récolte des données & Étude pilote</label>
                    <span className={styles.protoBadge}>Logistique</span>
                  </div>
                  <textarea
                    id="logistics"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Logistique pratique, chaîne du froid, stockage, validation des questionnaires via une étude pilote..."
                    value={logistics}
                    onChange={(e) => setLogistics(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="dataAnalysis">Analyse des données (Plan statistique)</label>
                    <span className={styles.protoBadge}>Statistiques</span>
                  </div>
                  <textarea
                    id="dataAnalysis"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Méthodes d'analyse statistique prévues (ex. tests bilatéraux, régression logistique, seuil de significativité p < 0.05...)"
                    value={dataAnalysis}
                    onChange={(e) => setDataAnalysis(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="personnel">Personnel et rôles requis</label>
                    <span className={styles.protoBadge}>Équipe</span>
                  </div>
                  <textarea
                    id="personnel"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Qui participe (ARC, statisticiens, enquêteurs, psychologue clinicien...) et quels sont leurs rôles ?"
                    value={personnel}
                    onChange={(e) => setPersonnel(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="budget">Budget et Financement</label>
                    <span className={styles.protoBadge}>Budget</span>
                  </div>
                  <textarea
                    id="budget"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Chiffrage estimé (dosages, chélatants, licences de tests, promoteurs) et sources de financement..."
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="calendar">Calendrier prévisionnel</label>
                    <span className={styles.protoBadge}>Chronogramme</span>
                  </div>
                  <textarea
                    id="calendar"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Jalons principaux, recrutement, délais éthiques, soumissions et rédaction..."
                    value={calendar}
                    onChange={(e) => setCalendar(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* 5. Éthique & Annexes */}
            {activeTab === 'finance' && (
              <>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="ethics">Considérations éthiques supplémentaires</label>
                    <span className={styles.protoBadge}>Éthique</span>
                  </div>
                  <textarea
                    id="ethics"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Détails sur l'anonymisation, la notice d'information ou les dilemmes éthiques spécifiques..."
                    value={ethics}
                    onChange={(e) => setEthics(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="references">Références bibliographiques</label>
                    <span className={styles.protoBadge}>Bibliographie</span>
                  </div>
                  <textarea
                    id="references"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Études de référence, articles scientifiques, recommandations ou directives réglementaires..."
                    value={references}
                    onChange={(e) => setReferences(e.target.value)}
                  />
                </div>
                <div className={styles.protoFormGroup}>
                  <div className={styles.protoLabelHeader}>
                    <label className={styles.protoLabel} htmlFor="annexes">Annexes (à lister ou citer)</label>
                    <span className={styles.protoBadge}>Annexes</span>
                  </div>
                  <textarea
                    id="annexes"
                    className={styles.protoTextarea}
                    rows={3}
                    placeholder="Listez les documents annexes (ex: Formulaire de consentement éclairé, Grille de recueil, Questionnaire, Fiche d'information)..."
                    value={annexes}
                    onChange={(e) => setAnnexes(e.target.value)}
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
          <div className={styles.previewHeader} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid transparent' }}>
              <button
                className={`${styles.tabBtn} ${previewMode === 'protocol' ? styles.activeTab : ''}`}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem', borderBottomWidth: '2px', borderBottomStyle: 'solid' }}
                onClick={() => setPreviewMode('protocol')}
              >
                Protocole
              </button>
              <button
                className={`${styles.tabBtn} ${previewMode === 'crf' ? styles.activeTab : ''}`}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem', borderBottomWidth: '2px', borderBottomStyle: 'solid' }}
                onClick={() => setPreviewMode('crf')}
              >
                Cahier d'Observation (CRF)
              </button>
            </div>

            {((previewMode === 'protocol' && generatedProtocol) || (previewMode === 'crf' && generatedCrf)) && (
              <div className={styles.previewActions} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }}>
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
            {previewMode === 'protocol' ? (
              loading ? (
                <div className={styles.emptyPreview}>
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <svg className="animate-pulse" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 2s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>L'IA de Methodo&Clinique rédige votre protocole méthodologique...</span>
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
              )
            ) : (
              loadingCrf ? (
                <div className={styles.emptyPreview}>
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <svg className="animate-pulse" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 2s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>L'IA de Methodo&Clinique rédige votre cahier d'observation clinique (CRF)...</span>
                  </div>
                </div>
              ) : generatedCrf ? (
                <div dangerouslySetInnerHTML={{ __html: formatProtocolMarkdown(generatedCrf) }} />
              ) : !generatedProtocol ? (
                <div className={styles.emptyPreview}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="13" x2="15" y2="13" />
                    <line x1="9" y1="17" x2="15" y2="17" />
                  </svg>
                  <span>Veuillez d'abord remplir le formulaire de gauche et générer un protocole de recherche pour pouvoir créer son Cahier d'Observation (CRF).</span>
                </div>
              ) : (
                <div className={styles.emptyPreview} style={{ padding: '2rem 3rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem', opacity: 0.85 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="10" y2="15" />
                    <line x1="13" y1="15" x2="15" y2="15" />
                    <line x1="9" y1="11" x2="10" y2="11" />
                    <line x1="13" y1="11" x2="15" y2="11" />
                  </svg>
                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem' }}>Générer le Cahier d'Observation (CRF)</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem auto', lineHeight: '1.4' }}>
                    Le protocole de recherche clinique est prêt. Vous pouvez maintenant générer automatiquement le Cahier d'Observation Clinique (CRF) associé, structuré selon les 5 sections standards (Éligibilité, Démographie, Examen de base, Suivi & Fin de l'étude, Sécurité & Pharmacovigilance) avec des champs vides prêts à être imprimés ou codés.
                  </p>
                  <button className="btn btn-primary" onClick={handleGenerateCrf}>
                    Générer le CRF
                  </button>
                </div>
              )
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
                  onClick={() => handleSelectHistory(h)}
                  style={{ position: 'relative', cursor: 'pointer', padding: '1.25rem' }}
                >
                  <div className={styles.historyMeta} style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.82rem' }}>{h.acronym || 'PROTOCOLE'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(h.date).toLocaleDateString('fr-FR')} à {new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className={styles.historyTitle} style={{ marginBottom: '12px' }}>
                    {h.title.length > 60 ? h.title.substring(0, 60) + '...' : h.title}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleSelectHistory(h)}
                      style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Ouvrir ce protocole dans le lecteur"
                    >
                      👁️ Ouvrir
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => handleRegenerateProtocol(e, h)}
                      style={{ padding: '4px 10px', fontSize: '0.78rem', background: 'rgba(13, 148, 136, 0.15)', color: '#2dd4bf', border: '1px solid rgba(13, 148, 136, 0.4)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Régénérer ce protocole avec l'IA"
                    >
                      🔄 Régénérer
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => handleDeleteProtocol(e, h.id)}
                      style={{ padding: '4px 10px', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
                      title="Supprimer ce protocole"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <QuotaModal
        isOpen={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        featureName="Protocoles de Recherche Clinique"
        currentTier={getUserTier(profile)}
        maxLimit={getQuotaConfig(getUserTier(profile)).protocolsMax}
        onUpgradeClick={() => setShowSubscriptionModal(true)}
      />

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
