'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getProgress } from '@/utils/storage';
import { loadUserProfile, listenToUnreadMessages } from '@/utils/firestore';
import { APP_VERSION } from '@/utils/constants';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, logout, isFirebaseConfigured, guestMode, isAdmin, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [level, setLevel] = useState('Débutant');

  const [profileName, setProfileName] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [unreadCount, setUnreadCount] = useState(0);

  const [localModels, setLocalModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recif_sidebar_collapsed') === 'true';
      setIsCollapsed(saved);

      const handleSidebarChange = () => {
        const collapsed = localStorage.getItem('recif_sidebar_collapsed') === 'true';
        setIsCollapsed(collapsed);
      };

      window.addEventListener('sidebar_collapsed_changed', handleSidebarChange);
      return () => {
        window.removeEventListener('sidebar_collapsed_changed', handleSidebarChange);
      };
    }
  }, []);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('recif_sidebar_collapsed', String(next));
    window.dispatchEvent(new Event('sidebar_collapsed_changed'));
  };

  useEffect(() => {
    if (!user || !role) {
      setUnreadCount(0);
      return;
    }
    try {
      const unsubscribe = listenToUnreadMessages(
        user.uid,
        role as 'student' | 'teacher' | 'admin',
        (count) => {
          setUnreadCount(count);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Sidebar: Failed to setup listenToUnreadMessages", e);
    }
  }, [user, role]);

  useEffect(() => {
    const handleProviderChange = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('recif_ai_provider') as 'gemini' | 'ollama';
        if (saved === 'ollama' || saved === 'gemini') {
          setAiProvider(saved);
        }
      }
    };

    handleProviderChange();
    window.addEventListener('ai_provider_changed', handleProviderChange);
    return () => {
      window.removeEventListener('ai_provider_changed', handleProviderChange);
    };
  }, []);

  const handleToggleAi = () => {
    const next = aiProvider === 'gemini' ? 'ollama' : 'gemini';
    setAiProvider(next);
    localStorage.setItem('recif_ai_provider', next);
    window.dispatchEvent(new Event('ai_provider_changed'));
  };

  // Charger le modèle sélectionné
  useEffect(() => {
    const handleModelChangeLocal = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('recif_ollama_model') || '';
        setSelectedModel(saved);
      }
    };
    handleModelChangeLocal();
    window.addEventListener('ollama_model_changed', handleModelChangeLocal);
    return () => {
      window.removeEventListener('ollama_model_changed', handleModelChangeLocal);
    };
  }, []);

  // Récupérer la liste des modèles locaux
  useEffect(() => {
    if (aiProvider === 'ollama') {
      const fetchOllamaModels = async () => {
        try {
          const res = await fetch('/api/ollama-tags');
          if (res.ok) {
            const data = await res.json();
            if (data.models && Array.isArray(data.models)) {
              const names = data.models.map((m: any) => m.name);
              setLocalModels(names);
              
              const savedModel = localStorage.getItem('recif_ollama_model');
              if (names.length > 0) {
                if (!savedModel || !names.includes(savedModel)) {
                  const defaultModel = names.includes('gemma4:latest') 
                    ? 'gemma4:latest' 
                    : (names.includes('qwen3:14b') ? 'qwen3:14b' : names[0]);
                  setSelectedModel(defaultModel);
                  localStorage.setItem('recif_ollama_model', defaultModel);
                  window.dispatchEvent(new Event('ollama_model_changed'));
                } else {
                  setSelectedModel(savedModel);
                }
              }
            }
          } else {
            throw new Error('Incapable de joindre Ollama tags API');
          }
        } catch (err) {
          console.warn("Sidebar: Failed to fetch local Ollama models. Is Ollama running and CORS configured?", err);
          const savedModel = localStorage.getItem('recif_ollama_model') || 'gemma4:latest';
          setLocalModels(Array.from(new Set([savedModel, 'gemma4:latest', 'qwen3:14b'])));
          if (!savedModel) {
            setSelectedModel('gemma4:latest');
            localStorage.setItem('recif_ollama_model', 'gemma4:latest');
          }
        }
      };

      fetchOllamaModels();
    }
  }, [aiProvider]);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('recif_ollama_model', model);
    window.dispatchEvent(new Event('ollama_model_changed'));
  };

  useEffect(() => {
    if (user) {
      if (role === 'admin' || role === 'teacher') {
        setProfileName('Superviseur RECIF');
      } else {
        setProfileName(profile?.displayName || user.displayName || 'Utilisateur');
      }
    } else {
      setProfileName('');
    }
  }, [user, profile, role]);

  const toggleSidebar = () => setIsOpen(!isOpen);

  // Charger le niveau de l'utilisateur
  useEffect(() => {
    const fetchLevel = async () => {
      if (profile?.level) {
        setLevel(profile.level);
        return;
      }

      if (user) {
        try {
          // Tenter de lire depuis Firestore
          const profileData = await loadUserProfile(user.uid);
          if (profileData?.level) {
            setLevel(profileData.level);
            return;
          }
        } catch (e) {
          console.warn("Sidebar: loadUserProfile error, using local fallback...", e);
        }
      }
      
      // Fallback sur le niveau LocalStorage
      const localStats = getProgress();
      const totalQuiz = localStats.quizTotal || 0;
      const correctQuiz = localStats.quizCorrect || 0;
      const quizPct = totalQuiz > 0 ? (correctQuiz / totalQuiz) * 100 : 0;
      const fcMastered = localStats.flashcardsMastered?.length || 0;
      
      if (quizPct >= 80 && fcMastered >= 10) {
        setLevel('Avancé');
      } else if (quizPct >= 50 || fcMastered >= 4 || localStats.protocolsGenerated > 0) {
        setLevel('Intermédiaire');
      } else {
        setLevel('Débutant');
      }
    };

    fetchLevel();

    // Écouter les changements locaux
    window.addEventListener('progress_changed', fetchLevel);
    return () => window.removeEventListener('progress_changed', fetchLevel);
  }, [user, profile]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const links = [
    {
      href: '/',
      label: 'Tableau de Bord',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      )
    },
    {
      href: '/tuteur',
      label: 'Tuteur Virtuel RECIF',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 10h.01" />
          <path d="M12 10h.01" />
          <path d="M16 10h.01" />
        </svg>
      )
    },
    {
      href: '/protocole',
      label: 'Générateur de Protocole',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    },
    {
      href: '/quiz',
      label: 'Quiz & Flashcards',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
          <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
        </svg>
      )
    },
    {
      href: '/rapport',
      label: 'Rapport Pédagogique',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
      )
    },
    {
      href: '/calculateur',
      label: 'Calculateur NSN',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="8" y1="14" x2="16" y2="14" />
          <line x1="8" y1="18" x2="16" y2="18" />
          <line x1="8" y1="10" x2="16" y2="10" />
          <line x1="8" y1="6" x2="16" y2="6" />
        </svg>
      )
    },
    {
      href: '/article',
      label: "Rédacteur d'Article STROBE",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    }
  ];

  const adminLink = {
    href: '/admin',
    label: 'Espace Superviseur',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  };

  const adminMessagesLink = {
    href: '/admin?tab=messages',
    label: 'Messagerie',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    )
  };

  const contactLink = {
    href: '/contact',
    label: 'Support / Contact',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    )
  };

  const activeLinks = isAdmin ? [...links, adminLink, adminMessagesLink] : [...links, contactLink];

  return (
    <>
      <button className={`${styles.mobileToggle} no-print`} onClick={toggleSidebar} aria-label="Toggle navigation">
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''} ${isCollapsed ? styles.collapsed : ''} no-print`}>
        <button 
          className={styles.collapseToggleBtn} 
          onClick={toggleCollapse} 
          title={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
          aria-label={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>

        <div className={styles.logoContainer}>
          <svg className={styles.logoIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
            <path d="M12 2C6.5 2 2 6.5 2 12c0 2.3.8 4.4 2.1 6.1" />
            <path d="M22 12c0-5.5-4.5-10-10-10a9.9 9.9 0 0 0-2.1.2" />
            <path d="M12 18v-4" />
            <path d="m9 13 3-3 3 3" />
          </svg>
          <span className={styles.logoText}>Méthodo Clinique</span>
        </div>

        <nav className={styles.sidebarNav}>
          <ul className={styles.navLinks}>
            {activeLinks.map((link) => {
              let isActive = false;
              if (typeof window !== 'undefined') {
                const currentSearch = window.location.search;
                if (link.href.includes('?')) {
                  const [linkPath, linkSearch] = link.href.split('?');
                  isActive = pathname === linkPath && currentSearch.includes(linkSearch);
                } else {
                  if (link.href === '/admin') {
                    isActive = pathname === '/admin' && !currentSearch.includes('tab=messages') && !currentSearch.includes('tab=requests');
                  } else {
                    isActive = pathname === link.href;
                  }
                }
              } else {
                isActive = pathname === link.href;
              }

              const hasBadge = unreadCount > 0 && (
                (link.href === '/contact' && !isAdmin) || 
                (link.href === '/admin?tab=messages' && isAdmin)
              );
              return (
                <li
                  key={link.href}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <Link href={link.href} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {link.icon}
                    <span>{link.label}</span>
                    {hasBadge && <span className={styles.sidebarBadge} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Commutateur de Fournisseur d'IA */}
        <div className={styles.aiToggleSection}>
          <span className={styles.aiToggleLabel}>Moteur d'IA :</span>
          <button 
            className={`${styles.aiToggleBtn} ${aiProvider === 'gemini' ? styles.geminiActive : styles.ollamaActive}`} 
            onClick={handleToggleAi}
            title={aiProvider === 'gemini' ? "Basculer sur Ollama Local (Gemma 4)" : "Basculer sur Google Gemini (Cloud)"}
          >
            <span className={styles.aiToggleIcon}>
              {aiProvider === 'gemini' ? '☁️' : '🤖'}
            </span>
            <span className={styles.aiToggleText}>
              {aiProvider === 'gemini' ? 'Gemini (Cloud)' : 'Ollama (Local)'}
            </span>
          </button>

          {aiProvider === 'ollama' && (
            <div className={styles.ollamaModelSection}>
              <span className={styles.aiToggleLabel}>Modèle Ollama :</span>
              <select
                className={styles.modelSelect}
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={localModels.length === 0}
              >
                {localModels.length > 0 ? (
                  localModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                ) : (
                  <option value="">(Aucun modèle)</option>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Section Profil de l'utilisateur */}
        <div className={styles.profileSection}>
          {user ? (
            <div className={styles.profileContainer}>
              <div className={styles.profileCard}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className={styles.avatar} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {(profileName || user.email || 'U').substring(0, 1).toUpperCase()}
                  </div>
                )}
                <div className={styles.userDetails}>
                  <div className={styles.userName} title={profileName || 'Utilisateur'}>
                    {profileName || 'Utilisateur'}
                  </div>
                  <div className={styles.userLevel}>
                    {role === 'admin' || role === 'teacher' ? (
                      <>Rôle: <span className={styles.levelBadge}>{role === 'admin' ? 'Administrateur' : 'Enseignant'}</span></>
                    ) : (
                      <>Niveau: <span className={styles.levelBadge}>{level}</span></>
                    )}
                  </div>
                </div>
              </div>
              <button className={styles.logoutBtn} onClick={handleLogout}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.logoutIcon}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Se déconnecter (Quitter)</span>
              </button>
            </div>
          ) : guestMode ? (
            <div className={styles.guestCard}>
              <div className={styles.guestDetails}>
                <div className={styles.guestTitle}>Mode Invité Local</div>
                <div className={styles.guestSubtitle}>Données non synchronisées</div>
              </div>
              <button className={styles.logoutBtn} onClick={handleLogout} style={{ marginTop: '0.75rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.logoutIcon}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Quitter le mode hors-ligne</span>
              </button>
            </div>
          ) : (
            <div className={styles.guestCard}>
              <div className={styles.guestDetails}>
                <div className={styles.guestTitle}>Mode Invité Local</div>
                <div className={styles.guestSubtitle}>Données non synchronisées</div>
              </div>
              <Link href="/login" className={styles.loginBtn}>
                <span>Connexion</span>
              </Link>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span>RECIF Éducation v{APP_VERSION}</span>
        </div>
      </aside>
    </>
  );
}
