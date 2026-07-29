'use client';

import React, { useState, useEffect } from 'react';
import styles from './ProfileModal.module.css';
import { useAuth } from '@/context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/utils/firebase';
import { APP_VERSION, COMPANY_NIF } from '@/utils/constants';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, profile, role, guestMode } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
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
      setIsEditing(false);
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
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
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
          <h3 className={styles.title}>👤 Profil & Gouvernance Académique</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className={styles.body}>
          {saveSuccess && (
            <div className={styles.successAlert}>
              ✓ Vos informations de profil ont été mises à jour avec succès !
            </div>
          )}

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
            {!isEditing && (
              <button 
                type="button" 
                className={styles.editToggleBtn}
                onClick={() => setIsEditing(true)}
              >
                ✏️ Modifier
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className={styles.formGrid}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '0.95rem' }}>
                ✏️ Éditer mes Informations Personnelles
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
                <button type="button" className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
                  Annuler
                </button>
              </div>
            </form>
          ) : (
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
                <h5>Profession & Institution</h5>
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                  {professionInput} ({institutionInput})
                </p>
              </div>
              <div className={styles.infoCard}>
                <h5>Identifiant Fiscal (NIF)</h5>
                <p>{COMPANY_NIF}</p>
              </div>
            </div>
          )}

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
