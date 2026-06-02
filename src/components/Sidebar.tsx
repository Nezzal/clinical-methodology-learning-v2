'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getProgress } from '@/utils/storage';
import { loadUserProfile } from '@/utils/firestore';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, logout, isFirebaseConfigured, guestMode } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [level, setLevel] = useState('Débutant');

  const [isAdmin, setIsAdmin] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama'>('gemini');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recif_ai_provider') as 'gemini' | 'ollama';
      if (saved === 'ollama' || saved === 'gemini') {
        setAiProvider(saved);
      }
    }
  }, []);

  const handleToggleAi = () => {
    const next = aiProvider === 'gemini' ? 'ollama' : 'gemini';
    setAiProvider(next);
    localStorage.setItem('recif_ai_provider', next);
    window.dispatchEvent(new Event('ai_provider_changed'));
  };

  useEffect(() => {
    if (user && user.email) {
      const email = user.email.toLowerCase();
      const isTeacher = email === 'admin@recif.dz' || email === 'enseignant@recif.dz' || email.endsWith('@recif.dz');
      setIsAdmin(isTeacher);
      
      if (email === 'admin@recif.dz' || email === 'enseignant@recif.dz') {
        setProfileName('Superviseur RECIF');
      } else {
        setProfileName(profile?.displayName || user.displayName || 'Utilisateur');
      }
    } else {
      setIsAdmin(false);
      setProfileName('');
    }
  }, [user, profile]);

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

  const activeLinks = isAdmin ? [...links, adminLink] : links;

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

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''} no-print`}>
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
              const isActive = pathname === link.href;
              return (
                <li
                  key={link.href}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <Link href={link.href}>
                    {link.icon}
                    <span>{link.label}</span>
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
                    Niveau: <span className={styles.levelBadge}>{level}</span>
                  </div>
                </div>
              </div>
              <button className={styles.logoutBtn} onClick={handleLogout}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Se déconnecter (Quitter)
              </button>
            </div>
          ) : guestMode ? (
            <div className={styles.guestCard}>
              <div className={styles.guestDetails}>
                <div className={styles.guestTitle}>Mode Invité Local</div>
                <div className={styles.guestSubtitle}>Données non synchronisées</div>
              </div>
              <button className={styles.logoutBtn} onClick={handleLogout} style={{ marginTop: '0.75rem', width: '100%' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Quitter le mode hors-ligne
              </button>
            </div>
          ) : (
            <div className={styles.guestCard}>
              <div className={styles.guestDetails}>
                <div className={styles.guestTitle}>Mode Invité Local</div>
                <div className={styles.guestSubtitle}>Données non synchronisées</div>
              </div>
              <Link href="/login" className={styles.loginBtn}>
                Connexion
              </Link>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span>RECIF Éducation v1.0</span>
        </div>
      </aside>
    </>
  );
}
