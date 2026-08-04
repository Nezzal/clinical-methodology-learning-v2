export type UserType = 'student' | 'resident' | 'doctorate' | 'teacher' | 'institution';

export type SubscriptionTier = 'découverte' | 'pro' | 'expert' | 'ultra' | 'institution';

export type SubscriptionDuration = '1m' | '3m' | '6m' | '12m';

export interface QuotaUsage {
  questionsToday: number;
  lastQuestionDate: string; // Format 'YYYY-MM-DD'
  protocolsThisMonth: number;
  strobeThisMonth: number;
  synthesesThisMonth: number;
  reportsThisMonth: number;
  lastResetMonth: string; // Format 'YYYY-MM'
}

export interface UserSubscription {
  tier: SubscriptionTier;
  status: 'active' | 'trialing' | 'expired' | 'pending_payment';
  startDate: string; // ISO String
  validUntil: string; // ISO String
  durationMonths?: number;
  bonusDaysAdded?: number; // 7j pour Pro, 14j pour Ultra
  quotaStudents?: number; // Capacité d'étudiants d'encadrement (par défaut 1 pour Ultra)
  paymentVerified: boolean;
  paymentReceiptRef?: string;
  quotas: QuotaUsage;
}

export interface PlanLimits {
  dailyQuestions: number; // -1 pour illimité
  monthlyProtocols: number; // -1 pour illimité
  monthlyStrobe: number; // -1 pour illimité
  monthlySyntheses: number; // -1 pour illimité
  monthlyReports: number; // -1 pour illimité
  allowWatermarkFreePdf: boolean;
  allowNsnCalculator: boolean;
  allowSupervisionSpace: boolean;
  allowInternalMessaging: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  découverte: {
    dailyQuestions: 5,
    monthlyProtocols: 1,
    monthlyStrobe: 1,
    monthlySyntheses: 1,
    monthlyReports: 1,
    allowWatermarkFreePdf: false,
    allowNsnCalculator: true, // calcul de démo
    allowSupervisionSpace: false,
    allowInternalMessaging: false,
  },
  pro: {
    dailyQuestions: 100,
    monthlyProtocols: 5,
    monthlyStrobe: 5,
    monthlySyntheses: 20,
    monthlyReports: 5,
    allowWatermarkFreePdf: true,
    allowNsnCalculator: true, // ILLIMITÉ
    allowSupervisionSpace: false,
    allowInternalMessaging: false,
  },
  expert: {
    dailyQuestions: -1,
    monthlyProtocols: -1,
    monthlyStrobe: -1,
    monthlySyntheses: -1,
    monthlyReports: -1,
    allowWatermarkFreePdf: true,
    allowNsnCalculator: true,
    allowSupervisionSpace: false,
    allowInternalMessaging: false,
  },
  ultra: {
    dailyQuestions: -1,
    monthlyProtocols: -1,
    monthlyStrobe: -1,
    monthlySyntheses: -1,
    monthlyReports: -1,
    allowWatermarkFreePdf: true,
    allowNsnCalculator: true,
    allowSupervisionSpace: true,
    allowInternalMessaging: true,
  },
  institution: {
    dailyQuestions: -1,
    monthlyProtocols: -1,
    monthlyStrobe: -1,
    monthlySyntheses: -1,
    monthlyReports: -1,
    allowWatermarkFreePdf: true,
    allowNsnCalculator: true,
    allowSupervisionSpace: true,
    allowInternalMessaging: true,
  },
};
