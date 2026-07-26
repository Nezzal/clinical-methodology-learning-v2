import publicKeyJWK from './license-public-key.json';

export interface LicenseData {
  email: string;
  expiresAt: number;
  tier: 'pro' | 'expert' | 'ultra';
  generatedAt: number;
}

export interface LicenseVerifyResult {
  isValid: boolean;
  error?: string;
  data?: LicenseData;
}

// Récupère l'API de cryptographie standard dans tous les environnements (Client & Serveur)
const getSubtleCrypto = (): SubtleCrypto => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis as any).crypto.subtle) {
    return (globalThis as any).crypto.subtle;
  }
  try {
    const nodeCrypto = require('crypto');
    return nodeCrypto.webcrypto.subtle;
  } catch (e) {
    throw new Error("Web Crypto API non supportée dans cet environnement.");
  }
};

// Convertit une chaîne Base64 en ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Valide une clé de licence hors-ligne cryptographiquement
 */
export async function verifyLicense(licenseKey: string): Promise<LicenseVerifyResult> {
  if (!licenseKey?.trim()) {
    return { isValid: false, error: "Clé de licence vide ou absente." };
  }

  try {
    // 1. Décodage base64 du token enveloppe
    let decodedJson: string;
    try {
      decodedJson = typeof window !== 'undefined'
        ? window.atob(licenseKey.trim())
        : Buffer.from(licenseKey.trim(), 'base64').toString('utf8');
    } catch (e) {
      return { isValid: false, error: "Format du code de licence invalide (Base64 corrompu)." };
    }

    // 2. Parse de l'enveloppe
    let envelope: { data: string; sig: string };
    try {
      envelope = JSON.parse(decodedJson);
    } catch (e) {
      return { isValid: false, error: "Structure de la licence corrompue." };
    }

    const { data, sig } = envelope;
    if (!data || !sig) {
      return { isValid: false, error: "Clé de licence incomplète." };
    }

    // 3. Importer la clé publique (JWK)
    const subtle = getSubtleCrypto();
    const publicKey = await subtle.importKey(
      'jwk',
      publicKeyJWK,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['verify']
    );

    // 4. Préparer les buffers pour la vérification (nous vérifions la chaîne brute 'data')
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const sigBuffer = base64ToArrayBuffer(sig);

    // 5. Valider la signature cryptographique
    const isSignatureValid = await subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      publicKey,
      sigBuffer,
      dataBuffer
    );

    if (!isSignatureValid) {
      return { isValid: false, error: "Signature de licence invalide (Clé falsifiée)." };
    }

    // 6. Analyser le contenu de la licence maintenant que la signature est vérifiée
    let parsedData: LicenseData;
    try {
      parsedData = JSON.parse(data) as LicenseData;
    } catch (e) {
      return { isValid: false, error: "Contenu de licence illisible." };
    }

    // 7. Vérifier la date d'expiration
    const now = Date.now();
    if (parsedData.expiresAt < now) {
      const expiryDate = new Date(parsedData.expiresAt).toLocaleDateString('fr-FR');
      return { 
        isValid: false, 
        error: `Cette licence a expiré le ${expiryDate}.`,
        data: parsedData 
      };
    }

    // Licence valide !
    return {
      isValid: true,
      data: parsedData
    };

  } catch (error: any) {
    console.error("❌ Erreur de vérification de la licence :", error);
    return { isValid: false, error: "Erreur système lors de la vérification : " + (error.message || String(error)) };
  }
}
