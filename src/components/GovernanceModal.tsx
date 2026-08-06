'use client';

import React from 'react';
import styles from './ProfileModal.module.css';
import { APP_VERSION, COMPANY_NIF } from '@/utils/constants';

interface GovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GovernanceModal({ isOpen, onClose }: GovernanceModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>🏛️ Gouvernance Scientifique & Direction</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.profileCardMain}>
            <img 
              src="/pr_nezzal.png" 
              alt="Pr Nezzal Abdelmalek" 
              className={styles.avatarBig} 
            />
            <div className={styles.userInfoMain}>
              <h3>Pr Nezzal Abdelmalek</h3>
              <div className={styles.userEmail}>Fondateur & Superviseur Scientifique</div>
              <span className={styles.roleBadge}>Direction Académique & Éditoriale</span>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h5>Éditeur & Organisme</h5>
              <p>PedagogiAfrica</p>
            </div>
            <div className={styles.infoCard}>
              <h5>NIF Officiel</h5>
              <p>{COMPANY_NIF}</p>
            </div>
            <div className={styles.infoCard}>
              <h5>Cadre de Référence</h5>
              <p>Guide Méthodologique RECIF</p>
            </div>
            <div className={styles.infoCard}>
              <h5>Réglementation</h5>
              <p>Loi 18-11 Santé (Algérie)</p>
            </div>
            <div className={styles.infoCard} style={{ gridColumn: 'span 2' }}>
              <h5>Droits & Licence Pédagogique</h5>
              <p><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>CC BY-NC-SA 4.0 (Creative Commons)</a></p>
            </div>
          </div>

          <div className={styles.governanceBox}>
            <strong>📜 Mission Académique & Licence Creative Commons :</strong><br/>
            Cette plateforme e-learning interactive et intelligente vise à former les étudiants, résidents et enseignants-chercheurs aux exigences rigoureuses de la méthodologie de recherche clinique.<br/>
            Les contenus pédagogiques sont protégés sous la licence <strong>Creative Commons CC BY-NC-SA 4.0</strong> (Attribution - Pas d&apos;Utilisation Commerciale - Partage dans les Mêmes Conditions).<br/><br/>
            ✉️ Contact & Support Direction : <code>pedagogiafrica@gmail.com</code>
          </div>
        </div>
      </div>
    </div>
  );
}
