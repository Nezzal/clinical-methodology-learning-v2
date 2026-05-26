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

// Simple helper function to format Markdown-like syntax into HTML safely
function formatMarkdown(text: string): string {
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

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
      try {
        await deleteFirestoreChat(user.uid, sessionId);
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
      } catch (err) {
        console.error("Erreur suppression session:", err);
      }
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
      try {
        const titleText = textToSend.length > 25 ? textToSend.substring(0, 25) + '...' : textToSend;
        // Si c'est le premier message de l'utilisateur, utiliser son titre, sinon garder le titre de la session si elle existe déjà
        const existingSession = sessions.find(s => s.id === currentSessionId);
        const title = existingSession?.title || titleText;
        await saveFirestoreChat(user.uid, currentSessionId, title, updatedMessages);
        await syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, getProgress());
      } catch (e) {
        console.error("Erreur de sauvegarde de la question sur Firestore:", e);
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.text,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);

        if (user) {
          try {
            // Trouver ou générer le titre
            const firstUserMessage = finalMessages.find(m => m.role === 'user');
            const titleText = firstUserMessage ? (firstUserMessage.content.length > 25 ? firstUserMessage.content.substring(0, 25) + '...' : firstUserMessage.content) : 'Discussion';
            const existingSession = sessions.find(s => s.id === currentSessionId);
            const title = existingSession?.title || titleText;
            
            await saveFirestoreChat(user.uid, currentSessionId, title, finalMessages);
            
            // Recharger la liste des sessions
            const list = await loadFirestoreChats(user.uid);
            setSessions(list);
          } catch (e) {
            console.error("Erreur de sauvegarde de la réponse sur Firestore:", e);
          }
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
