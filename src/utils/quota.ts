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

export function getUserTier(profile: FirestoreUser | null | undefined): SubscriptionTier {
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
        watermark: true,
        watermarkText: 'FORMULE PRO — METHODO&CLINIQUE'
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
