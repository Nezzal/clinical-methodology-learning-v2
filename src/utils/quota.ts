import { FirestoreUser } from './firestore';

export type SubscriptionTier = 'découverte' | 'pro' | 'expert' | 'ultra' | 'institution';

export interface QuotaConfig {
  tier: SubscriptionTier;
  protocolsMax: number;
  articlesMax: number;
  biblioMax: number;
  reportsMax: number;
  tuteurDailyMax: number;
  watermark: boolean;
  watermarkText: string;
}

export function getUserTier(profile?: FirestoreUser | null, user?: any): SubscriptionTier {
  const emailLower = ((profile?.email || user?.email || '') as string).toLowerCase().trim();
  const uid = ((profile?.uid || user?.uid || '') as string).trim();
  const role = profile?.role;

  // Accorder l'accès ILLIMITÉ (ultra) à tous les administrateurs, enseignants, Pr Nezzal et sessions hors-ligne / licences
  const isUnlimitedUser = 
    role === 'admin' || 
    role === 'teacher' ||
    emailLower === 'nezzal.abdelmalek@gmail.com' ||
    emailLower === 'admin@recif.dz' ||
    emailLower.includes('nezzal') ||
    uid === 'offline_admin_uid' ||
    uid.startsWith('offline_license_uid_');

  if (isUnlimitedUser) {
    return 'ultra';
  }

  if (!profile || !profile.subscription || !profile.subscription.tier) {
    return 'découverte';
  }

  const t = profile.subscription.tier.toLowerCase().trim();
  if (t.includes('expert')) return 'expert';
  if (t.includes('pro')) return 'pro';
  if (t.includes('ultra')) return 'ultra';
  if (t.includes('institution')) return 'institution';
  return 'découverte';
}

export function getQuotaConfig(tier: SubscriptionTier): QuotaConfig {
  switch (tier) {
    case 'découverte':
      return {
        tier: 'découverte',
        protocolsMax: 1,
        articlesMax: 1,
        biblioMax: 1,
        reportsMax: 1,
        tuteurDailyMax: 5,
        watermark: true,
        watermarkText: 'OFFRE DÉCOUVERTE — METHODO&CLINIQUE'
      };
    case 'pro':
      return {
        tier: 'pro',
        protocolsMax: 5,
        articlesMax: 5,
        biblioMax: 20,
        reportsMax: 5,
        tuteurDailyMax: 100,
        watermark: false,
        watermarkText: ''
      };
    case 'expert':
    case 'ultra':
    case 'institution':
      return {
        tier,
        protocolsMax: Infinity,
        articlesMax: Infinity,
        biblioMax: Infinity,
        reportsMax: Infinity,
        tuteurDailyMax: Infinity,
        watermark: false,
        watermarkText: ''
      };
    default:
      return {
        tier: 'découverte',
        protocolsMax: 1,
        articlesMax: 1,
        biblioMax: 1,
        reportsMax: 1,
        tuteurDailyMax: 5,
        watermark: true,
        watermarkText: 'OFFRE DÉCOUVERTE — METHODO&CLINIQUE'
      };
  }
}
