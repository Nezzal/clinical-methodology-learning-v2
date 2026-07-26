'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

const faqData = [
  {
    category: "🚀 Prise en main & Fonctionnalités",
    questions: [
      {
        q: "Comment générer un protocole d'étude clinique ?",
        a: "Vous pouvez le concevoir de deux manières : 1) Dans le menu \"Générateur de Protocole\", en saisissant les 23 paramètres requis ou via le questionnaire guidé. 2) Directement depuis le \"Tuteur Virtuel\" en discutant de votre idée de projet clinique. Le coach IA analysera la discussion pour pré-remplir et générer le protocole en un clic."
      },
      {
        q: "Qu'est-ce que le Cahier d'Observation (CRF) et comment l'obtenir ?",
        a: "Le CRF (Case Report Form) contient tous les formulaires requis pour recueillir les données de vos patients. Dès que votre protocole est généré, la plateforme conçoit automatiquement un CRF adapté à vos critères de jugement. Vous pouvez le visualiser et l'exporter depuis l'onglet \"Cahier d'Observation (CRF)\"."
      },
      {
        q: "Comment utiliser le Rédacteur d'article STROBE ?",
        a: "Le module \"Rédacteur d'Article STROBE\" vous permet de structurer votre manuscrit scientifique selon la grille internationale STROBE pour les études observationnelles (cohortes, cas-témoins, ou transversales). L'IA vous guide pas à pas pour rédiger le titre, l'introduction, les méthodes, les résultats et la discussion conformément aux standards de publication."
      },
      {
        q: "Comment utiliser le Calculateur NSN ?",
        a: "Accédez au module \"Calculateur NSN\". Saisissez vos hypothèses (risque alpha, puissance, différence clinique attendue) pour obtenir immédiatement le Nombre de Sujets Nécessaires. L'application rédige automatiquement le paragraphe de justification statistique à copier dans votre protocole."
      },
      {
        q: "Comment forcer le Tuteur IA à citer un document réglementaire ?",
        a: "Dans vos questions au Tuteur IA, demandez-lui explicitement : « Cite la Ligne Directrice de 2025 » ou « Selon la Loi 18-11 ». Il ciblera prioritairement ces bases de connaissances et mentionnera la source exacte sous forme de balise [Document, Page X]."
      },
      {
        q: "Qu'est-ce que le Rapport Pédagogique et comment est-il construit ?",
        a: "Le \"Rapport Pédagogique\" est un tableau de bord personnel généré par l'IA. Il évalue vos compétences méthodologiques en temps réel en analysant votre progression sur les quiz (réponses correctes), l'acquisition des concepts clés des flashcards (révision espacée) et le nombre de protocoles cliniques rédigés. Il définit votre niveau global (Débutant, Intermédiaire, ou Avancé)."
      },
      {
        q: "Comment fonctionne l'Espace Superviseur et la Messagerie ?",
        a: "Si votre compte est connecté au serveur (Firebase), vos travaux sont synchronisés. L'Espace Superviseur permet à vos enseignants ou superviseurs (comme le Pr Nezzal) de consulter vos protocoles et vos scores en temps réel. La \"Messagerie\" intégrée vous permet de poser des questions à vos encadrants et d'échanger pour valider vos projets cliniques."
      },
      {
        q: "Comment utiliser les Quiz et Flashcards pour réviser ?",
        a: "Les Quiz évaluent vos connaissances théoriques sur les biais de recherche et la puissance statistique. Les Flashcards utilisent le système de répétition espacée : vous devez évaluer vous-même si vous connaissez la définition d'un concept. Une carte est considérée comme \"maîtrisée\" lorsque vous la validez plusieurs fois avec succès."
      }
    ]
  },
  {
    category: "🛠️ Astuces d'Export & Rendu PDF",
    questions: [
      {
        q: "Mes boutons d'action (Copier, PDF) sont coupés sur l'écran, comment faire ?",
        a: "L'interface s'adaptant automatiquement, sur les petits écrans ou lors de la consultation d'onglets longs comme le CRF, les boutons d'exportation se replient proprement sur une ligne distincte directement sous la barre d'onglets pour rester entièrement accessibles."
      },
      {
        q: "Comment obtenir une pagination et un rendu parfaits à l'export PDF ?",
        a: "Lors de l'impression, décochez l'option \"En-têtes et pieds de page\" par défaut dans la boîte de dialogue d'impression de votre navigateur. La feuille de style intégrée de la plateforme gère elle-même une mise en page épurée et professionnelle (titres, numéros de pages dynamiques, et version)."
      },
      {
        q: "Puis-je modifier le protocole ou le CRF généré ?",
        a: "Oui ! Utilisez le bouton \"Copier\" pour coller le contenu dans Word ou Google Docs, ou cliquez sur \"Télécharger .md\" pour récupérer le fichier au format Markdown modifiable dans votre éditeur préféré."
      }
    ]
  },
  {
    category: "🔌 Connexion & Résolution des problèmes",
    questions: [
      {
        q: "Que signifie la bannière \"Mode Hors-ligne\" en haut de l'écran ?",
        a: "En cas de coupure de votre connexion Internet, l'application bascule automatiquement sur un modèle d'IA local (Ollama) s'il est actif sur votre machine. Dès que le réseau est rétabli, la plateforme repasse sur Google Gemini de façon transparente."
      }
    ]
  }
];

