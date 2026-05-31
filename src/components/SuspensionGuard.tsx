'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

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

  useEffect(() => {
    setHasMounted(true);
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
    if (!loading && isFirebaseConfigured && !user && !guestMode && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, isFirebaseConfigured, guestMode, pathname, router]);

  // Écran de chargement initial pendant la vérification de la session ou le montage initial (SSR)
  if (!hasMounted || (loading && isFirebaseConfigured)) {
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

  // Si on est sur la page de connexion, afficher le contenu nu (sans Sidebar ni conteneur décalé)
  if (isLoginPage) {
    return <main style={{ width: '100%', minHeight: '100vh' }}>{children}</main>;
  }

  // Rendu par défaut de l'application avec la Sidebar
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        marginLeft: '280px', 
        padding: '2rem', 
        minHeight: '100vh', 
        width: 'calc(100% - 280px)',
        transition: 'margin-left var(--transition-normal)'
      }}>
        {children}
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          main {
            margin-left: 0 !important;
            width: 100% !important;
            padding: 1.5rem !important;
            padding-top: 5rem !important;
          }
        }
      `}} />
    </div>
  );
}
