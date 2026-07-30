import { loadEnvLocal } from '@/utils/env';

export interface PlanPriceInfo {
  amount: string; // e.g. "20.00"
  currency: string; // "EUR"
  description: string;
}

/**
 * Calculates server-authoritative price for subscription tiers and durations.
 */
export function calculatePlanPrice(
  tier: 'pro' | 'expert' | 'ultra',
  duration: '1m' | '3m' | '6m' | '12m',
  residence: 'africa' | 'western'
): PlanPriceInfo {
  const currency = 'EUR';
  let price = 0;
  const labelDuration = duration === '1m' ? '1 Mois' : duration === '3m' ? '3 Mois' : duration === '6m' ? '6 Mois' : '12 Mois (Annuel)';

  if (residence === 'africa') {
    if (tier === 'pro') {
      price = duration === '1m' ? 20 : duration === '3m' ? 45 : duration === '6m' ? 72 : 120;
    } else if (tier === 'expert') {
      price = duration === '1m' ? 34 : duration === '3m' ? 90 : duration === '6m' ? 156 : 240;
    } else if (tier === 'ultra') {
      price = duration === '1m' ? 37 : duration === '3m' ? 105 : duration === '6m' ? 198 : 324;
    }
  } else {
    // residence === 'western'
    if (tier === 'pro') {
      price = duration === '1m' ? 59 : duration === '3m' ? 147 : duration === '6m' ? 234 : 348;
    } else if (tier === 'expert') {
      price = duration === '1m' ? 69 : duration === '3m' ? 177 : duration === '6m' ? 294 : 468;
    } else if (tier === 'ultra') {
      price = duration === '1m' ? 104 : duration === '3m' ? 282 : duration === '6m' ? 504 : 828;
    }
  }

  if (!price) {
    throw new Error(`Tarif introuvable pour la formule ${tier}, durée ${duration}, zone ${residence}`);
  }

  const description = `Abonnement Methodo&Clinique ${tier.toUpperCase()} (${labelDuration}) - Zone ${residence === 'africa' ? 'Afrique' : 'Europe & Occident'}`;

  return {
    amount: price.toFixed(2),
    currency,
    description
  };
}

/**
 * Checks if real PayPal API credentials are set up.
 */
export function isPayPalConfigured(): boolean {
  loadEnvLocal();
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  return Boolean(
    clientId &&
    clientId.length > 25 &&
    clientSecret &&
    clientSecret !== 'placeholder_secret_key'
  );
}

/**
 * Fetches OAuth2 Access Token from PayPal REST API.
 */
export async function getPayPalAccessToken(): Promise<string> {
  loadEnvLocal();
  const clientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  const mode = (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase();

  if (!clientId || !clientSecret || clientSecret === 'placeholder_secret_key') {
    throw new Error("Clés API PayPal manquantes (NEXT_PUBLIC_PAYPAL_CLIENT_ID ou PAYPAL_CLIENT_SECRET).");
  }

  const baseUrl = mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ Erreur de connexion API PayPal (OAuth2):", errText);
    try {
      const errJson = JSON.parse(errText);
      const detail = errJson.error_description || errJson.error || errText;
      throw new Error(`Authentification PayPal refusée : ${detail}`);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message.startsWith('Authentification PayPal')) {
        throw parseErr;
      }
      throw new Error(`Impossible de se connecter aux services PayPal (Statut ${response.status}).`);
    }
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Returns the base API URL depending on mode.
 */
export function getPayPalBaseUrl(): string {
  loadEnvLocal();
  const mode = (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase();
  return mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
}
