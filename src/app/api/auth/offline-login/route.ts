import { NextResponse } from 'next/server';
import { loadEnvLocal } from '@/utils/env';

export async function POST(req: Request) {
  loadEnvLocal();

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Vérifier si l'email est un compte officiel RECIF ou du Pr Nezzal
    const isOfficial = cleanEmail.endsWith('@recif.dz') || cleanEmail === 'nezzal.abdelmalek@gmail.com';
    if (!isOfficial) {
      return NextResponse.json({ error: "Non autorisé en mode hors-ligne. Seuls les comptes officiels RECIF sont autorisés." }, { status: 403 });
    }

    // Récupérer le mot de passe attendu depuis les variables d'environnement
    const expectedPassword = process.env.OFFLINE_ADMIN_PASSWORD || 'recifadmin2026';

    if (password !== expectedPassword) {
      return NextResponse.json({ error: "Mot de passe hors-ligne incorrect." }, { status: 401 });
    }

    // Déterminer le rôle et le nom d'affichage
    let role: 'admin' | 'teacher' = 'teacher';
    let displayName = 'Enseignant RECIF (Hors-ligne)';

    if (cleanEmail === 'admin@recif.dz' || cleanEmail === 'nezzal.abdelmalek@gmail.com') {
      role = 'admin';
      displayName = 'Superviseur Methodo-Clinique (Pr Nezzal Abdelmalek)';
    }

    console.log(`🔌 Connexion hors-ligne réussie pour : ${cleanEmail} (Rôle: ${role})`);

    return NextResponse.json({
      success: true,
      uid: 'offline_admin_uid',
      email: cleanEmail,
      displayName,
      role
    });
  } catch (error: any) {
    console.error("❌ Erreur de connexion hors-ligne:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
