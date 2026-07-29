'use client';

import React from 'react';
import styles from './ProfileModal.module.css';
import { useAuth } from '@/context/AuthContext';
import { APP_VERSION, COMPANY_NIF } from '@/utils/constants';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, profile, role, guestMode } = useAuth();

  if (!isOpen) return null;

  const displayName = profile?.displayName || user?.displayName || 'Pr Nezzal Abdelmalek';
  const email = user?.email || 'pedagogiafrica@gmail.com';
  const displayRole = role === 'admin' ? 'Superviseur Scientifique (Admin)' : (role === 'teacher' ? 'Enseignant Encadrant' : 'Résident / Chercheur');
  const tier = profile?.subscription?.tier ? profile.subscription.tier.toUpperCase() : 'PRODUCTION READY';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>👤 Profil & Gouvernance Académique</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.profileCardMain}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className={styles.avatarBig} />
            ) : (
              <div className={styles.avatarPlaceholderBig}>
                {displayName.substring(0, 1).toUpperCase()}
              </div>
            )}
            <div className={styles.userInfoMain}>
              <h3>{displayName}</h3>
              <div className={styles.userEmail}>{email}</div>
              <span className={styles.roleBadge}>{displayRole}</span>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h5>Formule d&apos;Abonnement</h5>
              <p>{tier}</p>
            </div>
            <div className={styles.infoCard}>
              <h5>Statut Système</h5>
              <p>{guestMode ? '🔑 Mode Exécutable' : '🟢 Connecté Cloud'}</p>
            </div>
            <div className={styles.infoCard}>
              <h5>Version Applicative</h5>
              <p>v{APP_VERSION}</p>
            </div>
            <div className={styles.infoCard}>
              <h5>Numéro d&apos;Identifiant (NIF)</h5>
              <p>{COMPANY_NIF}</p>
            </div>
          </div>

          <div className={styles.governanceBox}>
            <strong>🏛️ Gouvernance Scientifique & Éditoriale :</strong><br/>
            Fondateur & Superviseur : <strong>Pr NEZZAL Abdelmalek</strong><br/>
            Plateforme conforme aux recommandations du Manuel <strong>RECIF</strong> et à la <strong>Loi n° 18-11 relative à la santé (Algérie)</strong>.<br/>
            Support Technique : <code>pedagogiafrica@gmail.com</code>
          </div>
        </div>
      </div>
    </div>
  );
}
