'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getProgress, updateProgress } from '@/utils/storage';
import { useAuth } from '@/context/AuthContext';
import { saveFirestoreChat, loadFirestoreChats, deleteFirestoreChat, syncUserProfile } from '@/utils/firestore';
import styles from './page.module.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function renderHtmlTable(rows: string[]): string {
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

// Simple helper function to format Markdown-like syntax into HTML safely
function formatMarkdown(text: string): string {
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
        const htmlTable = renderHtmlTable(tableRows);
        processedLines.push(htmlTable);
        inTable = false;
      }
      processedLines.push(lines[i]);
    }
  }
  
  if (inTable) {
    const htmlTable = renderHtmlTable(tableRows);
    processedLines.push(htmlTable);
  }

  formatted = processedLines.join('\n');

  // Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Inline Code: `text`
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Headers
  formatted = formatted.replace(/^### (.*?)$/gm, '<h4 style="margin: 0.75rem 0 0.25rem 0; color: var(--text-primary);">$1</h4>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h3 style="margin: 1rem 0 0.35rem 0; color: var(--accent-primary);">$1</h3>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h2 style="margin: 1.25rem 0 0.5rem 0; color: var(--accent-primary);">$1</h2>');

  // List items
  formatted = formatted.replace(/^\s*[-*]\s+(.*?)$/gm, '<li style="margin-left: 1.25rem; list-style-type: disc; margin-bottom: 0.25rem;">$1</li>');

  // Double newlines to paragraphs/line breaks
  formatted = formatted.split('\n').join('<br />');

  // Cleanup redundant br tags
  formatted = formatted.replace(/(<\/h2>|<\/h3>|<\/h4>|<\/li>)<br \/>/g, '$1');
  
  return formatted;
}

