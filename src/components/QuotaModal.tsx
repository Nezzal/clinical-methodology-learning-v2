'use client';

import React from 'react';
import { SubscriptionTier } from '@/utils/quota';

interface QuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  currentTier: SubscriptionTier;
  maxLimit: number;
  onUpgradeClick?: () => void;
}

export function QuotaModal({
  isOpen,
  onClose,
  featureName,
  currentTier,
  maxLimit,
  onUpgradeClick
}: QuotaModalProps) {
  if (!isOpen) return null;

  const isDecouverte = currentTier === 'découverte';
  const tierTitle = isDecouverte ? 'Découverte (3 jours)' : 'PRO';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))',
        border: '1.5px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.2)',
        color: '#f8fafc',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
          margin: '0 auto 16px'
        }}>
          ⚠️
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', color: '#f87171', fontWeight: 800 }}>
          Quota Atteint — Formule {tierTitle}
        </h3>

        <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 16px' }}>
          Vous avez utilisé la totalité de votre quota autorisé pour <strong>{featureName}</strong> ({maxLimit} / {maxLimit}) dans le cadre de votre formule <strong>{tierTitle}</strong>.
        </p>

        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '20px',
          textAlign: 'left',
          fontSize: '0.85rem',
          color: '#94a3b8'
        }}>
          <div style={{ color: '#2dd4bf', fontWeight: 700, marginBottom: '4px' }}>⚡ Surclassez votre compte :</div>
          {isDecouverte ? (
            <div>Passer à l'offre <strong>PRO</strong> (5/mois) ou <strong>ULTRA</strong> (Illimité sans filigrane) pour débloquer toutes les fonctionnalités.</div>
          ) : (
            <div>Passer à l'offre <strong>ULTRA Enseignant</strong> pour bénéficier d'un accès illimité et de téléchargements PDF HD propres sans filigrane.</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {onUpgradeClick && (
            <button
              onClick={() => {
                onClose();
                onUpgradeClick();
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0d9488, #0284c7)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)'
              }}
            >
              🚀 Découvrir les Offres PRO & ULTRA
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
