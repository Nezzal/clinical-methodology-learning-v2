'use client';

import React, { useState } from 'react';
import { MethodoCRFTemplate, downloadCrfJson, generateMethodoCrfDeepLink } from '@/utils/crfExporter';

interface MethodoCrfExportModalProps {
  crfTemplate: MethodoCRFTemplate;
  onClose: () => void;
}

export function MethodoCrfExportModal({ crfTemplate, onClose }: MethodoCrfExportModalProps) {
  const getDefaultUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://methodo-e73q2kftf-maliks-projects-93427e83.vercel.app';
    }
    return 'http://localhost:5173';
  };

  const [methodoCrfUrl, setMethodoCrfUrl] = useState(getDefaultUrl());
  const [activeTab, setActiveTab] = useState<'link' | 'json' | 'qrcode'>('link');
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  const deepLinkUrl = generateMethodoCrfDeepLink(crfTemplate, methodoCrfUrl);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(deepLinkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenDirect = () => {
    window.open(deepLinkUrl, '_blank', 'noopener,noreferrer');
  };

  // Encoder l'URL du DeepLink dans le QR Code (si l'URL est sous la limite de 1800 caractères)
  const qrTargetString = deepLinkUrl.length <= 1800 ? deepLinkUrl : `${methodoCrfUrl}/?crf_code=${crfTemplate.code}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrTargetString)}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(7, 10, 19, 0.8)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        borderRadius: '16px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 25px rgba(5, 150, 105, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.25) 0%, rgba(15, 23, 42, 0.9) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.4)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                Partager vers MéthodoCRF
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                {crfTemplate.code} — {crfTemplate.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            fontSize: '1rem',
            cursor: 'pointer',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>✕</button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(15, 23, 42, 0.6)'
        }}>
          <button
            onClick={() => setActiveTab('link')}
            style={{
              flex: 1,
              padding: '0.85rem',
              border: 'none',
              borderBottom: activeTab === 'link' ? '2px solid #10b981' : '2px solid transparent',
              backgroundColor: activeTab === 'link' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              fontWeight: activeTab === 'link' ? 700 : 500,
              color: activeTab === 'link' ? '#34d399' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'all 0.2s ease'
            }}
          >
            🚀 Lien Direct
          </button>
          <button
            onClick={() => setActiveTab('json')}
            style={{
              flex: 1,
              padding: '0.85rem',
              border: 'none',
              borderBottom: activeTab === 'json' ? '2px solid #10b981' : '2px solid transparent',
              backgroundColor: activeTab === 'json' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              fontWeight: activeTab === 'json' ? 700 : 500,
              color: activeTab === 'json' ? '#34d399' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'all 0.2s ease'
            }}
          >
            📥 Fichier JSON
          </button>
          <button
            onClick={() => setActiveTab('qrcode')}
            style={{
              flex: 1,
              padding: '0.85rem',
              border: 'none',
              borderBottom: activeTab === 'qrcode' ? '2px solid #10b981' : '2px solid transparent',
              backgroundColor: activeTab === 'qrcode' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              fontWeight: activeTab === 'qrcode' ? 700 : 500,
              color: activeTab === 'qrcode' ? '#34d399' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'all 0.2s ease'
            }}
          >
            📱 QR Code
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.5rem', backgroundColor: '#0f172a' }}>
          {activeTab === 'link' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                Ouvrez directement l'application <strong>MéthodoCRF</strong> avec ce Cahier d'Observation (CRF) pré-chargé et prêt pour le recueil de données clinique.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: '#94a3b8' }}>
                  URL de l'application MéthodoCRF (locale ou distante) :
                </label>
                <input
                  type="text"
                  value={methodoCrfUrl}
                  onChange={(e) => setMethodoCrfUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    fontSize: '0.88rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                  placeholder="http://localhost:5173"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleOpenDirect}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#059669',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  <span>Ouvrir dans MéthodoCRF</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {copied ? '✓ Copié !' : '📋 Copier le lien'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', textAlign: 'left', lineHeight: '1.5' }}>
                Téléchargez le fichier JSON du CRF pour l'importer manuellement dans l'onglet Catalogue de MéthodoCRF ou pour l'archiver hors-ligne.
              </p>

              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                textAlign: 'left',
                fontSize: '0.82rem',
                color: '#e2e8f0',
                fontFamily: 'monospace'
              }}>
                <div style={{ marginBottom: '4px' }}><strong style={{ color: '#34d399' }}>Code étude:</strong> {crfTemplate.code}</div>
                <div style={{ marginBottom: '4px' }}><strong style={{ color: '#34d399' }}>Titre:</strong> {crfTemplate.title}</div>
                <div style={{ marginBottom: '4px' }}><strong style={{ color: '#34d399' }}>Sections:</strong> {crfTemplate.sections.length} fiches rédigées</div>
                <div><strong style={{ color: '#34d399' }}>Format:</strong> Schema JSON MéthodoCRF v1.0</div>
              </div>

              <button
                type="button"
                onClick={() => downloadCrfJson(crfTemplate)}
                style={{
                  padding: '0.85rem',
                  backgroundColor: '#059669',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Télécharger le Fichier JSON (.json)</span>
              </button>
            </div>
          )}

          {activeTab === 'qrcode' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', textAlign: 'center', lineHeight: '1.5' }}>
                Scannez ce QR Code pour ouvrir instantanément l'application MéthodoCRF avec le schéma d'étude pré-chargé.
              </p>

              <div style={{
                padding: '1rem',
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                minWidth: '240px',
                minHeight: '240px'
              }}>
                {!qrError ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrCodeImageUrl}
                    alt="QR Code CRF"
                    width="220"
                    height="220"
                    style={{ display: 'block', borderRadius: '4px' }}
                    onError={() => setQrError(true)}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#0f172a' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📱</div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.25rem' }}>Lien Deep-Link prêt</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>Utilisez le lien direct pour le transfert.</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>
                  ✓ Encodage prêt pour MéthodoCRF ({crfTemplate.code})
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copied ? '✓ Lien copié !' : '📋 Copier le lien du QR Code'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 600,
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