export default function Tuteur() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activePlayingMessageIndex, setActivePlayingMessageIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setActivePlayingMessageIndex(null);
  };

  const cleanTextForSpeech = (text: string) => {
    let clean = text.replace(/<[^>]*>/g, '');
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
    clean = clean.replace(/\*([^*]+)\*/g, '$1');
    clean = clean.replace(/__([^_]+)__/g, '$1');
    clean = clean.replace(/_([^_]+)_/g, '$1');
    clean = clean.replace(/^#+\s+(.*?)$/gm, '$1');
    clean = clean.replace(/^\s*[-*+]\s+(.*?)$/gm, '$1');
    clean = clean.replace(/^\s*\d+\.\s+(.*?)$/gm, '$1');
    clean = clean.replace(/`([^`]+)`/g, '$1');
    clean = clean.split('\n').join(' ');
    clean = clean.replace(/\s+/g, ' ');
    return clean.trim();
  };

  const toggleSpeech = (index: number, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (activePlayingMessageIndex === index) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    try {
      const cleanText = cleanTextForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'fr-FR';

      const voices = window.speechSynthesis.getVoices();
      const frVoice = voices.find((v) => v.lang.startsWith('fr'));
      if (frVoice) {
        utterance.voice = frVoice;
      }

      utterance.onend = () => {
        setActivePlayingMessageIndex(null);
      };

      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        setActivePlayingMessageIndex(null);
      };

      window.speechSynthesis.speak(utterance);
      setActivePlayingMessageIndex(index);
    } catch (err) {
      console.error("Failed to start speech synthesis:", err);
      setActivePlayingMessageIndex(null);
    }
  };

  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript}` : transcript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const getWelcomeMessage = () => ({
    role: 'assistant' as const,
    content: `Bonjour ! Je suis votre tuteur virtuel spécialisé dans la méthodologie de recherche clinique et le manuel **RECIF**.\n\nJe peux vous expliquer les différents schémas d'études (cohortes, essais randomisés, etc.), vous détailler les obligations de la **réglementation algérienne (Loi n° 18-11 relative à la santé)**, ou vous aider à concevoir la méthodologie de vos projets. Que souhaitez-vous savoir aujourd'hui ?`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  });

  const startNewSession = () => {
    setActiveSessionId(`chat_${Math.random().toString(36).substring(7)}`);
    setMessages([getWelcomeMessage()]);
  };

  const handleSelectSession = (session: any) => {
    setActiveSessionId(session.id);
    setMessages(session.messages || []);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (confirm('Voulez-vous vraiment supprimer cette discussion ?')) {
      const updatedList = sessions.filter(s => s.id !== sessionId);
      setSessions(updatedList);
      
      if (activeSessionId === sessionId) {
        if (updatedList.length > 0) {
          setActiveSessionId(updatedList[0].id);
          setMessages(updatedList[0].messages || []);
        } else {
          startNewSession();
        }
      }
      
      // Supprimer en arrière-plan
      deleteFirestoreChat(user.uid, sessionId)
        .catch(err => console.error("Erreur suppression session:", err));
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsRecognitionSupported(true);
      }
    }
    
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    stopSpeaking();
  }, [activeSessionId]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (user) {
        try {
          const list = await loadFirestoreChats(user.uid);
          setSessions(list);
          if (list.length > 0) {
            setActiveSessionId(list[0].id);
            setMessages(list[0].messages || []);
          } else {
            startNewSession();
          }
        } catch (e) {
          console.error("Erreur de chargement des sessions:", e);
        }
      } else {
        setSessions([]);
        setActiveSessionId(null);
        setMessages([getWelcomeMessage()]);
      }
    };

    fetchSessions();
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    stopSpeaking();

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      currentSessionId = `chat_${Math.random().toString(36).substring(7)}`;
      setActiveSessionId(currentSessionId);
    }

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    // Mettre à jour l'historique et les statistiques locales
    updateProgress((stats) => {
      const updatedQuestions = [...stats.recentQuestions];
      if (!updatedQuestions.includes(textToSend)) {
        updatedQuestions.unshift(textToSend);
      }
      return {
        questionsAsked: stats.questionsAsked + 1,
        recentQuestions: updatedQuestions.slice(0, 10)
      };
    });

    if (user) {
      const titleText = textToSend.length > 25 ? textToSend.substring(0, 25) + '...' : textToSend;
      const existingSession = sessions.find(s => s.id === currentSessionId);
      const title = existingSession?.title || titleText;
      
      // Lancer la sauvegarde et la synchronisation en arrière-plan sans bloquer l'appel de l'API
      saveFirestoreChat(user.uid, currentSessionId, title, updatedMessages)
        .catch(e => console.error("Erreur de sauvegarde de la question sur Firestore:", e));
      
      syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, getProgress())
        .catch(e => console.error("Erreur de synchronisation du profil sur Firestore:", e));
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-ai-provider': localStorage.getItem('recif_ai_provider') || 'gemini'
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (response.ok && !data.error) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.text,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);

        if (user) {
          // Trouver ou générer le titre
          const firstUserMessage = finalMessages.find(m => m.role === 'user');
          const titleText = firstUserMessage ? (firstUserMessage.content.length > 25 ? firstUserMessage.content.substring(0, 25) + '...' : firstUserMessage.content) : 'Discussion';
          const existingSession = sessions.find(s => s.id === currentSessionId);
          const title = existingSession?.title || titleText;

          // Mettre à jour l'état local immédiatement pour afficher le titre dans la barre latérale sans attendre Firestore
          const updatedList = sessions.map(s => {
            if (s.id === currentSessionId) {
              return { ...s, title, messages: finalMessages, updatedAt: new Date().toISOString() };
            }
            return s;
          });
          const hasSession = sessions.some(s => s.id === currentSessionId);
          if (!hasSession) {
            updatedList.unshift({
              id: currentSessionId,
              title,
              messages: finalMessages,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
          setSessions(updatedList);

          // Sauvegarder en tâche de fond
          saveFirestoreChat(user.uid, currentSessionId, title, finalMessages)
            .catch(e => console.error("Erreur de sauvegarde de la réponse sur Firestore:", e));
        }
      } else {
        throw new Error(data.error || 'Erreur lors de la communication avec le tuteur.');
      }

    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `⚠️ Une erreur s'est produite : ${error.message || 'Impossible de joindre le service de tutorat. Veuillez réessayer.'}`,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const transcript = messages
      .map((m) => `[${m.timestamp}] ${m.role === 'user' ? 'Étudiant' : 'Tuteur RECIF'}:\n${m.content}\n`)
      .join('\n----------------------------------------\n\n');

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `discussion_tuteur_recif_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMessageTxt = (index: number, content: string) => {
    let textContent = content;
    // Nettoyer les blocs de code markdown ```html ou ``` si l'assistant a entouré le code
    const matchCodeBlock = content.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
    if (matchCodeBlock) {
      textContent = matchCodeBlock[1];
    }

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reponse_tuteur_recif_${index + 1}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMessageHtml = (index: number, content: string) => {
    // Nettoyer les blocs de code markdown ```html ou ``` si l'assistant a entouré le code
    let htmlContent = content.trim();
    const matchCodeBlock = htmlContent.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
    if (matchCodeBlock) {
      htmlContent = matchCodeBlock[1].trim();
    }

    let bodyContent = '';
    let extraStyles = '';

    // Détecter si le contenu contient déjà du HTML
    const hasHtmlTags = htmlContent.toLowerCase().includes('<html') || htmlContent.toLowerCase().includes('<!doctype') || htmlContent.toLowerCase().includes('<body');

    if (hasHtmlTags) {
      // Extraire le corps du HTML s'il existe
      if (htmlContent.toLowerCase().includes('<body')) {
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        bodyContent = bodyMatch ? bodyMatch[1].trim() : htmlContent;
      } else if (htmlContent.toLowerCase().includes('<html')) {
        const htmlMatch = htmlContent.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
        bodyContent = htmlMatch ? htmlMatch[1].trim() : htmlContent;
      } else {
        bodyContent = htmlContent;
      }

      // Extraire également les styles éventuels générés par l'IA pour ne pas les perdre
      const styleMatches = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        extraStyles = styleMatches
          .map((s) => {
            const match = s.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            return match ? match[1] : '';
          })
          .join('\n');
      }
    } else {
      // Sinon, c'est du markdown standard : nous le convertissons en HTML sémantique
      const parseMarkdownToHtml = (md: string): string => {
        let text = md.replace(/\r\n/g, '\n').trim();

        // 1. Sauvegarder les blocs de code pour éviter qu'ils ne soient altérés
        const codeBlocks: string[] = [];
        text = text.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
          const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
          const escapedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          codeBlocks.push(`<pre><code class="language-${lang}">${escapedCode}</code></pre>`);
          return placeholder;
        });

        // 2. Parser les tableaux Markdown
        const parseTable = (tableMd: string): string => {
          const lines = tableMd.trim().split('\n');
          if (lines.length < 2) return tableMd;
          
          const parseRow = (line: string, cellTag: string) => {
            const cells = line.split('|').map(c => c.trim());
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            return `<tr>${cells.map(cell => `<${cellTag}>${parseInline(cell)}</${cellTag}>`).join('')}</tr>`;
          };

          const headersHtml = parseRow(lines[0], 'th');
          const rowsHtml = lines.slice(2).map(line => parseRow(line, 'td')).join('');
          return `<div class="table-container"><table><thead>${headersHtml}</thead><tbody>${rowsHtml}</tbody></table></div>`;
        };

        text = text.replace(/(?:^\|.+$[\n\r]*)+/gm, (match) => parseTable(match));

        // Fonction auxiliaire pour le markdown en ligne (gras, italique, code, badges de pages)
        const parseInline = (str: string): string => {
          let s = str;
          // Badges pour les pages : [Page X] ou [Page X, Page Y] ou [Pages X-Y]
          s = s.replace(/\[Page\s*(\d+)\]/gi, '<span class="page-badge"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>p. $1</span>');
          s = s.replace(/\[Pages\s*(\d+)(?:-(\d+))?\]/gi, '<span class="page-badge"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>pp. $1-$2</span>');
          s = s.replace(/\[Page\s*(\d+),\s*Page\s*(\d+)\]/gi, '<span class="page-badge"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>pp. $1, $2</span>');

          s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
          s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
          s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
          s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
          return s;
        };

        // 3. Découpage en blocs par double retour à la ligne
        const blocks = text.split(/\n\n+/);
        const parsedBlocks = blocks.map(block => {
          const trimmed = block.trim();
          if (!trimmed) return '';

          // Rétablir le bloc de code s'il s'agit d'un placeholder
          if (trimmed.startsWith('__CODE_BLOCK_PLACEHOLDER_')) {
            return trimmed;
          }

          if (trimmed.startsWith('<div class="table-container">')) {
            return trimmed;
          }

          // Titres
          if (trimmed.startsWith('# ')) {
            return `<h1 class="report-h1">${parseInline(trimmed.substring(2))}</h1>`;
          }
          if (trimmed.startsWith('## ')) {
            return `<h2 class="report-h2">${parseInline(trimmed.substring(3))}</h2>`;
          }
          if (trimmed.startsWith('### ')) {
            return `<h3 class="report-h3">${parseInline(trimmed.substring(4))}</h3>`;
          }

          // Citations / Blockquotes
          if (trimmed.startsWith('>')) {
            const quoteText = trimmed.split('\n').map(line => line.replace(/^>\s?/, '').trim()).join('\n');
            return `<blockquote>${parseMarkdownToHtml(quoteText)}</blockquote>`;
          }

          // Listes non-ordonnées
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
            const items = trimmed.split(/\n[-*+]\s+/);
            items[0] = items[0].replace(/^[-*+]\s+/, '');
            const itemsHtml = items.map(item => `<li>${parseInline(item)}</li>`).join('');
            return `<ul>${itemsHtml}</ul>`;
          }

          // Listes ordonnées
          if (/^\d+\.\s+/.test(trimmed)) {
            const items = trimmed.split(/\n\d+\.\s+/);
            items[0] = items[0].replace(/^\d+\.\s+/, '');
            const itemsHtml = items.map(item => `<li>${parseInline(item)}</li>`).join('');
            return `<ol>${itemsHtml}</ol>`;
          }

          // Paragraphe standard
          const paragraphLines = trimmed.split('\n').map(line => parseInline(line)).join('<br />');
          return `<p>${paragraphLines}</p>`;
        });

        let finalHtml = parsedBlocks.join('\n');

        // Réinjecter les blocs de code sauvegardés
        codeBlocks.forEach((codeBlock, idx) => {
          finalHtml = finalHtml.replace(`__CODE_BLOCK_PLACEHOLDER_${idx}__`, codeBlock);
        });

        return finalHtml;
      };

      bodyContent = parseMarkdownToHtml(htmlContent);
    }

    const fullDocument = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Rapport Tuteur RECIF - Question ${index + 1}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
    
    :root {
      --primary: #0f766e;
      --primary-light: #f0fdf4;
      --primary-border: #ccfbf1;
      --secondary: #0284c7;
      --secondary-light: #f0f9ff;
      --secondary-border: #e0f2fe;
      --text-main: #1e293b;
      --text-muted: #475569;
      --text-light: #94a3b8;
      --bg-page: #f8fafc;
      --bg-card: #ffffff;
      --border-color: #e2e8f0;
      --border-light: #f1f5f9;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7;
      color: var(--text-main);
      background-color: var(--bg-page);
      margin: 0;
      padding: 2.5rem 1.5rem;
    }
    
    .no-print-bar {
      max-width: 850px;
      margin: 0 auto 1.5rem auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background-color: var(--primary);
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(15, 118, 110, 0.2), 0 2px 4px -1px rgba(15, 118, 110, 0.1);
      transition: all 0.2s ease;
      text-decoration: none;
    }
    
    .btn-print:hover {
      background-color: #0d9488;
      transform: translateY(-1px);
      box-shadow: 0 10px 15px -3px rgba(15, 118, 110, 0.25);
    }

    .btn-print svg {
      stroke: currentColor;
    }
    
    .report-sheet {
      max-width: 850px;
      background-color: var(--bg-card);
      margin: 0 auto;
      padding: 3.5rem;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.02), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
      border: 1px solid var(--border-color);
      position: relative;
    }
    
    /* En-tête du document */
    .report-header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 1.5rem;
      margin-bottom: 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .header-left h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      margin: 0 0 0.25rem 0;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header-left p {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    
    .header-right {
      text-align: right;
    }
    
    .report-badge {
      background-color: var(--primary-light);
      color: var(--primary);
      border: 1px solid var(--primary-border);
      padding: 4px 12px;
      border-radius: 50px;
      font-size: 0.75rem;
      font-weight: 700;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    
    .report-date {
      font-size: 0.8rem;
      color: var(--text-light);
      margin: 0;
    }
    
    /* Corps du document */
    .report-content h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.75rem;
      color: var(--text-main);
      margin-top: 2rem;
      margin-bottom: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }
    
    .report-content h2 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.35rem;
      color: var(--primary);
      margin-top: 1.75rem;
      margin-bottom: 1rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
    }
    
    .report-content h2::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 1.2rem;
      background-color: var(--primary);
      margin-right: 10px;
      border-radius: 2px;
    }
    
    .report-content h3 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.15rem;
      color: var(--text-main);
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      font-weight: 600;
    }
    
    .report-content p {
      margin-top: 0;
      margin-bottom: 1.25rem;
      color: var(--text-muted);
    }
    
    .report-content strong {
      color: var(--text-main);
      font-weight: 600;
    }
    
    .report-content ul, .report-content ol {
      margin-top: 0;
      margin-bottom: 1.5rem;
      padding-left: 1.5rem;
    }
    
    .report-content li {
      margin-bottom: 0.5rem;
      color: var(--text-muted);
    }
    
    /* Visual Cards for Blockquotes */
    .report-content blockquote {
      background-color: var(--primary-light);
      border-left: 4px solid var(--primary);
      margin: 1.5rem 0;
      padding: 1.25rem 1.75rem;
      border-radius: 0 12px 12px 0;
      color: #0f766e;
    }
    
    .report-content blockquote p {
      margin: 0;
      color: #0f766e;
      font-style: italic;
      font-size: 1.02rem;
    }
    
    /* Tables design */
    .table-container {
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }
    
    .report-content table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    
    .report-content th {
      background-color: var(--bg-page);
      color: var(--text-main);
      font-weight: 600;
      text-align: left;
      padding: 10px 14px;
      border-bottom: 2px solid var(--border-color);
    }
    
    .report-content td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-muted);
    }
    
    .report-content tr:nth-child(even) {
      background-color: var(--bg-page);
    }
    
    /* Inline page badge */
    .page-badge {
      background-color: var(--secondary-light);
      color: var(--secondary);
      border: 1px solid var(--secondary-border);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: 600;
      margin: 0 4px;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }
    
    /* Code block styling */
    code {
      background: var(--bg-page);
      padding: 0.2em 0.4em;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      color: #c2410c;
      border: 1px solid var(--border-color);
    }
    
    pre {
      background: var(--bg-page);
      padding: 1.25rem;
      border-radius: 12px;
      overflow-x: auto;
      border: 1px solid var(--border-color);
      margin: 1.5rem 0;
    }
    
    pre code {
      background: none;
      border: none;
      padding: 0;
      color: var(--text-main);
      font-size: 0.85rem;
    }
    
    /* Footer style */
    .report-footer {
      margin-top: 4rem;
      border-top: 1px solid var(--border-color);
      padding-top: 1.5rem;
      font-size: 0.78rem;
      color: var(--text-light);
      text-align: center;
      line-height: 1.6;
    }
    
    ${extraStyles}
    
    /* Print styles */
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
        margin: 0;
      }
      
      .no-print-bar {
        display: none !important;
      }
      
      .report-sheet {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
      
      h1, h2, h3, h4 {
        page-break-after: avoid;
        break-after: avoid;
      }
      
      blockquote, pre, table, tr, li, p {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <button class="btn-print" onclick="window.print()">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      Imprimer / PDF
    </button>
  </div>
  
  <div class="report-sheet">
    <header class="report-header">
      <div class="header-left">
        <h1>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary); vertical-align:middle;">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            <path d="M12 11v6"></path>
            <path d="M9 14h6"></path>
          </svg>
          Tuteur Virtuel RECIF
        </h1>
        <p>Accompagnement Méthodologique</p>
      </div>
      <div class="header-right">
        <span class="report-badge">Manuel RECIF & Loi 18-11</span>
        <p class="report-date">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    </header>
    
    <main class="report-content">
      ${bodyContent}
    </main>
    
    <footer class="report-footer">
      Document issu de la plateforme Clinical Methodology Learning<br>
      Basé sur le Référentiel RECIF (Recherche Clinique et Épidémiologique) et conforme aux articles 377-399 de la Loi n° 18-11 du 2 juillet 2018 relative à la santé.
    </footer>
  </div>
</body>
</html>`;

    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(fullDocument);
      newWindow.document.close();
    } else {
      const blob = new Blob([fullDocument], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reponse_tuteur_recif_${index + 1}_${new Date().toISOString().slice(0, 10)}.html`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const suggestions = [
    "Qu'est-ce que la loi n° 18-11 en Algérie ?",
    "Comment formuler un bon critère de jugement principal ?",
    "Quelles études cliniques définit la loi 18-11 ?",
    "Comment calculer la taille de l'échantillon (NSN) ?"
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Tuteur Virtuel RECIF</h1>
        <p className={styles.subtitle}>
          Posez vos questions méthodologiques et réglementaires sur la base du guide officiel de recherche clinique.
        </p>
      </header>

      <div className={styles.actionsHeader}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Session active • {messages.filter(m => m.role === 'user').length} question(s)
        </span>
        {messages.length > 1 && (
          <button className={styles.exportBtn} onClick={handleExport}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exporter la discussion
          </button>
        )}
      </div>

      <div className={styles.chatArea}>
        {/* Barre latérale des sessions */}
        <div className={styles.sidebarPanel}>
          <div className={styles.sidebarHeader}>
            <button 
              className={styles.newChatBtn} 
              onClick={startNewSession}
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouvelle Discussion
            </button>
          </div>
          
          <div className={styles.sessionsScroll}>
            {user ? (
              sessions.map((session) => {
                const isActive = activeSessionId === session.id;
                return (
                  <div 
                    key={session.id} 
                    className={`${styles.sessionItem} ${isActive ? styles.sessionItemActive : ''}`}
                    onClick={() => handleSelectSession(session)}
                  >
                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionTitle}>{session.title || 'Discussion sans titre'}</div>
                    </div>
                    <button 
                      className={styles.deleteSessionBtn} 
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      title="Supprimer la discussion"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className={styles.guestInfoCard}>
                Connectez-vous pour conserver et créer plusieurs sessions de chat.
              </div>
            )}
          </div>
        </div>

        {/* Zone de chat active */}
        <div className={styles.chatContentArea}>
          {/* Liste des messages */}
          <div className={styles.messagesList}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userMessage : styles.tutorMessage}`}
              >
                <div
                  className={styles.messageBubble}
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                />
                <span className={styles.messageMeta}>
                  {msg.role === 'user' ? 'Vous' : 'Tuteur RECIF'} • {msg.timestamp}
                  {msg.role === 'assistant' && (
                    <>
                      <button
                        type="button"
                        className={`${styles.speakBtn} ${activePlayingMessageIndex === index ? styles.speakBtnActive : ''}`}
                        onClick={() => toggleSpeech(index, msg.content)}
                        title={activePlayingMessageIndex === index ? "Arrêter la lecture" : "Lire à haute voix"}
                      >
                        {activePlayingMessageIndex === index ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        className={styles.exportMsgBtn}
                        onClick={() => handleExportMessageTxt(index, msg.content)}
                        title="Exporter la réponse en TXT"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        TXT
                      </button>

                      <button
                        type="button"
                        className={styles.exportMsgBtn}
                        onClick={() => handleExportMessageHtml(index, msg.content)}
                        title="Ouvrir la réponse dans un nouvel onglet"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        HTML
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}
            {loading && (
              <div className={`${styles.messageWrapper} ${styles.tutorMessage}`}>
                <div className={`${styles.messageBubble} ${styles.tutorMessage}`}>
                  <div className={styles.typingIndicator}>
                    <div className={styles.typingDot}></div>
                    <div className={styles.typingDot}></div>
                    <div className={styles.typingDot}></div>
                  </div>
                </div>
                <span className={styles.messageMeta}>Tuteur RECIF réfléchit...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions de questions rapides */}
          <div className={styles.suggestions}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                className={styles.suggestionBtn}
                onClick={() => handleSend(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Zone d'entrée de saisie */}
          <form
            className={styles.inputArea}
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
          >
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Posez votre question sur la méthodologie RECIF..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            {isRecognitionSupported && (
              <button
                type="button"
                className={`${styles.micBtn} ${isListening ? styles.micBtnListening : ''}`}
                onClick={toggleListening}
                disabled={loading}
                title={isListening ? "Arrêter l'écoute" : "Saisie vocale"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim() || loading}
            >
              <span>Envoyer</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
