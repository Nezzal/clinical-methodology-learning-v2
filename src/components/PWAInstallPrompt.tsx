'use client';

import React, { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Vérifier si déjà fermé récemment
    const dismissedUntil = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      setIsDismissed(true);
      return;
    }

    // Enregistrer le Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('⚠️ Échec enregistrement Service Worker PWA:', err);
      });
    }

    // Détecter si déjà en mode Standalone / PWA installée
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    // Écouter le déclencheur d'installation Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroidPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Détecter iOS Safari
    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);

    if (isIOS && isSafari && !isStandalone) {
      setShowIOSPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowAndroidPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Ne plus ré-afficher pendant 7 jours
    localStorage.setItem('pwa_prompt_dismissed', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
  };

  if (isDismissed || (!showAndroidPrompt && !showIOSPrompt)) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      width: '92%',
      maxWidth: '480px',
      background: 'linear-gradient(135deg, #1c2541 0%, #0b132b 100%)',
      border: '1px solid rgba(56, 189, 248, 0.4)',
      borderRadius: '16px',
      padding: '16px 18px',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.2)',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.6rem' }}>📱</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#38bdf8' }}>
              Installer sur Smartphone
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Methodo&amp;Clinique en App plein écran
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '4px 8px'
          }}
          title="Fermer"
        >
          ✕
        </button>
      </div>

      {showAndroidPrompt && (
        <button
          onClick={handleInstallClick}
          style={{
            background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 14px',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          📲 Installer l'application en 1 Clic
        </button>
      )}

      {showIOSPrompt && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '10px 12px',
          fontSize: '0.8rem',
          color: '#e2e8f0',
          lineHeight: '1.45',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          💡 <strong>Sur iPhone / iPad (Safari) :</strong> Touchez le bouton de partage <strong style={{ color: '#38bdf8' }}>[⎋]</strong> en bas puis choisissez <strong style={{ color: '#2dd4bf' }}>« Sur l'écran d'accueil »</strong> pour l'utiliser comme une vraie app !
        </div>
      )}
    </div>
  );
}
