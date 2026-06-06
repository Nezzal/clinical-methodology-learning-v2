import fs from 'fs';
import path from 'path';

let envLoaded = false;

/**
 * Loads environment variables from `.env.local` into `process.env` at runtime.
 * This is particularly useful in Next.js standalone mode (production builds) 
 * where Next.js does not load `.env` files automatically.
 */
export function loadEnvLocal() {
  if (envLoaded) return;
  if (typeof window !== 'undefined') return; // Server-side only

  try {
    // Search in current working directory (project root)
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            // In Next.js, we only set it if not already defined to preserve actual environment overrides
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log('✅ [Env] Variables d\'environnement de .env.local chargées avec succès.');
    } else {
      console.log('⚠️ [Env] Aucun fichier .env.local trouvé à ' + envPath);
    }
  } catch (err: any) {
    console.warn('⚠️ [Env] Impossible de charger .env.local dynamiquement:', err.message || err);
  }

  envLoaded = true;
}
