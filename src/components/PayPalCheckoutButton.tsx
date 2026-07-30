'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PayPalCheckoutButtonProps {
  tier: 'pro' | 'expert' | 'ultra';
  duration: '1m' | '3m' | '6m' | '12m';
  residence: 'africa' | 'western';
  onSuccess?: (details: Record<string, unknown>) => void;
  onError?: (err: string) => void;
}

interface PayPalButtonsInstance {
  render: (container: HTMLElement) => void;
}

interface PayPalSDK {
  Buttons: (config: {
    style?: Record<string, string>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError: (err: unknown) => void;
  }) => PayPalButtonsInstance;
}

declare global {
  interface Window {
    paypal?: PayPalSDK;
  }
}

export default function PayPalCheckoutButton({
  tier,
  duration,
  residence,
  onSuccess,
  onError
}: PayPalCheckoutButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingSdk, setLoadingSdk] = useState(true);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paypalConfig, setPaypalConfig] = useState<{ clientId: string; mode: string } | null>(null);

  const handleSuccess = useCallback((details: Record<string, unknown>) => {
    if (onSuccess) onSuccess(details);
  }, [onSuccess]);

  const handleError = useCallback((err: string) => {
    if (onError) onError(err);
  }, [onError]);

  // 1. Récupération dynamique de la configuration PayPal depuis le serveur
  useEffect(() => {
    let isMounted = true;
    fetch('/api/paypal/config')
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.clientId) {
          setPaypalConfig({ clientId: data.clientId, mode: data.mode || 'sandbox' });
        }
      })
      .catch(err => {
        console.warn("⚠️ Impossible de charger /api/paypal/config:", err);
        if (isMounted) {
          setPaypalConfig({ clientId: 'test', mode: 'sandbox' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Chargement du SDK JavaScript PayPal
  useEffect(() => {
    if (!paypalConfig) return;

    let isMounted = true;
    const clientId = paypalConfig.clientId;

    // Masquer les exceptions non gérées spécifiques au SDK PayPal v5 en mode débug Next.js
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (event.reason.message?.includes('paypal') || String(event.reason).includes('paypal'))) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const timeoutTimer = setTimeout(() => {
      if (isMounted && !window.paypal) {
        setLoadingSdk(false);
        setSdkError("Le chargement du SDK PayPal a expiré. Réessayez ou vérifiez vos clés API.");
      }
    }, 10000);

    const loadScript = () => {
      const scriptId = 'paypal-js-sdk';
      const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

      // Nettoyer l'ancien script si la clé Client ID a changé entre-temps
      if (existingScript) {
        const activeClientId = existingScript.getAttribute('data-client-id');
        if (activeClientId !== clientId) {
          existingScript.remove();
          delete window.paypal;
        } else if (window.paypal) {
          if (isMounted) {
            setLoadingSdk(false);
            clearTimeout(timeoutTimer);
          }
          return;
        }
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.setAttribute('data-client-id', clientId);
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&components=buttons`;
      script.async = true;
      script.onload = () => {
        clearTimeout(timeoutTimer);
        if (isMounted) setLoadingSdk(false);
      };
      script.onerror = () => {
        clearTimeout(timeoutTimer);
        if (isMounted) {
          setSdkError("Impossible de charger les serveurs de paiement PayPal (Vérifiez la clé Client ID dans .env.local).");
          setLoadingSdk(false);
        }
      };
      document.body.appendChild(script);
    };

    loadScript();

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [paypalConfig]);

  // 3. Rendu du bouton PayPal
  useEffect(() => {
    if (loadingSdk || sdkError || !window.paypal || !containerRef.current) {
      return;
    }

    containerRef.current.innerHTML = '';

    try {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'pay'
        },
        createOrder: async () => {
          if (!userEmail.trim()) {
            alert("Veuillez indiquer votre adresse e-mail ci-dessous avant de cliquer sur le bouton PayPal.");
            return '';
          }

          try {
            const res = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tier,
                duration,
                residence,
                userEmail: userEmail.trim()
              })
            });

            const data = await res.json();
            if (!res.ok || data.error) {
              const errStr = data.error || "Erreur de création de la commande PayPal.";
              alert(errStr);
              handleError(errStr);
              return '';
            }

            return data.orderID || '';
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Erreur de création de commande.";
            console.error("Erreur createOrder:", errMsg);
            handleError(errMsg);
            return '';
          }
        },
        onApprove: async (data: { orderID: string }) => {
          if (!data?.orderID) return;
          setIsProcessing(true);
          try {
            const res = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderID: data.orderID,
                tier,
                duration,
                residence,
                userInfo: {
                  email: userEmail.trim(),
                  firstName: userName.trim().split(' ')[0] || '',
                  lastName: userName.trim().split(' ').slice(1).join(' ') || '',
                  country: residence === 'africa' ? 'Afrique' : 'Europe & Occident'
                }
              })
            });

            const captureData = await res.json();
            if (!res.ok || captureData.error) {
              throw new Error(captureData.error || "Échec de validation du paiement.");
            }

            setSuccessMessage(captureData.message || "Paiement réussi et abonnement activé !");
            handleSuccess(captureData);
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Erreur lors de la capture du paiement.";
            alert(errMsg);
            handleError(errMsg);
          } finally {
            setIsProcessing(false);
          }
        },
        onError: (err: unknown) => {
          console.error("❌ Notification PayPal SDK onError:", err);
          handleError("Une erreur est survenue lors de l'interaction avec PayPal.");
        }
      }).render(containerRef.current);
    } catch (renderErr: unknown) {
      console.error("Erreur de rendu du bouton PayPal:", renderErr);
    }
  }, [loadingSdk, sdkError, tier, duration, residence, userEmail, userName, handleSuccess, handleError]);

  if (successMessage) {
    return (
      <div style={{
        background: 'rgba(34, 197, 94, 0.15)',
        border: '1px solid #22c55e',
        borderRadius: '12px',
        padding: '16px',
        color: '#4ade80',
        textAlign: 'center',
        fontWeight: 600,
        margin: '12px 0'
      }}>
        <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>⚡ Paiement Réussi !</div>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>{successMessage}</p>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>Un e-mail de confirmation et vos accès vous ont été envoyés.</p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '1.2rem' }}>⚡</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>
          Paiement Automatique Instantané via PayPal / Carte Bancaire
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <input
          type="email"
          required
          placeholder="Votre adresse e-mail de compte *"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(30, 41, 59, 0.9)',
            color: 'white',
            fontSize: '0.85rem'
          }}
        />
        <input
          type="text"
          placeholder="Nom et Prénom (optionnel)"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(30, 41, 59, 0.9)',
            color: 'white',
            fontSize: '0.85rem'
          }}
        />
      </div>

      {isProcessing && (
        <div style={{ textAlign: 'center', color: '#fbbf24', padding: '10px', fontSize: '0.88rem' }}>
          ⏳ Validation du paiement PayPal et activation automatique en cours...
        </div>
      )}

      {loadingSdk && !isProcessing && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '12px', fontSize: '0.82rem' }}>
          Chargement du module sécurisé PayPal...
        </div>
      )}

      {sdkError && (
        <div style={{ color: '#ef4444', fontSize: '0.82rem', padding: '8px 0', textAlign: 'center' }}>
          ⚠️ {sdkError}
        </div>
      )}

      <div ref={containerRef} style={{ marginTop: '8px' }} />

      <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '8px 0 0 0', textAlign: 'center' }}>
        🔒 Transaction 100% sécurisée par PayPal SSL. Vos accès sont débloqués immédiatement avec vos jours bonus offerts.
      </p>
    </div>
  );
}
