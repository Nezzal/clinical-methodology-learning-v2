'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { saveUserSession, UserSession, formatSessionDuration } from '@/utils/firestore';

export default function SessionTracker() {
  const { user, profile, loading } = useAuth();
  const sessionRef = useRef<UserSession | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimestampRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Attendre que la vérification Auth Firebase soit terminée
    if (loading) return;

    // Détection de la plateforme
    let platform: 'web' | 'desktop_mac' | 'desktop_win' | 'desktop_linux' = 'web';
    const ua = navigator.userAgent.toLowerCase();
    const isElectron = !!(window as any).electron || ua.includes('electron');

    if (isElectron) {
      if (ua.includes('mac') || navigator.platform.toLowerCase().includes('mac')) {
        platform = 'desktop_mac';
      } else if (ua.includes('win') || navigator.platform.toLowerCase().includes('win')) {
        platform = 'desktop_win';
      } else if (ua.includes('linux') || navigator.platform.toLowerCase().includes('linux')) {
        platform = 'desktop_linux';
      } else {
        platform = 'desktop_mac';
      }
    }

    if (!sessionRef.current) {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      startTimestampRef.current = Date.now();
      const nowIso = new Date(startTimestampRef.current).toISOString();

      sessionRef.current = {
        id: sessionId,
        uid: user?.uid || 'guest',
        userName: profile?.displayName || user?.displayName || (user ? user.email || 'Utilisateur' : 'Utilisateur Non Connecté'),
        userEmail: profile?.email || user?.email || 'non_connecte@app.local',
        role: profile?.role || 'user',
        platform,
        startTime: nowIso,
        lastActive: nowIso,
        durationSeconds: 0,
        durationFormatted: '0s'
      };
      saveUserSession(sessionRef.current);
    } else if (user) {
      // Mettre à jour l'identité sur la session existante sans doublon
      sessionRef.current.uid = user.uid;
      sessionRef.current.userName = profile?.displayName || user.displayName || user.email || sessionRef.current.userName;
      sessionRef.current.userEmail = profile?.email || user.email || sessionRef.current.userEmail;
      sessionRef.current.role = profile?.role || sessionRef.current.role;
      saveUserSession(sessionRef.current);
    }

    const updateSessionState = () => {
      if (!sessionRef.current) return;
      const now = Date.now();
      const elapsedSeconds = Math.max(0, Math.round((now - startTimestampRef.current) / 1000));
      const nowIsoStr = new Date(now).toISOString();

      sessionRef.current.lastActive = nowIsoStr;
      sessionRef.current.endTime = nowIsoStr;
      sessionRef.current.durationSeconds = elapsedSeconds;
      sessionRef.current.durationFormatted = formatSessionDuration(elapsedSeconds);

      if (user) {
        sessionRef.current.uid = user.uid;
        sessionRef.current.userName = profile?.displayName || user.displayName || user.email || sessionRef.current.userName;
        sessionRef.current.userEmail = profile?.email || user.email || sessionRef.current.userEmail;
        sessionRef.current.role = profile?.role || sessionRef.current.role;
      }

      saveUserSession(sessionRef.current);
    };

    if (!timerRef.current) {
      timerRef.current = setInterval(updateSessionState, 30000);
    }

    const handleExit = () => {
      updateSessionState();
    };

    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);

    return () => {
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
      updateSessionState();
    };
  }, [user, profile, loading]);

  return null;
}