export default function SuspensionGuard({ children }: { children: React.ReactNode }) {
  const { 
    user, 
    loading, 
    isFirebaseConfigured, 
    isSuspended, 
    requirePasswordChange, 
    changePassword, 
    logout,
    guestMode
  } = useAuth();
  
  const pathname = usePathname();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMounted, setHasMounted] = useState(false);
  const [maxWaitExceeded, setMaxWaitExceeded] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const timer = setTimeout(() => {
      setMaxWaitExceeded(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaq, setActiveFaq] = useState<{ catIndex: number; qIndex: number } | null>(null);

  // États pour le statut de connexion internet
  const [isOnline, setIsOnline] = useState(true);
  const [showNetworkBanner, setShowNetworkBanner] = useState(false);
  const [bannerType, setBannerType] = useState<'offline' | 'online'>('online');

  // État de la barre latérale principale (Sidebar)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recif_sidebar_collapsed') === 'true';
      setIsSidebarCollapsed(saved);

      const handleSidebarChange = () => {
        const collapsed = localStorage.getItem('recif_sidebar_collapsed') === 'true';
        setIsSidebarCollapsed(collapsed);
      };

      window.addEventListener('sidebar_collapsed_changed', handleSidebarChange);
      return () => {
        window.removeEventListener('sidebar_collapsed_changed', handleSidebarChange);
      };
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setBannerType('online');
      setShowNetworkBanner(true);
      
      // Cache automatique de la bannière verte après 4 secondes
      const timer = setTimeout(() => {
        setShowNetworkBanner(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setBannerType('offline');
      setShowNetworkBanner(true);
      
      // Basculer automatiquement le fournisseur d'IA localement sur Ollama
      const currentProvider = localStorage.getItem('recif_ai_provider');
      if (currentProvider !== 'ollama') {
        localStorage.setItem('recif_ai_provider', 'ollama');
        window.dispatchEvent(new Event('ai_provider_changed'));
      }
    };

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(newPassword);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Une erreur est survenue lors de la mise à jour du mot de passe.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Redirection automatique pour les utilisateurs non connectés en production (Firebase activé)
  useEffect(() => {
    if ((!loading || maxWaitExceeded) && isFirebaseConfigured && !user && !guestMode && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, maxWaitExceeded, isFirebaseConfigured, guestMode, pathname, router]);

  // Écran de chargement initial pendant la vérification de la session ou le montage initial (SSR)
  if (!hasMounted || (loading && isFirebaseConfigured && !maxWaitExceeded)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#070a13',
        color: '#94a3b8',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(0, 229, 255, 0.1)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 1s infinite linear'
        }}></div>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Vérification de la session...</p>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  const isLoginPage = pathname === '/login';

  // Bloquer le rendu le temps de rediriger vers la page de connexion
  if (!loading && isFirebaseConfigured && !user && !guestMode && !isLoginPage) {
    return null;
  }

  if (isSuspended) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#070a13',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '2rem',
        color: '#f8fafc',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          maxWidth: '460px',
          width: '100%',
          padding: '2.5rem',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 10px 40px rgba(239, 68, 68, 0.1)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          
          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: '700',
            margin: 0,
            background: 'linear-gradient(to right, #ef4444, #f87171)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Accès Temporairement Suspendu
          </h2>
          
          <p style={{
            fontSize: '0.9rem',
            lineHeight: '1.6',
            color: '#94a3b8',
            margin: 0
          }}>
            Votre compte étudiant a été suspendu par l'équipe de supervision de la plateforme RECIF. Vous ne pouvez plus accéder aux modules d'apprentissage ni sauvegarder votre progression.
          </p>
          
          <p style={{
            fontSize: '0.8rem',
            color: '#64748b',
            margin: 0,
            fontStyle: 'italic'
          }}>
            Veuillez vous rapprocher de votre superviseur pédagogique pour régulariser votre situation.
          </p>
          
          <button 
            onClick={logout}
            style={{
              marginTop: '0.5rem',
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #0d9488 0%, #0b7a70 100%)',
              color: '#ffffff',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)'
            }}
          >
            Se déconnecter
          </button>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}} />
      </div>
    );
  }

  if (requirePasswordChange) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#070a13',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '2rem',
        color: '#f8fafc',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          maxWidth: '460px',
          width: '100%',
          padding: '2.5rem',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(13, 148, 136, 0.25)',
          boxShadow: '0 10px 40px rgba(13, 148, 136, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(13, 148, 136, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(13, 148, 136, 0.3)',
            color: '#0d9488'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              margin: '0 0 0.5rem 0',
              background: 'linear-gradient(to right, #0d9488, #2dd4bf)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Nouveau mot de passe requis
            </h2>
            <p style={{
              fontSize: '0.9rem',
              lineHeight: '1.6',
              color: '#94a3b8',
              margin: 0
            }}>
              Pour sécuriser votre compte, veuillez remplacer votre mot de passe temporaire par un mot de passe personnel.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontSize: '0.85rem',
                lineHeight: '1.4'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
              <label htmlFor="new-password" style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>
                Nouveau mot de passe
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                disabled={passwordLoading}
                required
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  color: '#ffffff',
                  outline: 'none',
                  fontSize: '0.9rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
              <label htmlFor="confirm-password" style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>
                Confirmer le mot de passe
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ressaisir le mot de passe"
                disabled={passwordLoading}
                required
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  color: '#ffffff',
                  outline: 'none',
                  fontSize: '0.9rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0d9488 0%, #0b7a70 100%)',
                color: '#ffffff',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
                opacity: passwordLoading ? 0.7 : 1
              }}
            >
              {passwordLoading ? 'Mise à jour en cours...' : 'Enregistrer le mot de passe'}
            </button>

            <button
              type="button"
              onClick={logout}
              disabled={passwordLoading}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'transparent',
                color: '#94a3b8',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease'
              }}
            >
              Se déconnecter
            </button>
          </form>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}} />
      </div>
    );
  }

  const toggleFaq = (catIndex: number, qIndex: number) => {
    if (activeFaq && activeFaq.catIndex === catIndex && activeFaq.qIndex === qIndex) {
      setActiveFaq(null);
    } else {
      setActiveFaq({ catIndex, qIndex });
    }
  };

  // Filtrage des FAQ par rapport à la recherche
  const filteredFaq = faqData.map((cat, catIdx) => {
    const matchedQuestions = cat.questions.map((q, qIdx) => ({
      ...q,
      originalQIndex: qIdx
    })).filter(q => 
      q.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
      q.a.toLowerCase().includes(faqSearch.toLowerCase())
    );
    return {
      ...cat,
      originalCatIndex: catIdx,
      questions: matchedQuestions
    };
  }).filter(cat => cat.questions.length > 0);

  // Si on est sur la page de connexion, afficher le contenu nu (sans Sidebar ni conteneur décalé)
  if (isLoginPage) {
    return <main style={{ width: '100%', minHeight: '100vh' }}>{children}</main>;
  }

  // Rendu par défaut de l'application avec la Sidebar
  return (
    <div className="app-layout-wrapper" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        marginLeft: isSidebarCollapsed ? '70px' : '280px', 
        padding: '2rem', 
        minHeight: '100vh', 
        width: isSidebarCollapsed ? 'calc(100% - 70px)' : 'calc(100% - 280px)',
        maxWidth: isSidebarCollapsed ? 'calc(100vw - 70px)' : 'calc(100vw - 280px)',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        transition: 'margin-left var(--transition-normal), width var(--transition-normal)'
      }}>
        {children}
      </main>

      {/* Bouton d'action flottant (FAB) FAQ */}
      <button
        onClick={() => setIsFaqOpen(true)}
        className="faq-fab no-print"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          right: '1.25rem',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.95) 0%, rgba(79, 70, 229, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          outline: 'none',
          padding: 0
        }}
        title="Foire Aux Questions"
        aria-label="Ouvrir la FAQ"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </button>

      {/* Overlay / Arrière-plan flouté */}
      <div
        onClick={() => setIsFaqOpen(false)}
        className="faq-overlay no-print"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(7, 10, 19, 0.4)',
          backdropFilter: 'blur(8px)',
          zIndex: 999998,
          transition: 'opacity 0.3s ease',
          opacity: isFaqOpen ? 1 : 0,
          pointerEvents: isFaqOpen ? 'all' : 'none'
        }}
      />

      {/* Panneau latéral (Drawer) FAQ */}
      <div
        className="faq-drawer no-print"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100vw',
          maxWidth: '420px',
          height: '100vh',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(8, 14, 28, 0.99) 100%)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
          zIndex: 999999,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isFaqOpen ? 'translateX(0)' : 'translateX(100%)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        {/* Header du Drawer */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#ffffff',
              fontFamily: 'Inter, sans-serif'
            }}>FAQ & Aide</h3>
            <p style={{
              margin: '0.2rem 0 0 0',
              fontSize: '0.8rem',
              color: '#64748b',
              fontFamily: 'Inter, sans-serif'
            }}>Trouvez des réponses rapides à vos questions</p>
          </div>
          <button
            onClick={() => setIsFaqOpen(false)}
            className="faq-close-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s, color 0.2s'
            }}
            aria-label="Fermer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Barre de recherche */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          position: 'relative'
        }}>
          <div style={{ position: 'relative' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{
              position: 'absolute',
              left: '0.85rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              color: '#64748b',
              pointerEvents: 'none'
            }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Rechercher une question, Loi, biais..."
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#ffffff',
                padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                fontSize: '0.9rem',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'Inter, sans-serif'
              }}
            />
            {faqSearch && (
              <button
                onClick={() => setFaqSearch('')}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.85rem'
                }}
                type="button"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Liste des Questions / Accordéons */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }} className="faq-drawer-content">
          {filteredFaq.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: '#64748b',
              fontFamily: 'Inter, sans-serif'
            }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Aucun résultat trouvé pour « <strong>{faqSearch}</strong> »</p>
            </div>
          ) : (
            filteredFaq.map((cat) => (
              <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h4 style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#0d9488',
                  margin: '0.5rem 0 0.5rem 0',
                  fontWeight: '700',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {cat.category}
                </h4>
                {cat.questions.map((q) => {
                  const isOpen = activeFaq !== null && 
                    activeFaq.catIndex === cat.originalCatIndex && 
                    activeFaq.qIndex === q.originalQIndex;
                  return (
                    <div
                      key={q.q}
                      className="faq-accordion-card"
                      style={{
                        background: 'rgba(30, 41, 59, 0.3)',
                        borderRadius: '10px',
                        border: isOpen ? '1px solid rgba(13, 148, 136, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s, background-color 0.2s'
                      }}
                    >
                      <div
                        onClick={() => toggleFaq(cat.originalCatIndex, q.originalQIndex)}
                        style={{
                          padding: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem'
                        }}
                      >
                        <span style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#f8fafc',
                          lineHeight: '1.4',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {q.q}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{
                          width: '14px',
                          height: '14px',
                          color: isOpen ? '#0d9488' : '#94a3b8',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          flexShrink: 0
                        }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateRows: isOpen ? '1fr' : '0fr',
                        transition: 'grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        overflow: 'hidden'
                      }}>
                        <div style={{ minHeight: 0 }}>
                          <div style={{
                            padding: '0 1rem 1rem 1rem',
                            fontSize: '0.85rem',
                            color: '#94a3b8',
                            lineHeight: '1.5',
                            fontFamily: 'Inter, sans-serif',
                            borderTop: '1px solid rgba(255, 255, 255, 0.02)'
                          }}>
                            {q.a}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bannière de notification réseau */}
      {showNetworkBanner && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          padding: '0.85rem 1.5rem',
          borderRadius: '10px',
          background: bannerType === 'offline' 
            ? 'rgba(239, 68, 68, 0.15)' 
            : 'rgba(16, 185, 129, 0.15)',
          backdropFilter: 'blur(20px)',
          border: bannerType === 'offline'
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: bannerType === 'offline'
            ? '0 10px 40px rgba(239, 68, 68, 0.15)'
            : '0 10px 40px rgba(16, 185, 129, 0.15)',
          color: '#ffffff',
          fontSize: '0.875rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: 'Inter, sans-serif'
        }}>
          {bannerType === 'offline' ? (
            <>
              <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}>⚠️</span>
              <span><strong>Mode Hors-ligne :</strong> Connexion Internet perdue. Bascule automatique sur l'IA Ollama (Locale).</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}>🟢</span>
              <span><strong>Connexion rétablie :</strong> Vous pouvez de nouveau utiliser Google Gemini (Cloud).</span>
            </>
          )}
          <button 
            onClick={() => setShowNetworkBanner(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              opacity: 0.7,
              fontSize: '1.1rem',
              padding: 0,
              marginLeft: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1
            }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          main {
            margin-left: 0 !important;
            width: 100% !important;
            padding: 1.5rem !important;
            padding-top: 5rem !important;
          }
        }
        @keyframes slideDown {
          from { transform: translate(-50%, -30px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .faq-fab {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background 0.3s ease !important;
        }
        .faq-fab:hover {
          transform: scale(1.1) rotate(5deg) !important;
          box-shadow: 0 12px 40px rgba(13, 148, 136, 0.5) !important;
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.95) 0%, rgba(99, 102, 241, 0.95) 100%) !important;
        }
        .faq-fab:active {
          transform: scale(0.95) !important;
        }
        .faq-drawer-content {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }
        .faq-drawer-content::-webkit-scrollbar {
          width: 6px;
        }
        .faq-drawer-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .faq-drawer-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }
        .faq-accordion-card:hover {
          background-color: rgba(30, 41, 59, 0.5) !important;
          border-color: rgba(13, 148, 136, 0.25) !important;
        }
        .faq-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: #ffffff !important;
        }
      `}} />
    </div>
  );
}
