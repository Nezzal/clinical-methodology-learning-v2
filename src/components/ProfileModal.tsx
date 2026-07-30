'use client';

import React, { useState, useEffect } from 'react';
import styles from './ProfileModal.module.css';
import { useAuth } from '@/context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/utils/firebase';
import { APP_VERSION } from '@/utils/constants';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, profile, role, guestMode } = useAuth();

  const [nameInput, setNameInput] = useState('');
  const [professionInput, setProfessionInput] = useState('');
  const [institutionInput, setInstitutionInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNameInput(profile?.displayName || user?.displayName || '');
      setProfessionInput(profile?.profession || 'Résident / Chercheur');
      setInstitutionInput(profile?.institution || 'Faculté de Médecine / CHU');
      setCityInput(profile?.city || 'Alger');
      setPhoneInput(profile?.phone || '');
      setSaveSuccess(false);
    }
  }, [isOpen, profile, user]);

  if (!isOpen) return null;

  const displayName = nameInput || profile?.displayName || user?.displayName || 'Utilisateur RECIF';
  const email = user?.email || 'Fichier de licence hors-ligne';
  const displayRole = role === 'admin' ? 'Superviseur Scientifique (Admin)' : (role === 'teacher' ? 'Enseignant Encadrant' : 'Résident / Chercheur');
  const tier = profile?.subscription?.tier ? profile.subscription.tier.toUpperCase() : 'DÉCOUVERTE';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Mettre à jour Firebase Auth
      if (auth && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: nameInput.trim() });
      }

      // 2. Mettre à jour Firestore
      if (db && user?.uid) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          displayName: nameInput.trim(),
          profession: professionInput.trim(),
          institution: institutionInput.trim(),
          city: cityInput.trim(),
          phone: phoneInput.trim(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // 3. Sauvegarder dans localStorage pour le mode offline
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_profile_name', nameInput.trim());
        const savedData = localStorage.getItem('recif_profile_data');
        const parsed = savedData ? JSON.parse(savedData) : {};
        localStorage.setItem('recif_profile_data', JSON.stringify({
          ...parsed,
          displayName: nameInput.trim(),
          profession: professionInput.trim(),
          institution: institutionInput.trim(),
          city: cityInput.trim(),
          phone: phoneInput.trim()
        }));
        
        window.dispatchEvent(new Event('progress_changed'));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error("❌ Erreur lors de la mise à jour du profil:", err);
      alert("Une erreur est survenue lors de la sauvegarde : " + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>👤 Mon Profil Utilisateur</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className={styles.body}>
          {saveSuccess && (
            <div className={styles.successAlert}>
              ✓ Vos informations de profil ont été enregistrées avec succès !
            </div>
          )}

          {/* En-tête Carte Utilisateur */}
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

          {/* Badges d'information Abonnement & Système */}
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h5>Formule d&apos;Abonnement</h5>
              <p>{tier}</p>
            </div>
            <div className={styles.infoCard}>
              <h5>Statut Système</h5>
              <p>{guestMode ? '🔑 Mode Exécutable' : '🟢 Connecté Cloud'}</p>
            </div>
            {(role === 'teacher' || role === 'admin' || tier.includes('ULTRA') || tier.includes('SUPERADMIN')) && (
              <div className={styles.infoCard} style={{ gridColumn: '1 / -1', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                <h5>🎓 Code d&apos;Affiliation Enseignant (Raccordement Étudiants)</h5>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <p style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: '0.95rem', margin: 0, fontWeight: 700 }}>
                    ENS-{(user?.uid || 'RECIF-2026').substring(0, 6).toUpperCase()}
                  </p>
                  <button 
                    type="button"
                    onClick={() => {
                      const code = `ENS-${(user?.uid || 'RECIF-2026').substring(0, 6).toUpperCase()}`;
                      navigator.clipboard.writeText(code);
                      alert(`Code d'affiliation Enseignant "${code}" copié !`);
                    }}
                    style={{
                      background: 'rgba(251, 191, 36, 0.2)',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                      color: '#fbbf24',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copier le Code
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Formulaire d'édition directe */}
          <form onSubmit={handleSaveProfile} className={styles.formGrid}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '0.95rem' }}>
              ✏️ Informations Personnelles & Institutionnelles
            </h4>

            <div className={styles.fieldGroup}>
              <label>Nom Complet / Titre Académique :</label>
              <input 
                type="text" 
                className={styles.inputField}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="ex: Dr Malik Popotin"
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>Profession / Rôle Médical :</label>
              <input 
                type="text" 
                className={styles.inputField}
                value={professionInput}
                onChange={(e) => setProfessionInput(e.target.value)}
                placeholder="ex: Résident en Médecine / Chercheur"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>Institution / Hôpital / Faculté :</label>
              <input 
                type="text" 
                className={styles.inputField}
                value={institutionInput}
                onChange={(e) => setInstitutionInput(e.target.value)}
                placeholder="ex: CHU Mustapha / Faculté de Médecine"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>Ville & Localisation :</label>
              <input 
                type="text" 
                className={styles.inputField}
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="ex: Alger, Algérie"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>Téléphone de contact :</label>
              <input 
                type="tel" 
                className={styles.inputField}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="ex: 0661000000"
              />
            </div>

            <div className={styles.actionButtons}>
              <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                {isSaving ? 'Enregistrement...' : '💾 Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
