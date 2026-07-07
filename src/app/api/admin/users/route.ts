import { NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/utils/firebase-admin';
import { loadEnvLocal } from '@/utils/env';

// Générateur de mot de passe temporaire fort
function generateTempPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(req: Request) {
  loadEnvLocal();
  
  // 1. Vérifier l'autorisation (Bearer Token dans les en-têtes)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: "Non autorisé (Token manquant)" }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
    // Vérifier les droits (doit être admin ou teacher)
    if (decodedToken.role !== 'admin' && decodedToken.role !== 'teacher') {
      return NextResponse.json({ error: "Interdit (Droits insuffisants)" }, { status: 403 });
    }
  } catch (err: any) {
    console.error("❌ Échec de vérification du jeton admin/enseignant:", err.message);
    return NextResponse.json({ error: "Session invalide ou expirée" }, { status: 401 });
  }

  try {
    const { name, email } = await req.json();

    if (!name || !name.trim() || !email || !email.trim()) {
      return NextResponse.json({ error: "Le nom et l'adresse e-mail sont requis." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // 2. Vérifier si l'utilisateur existe déjà dans Firebase Authentication
    try {
      await adminAuth.getUserByEmail(cleanEmail);
      return NextResponse.json({ error: "Un compte avec cette adresse e-mail existe déjà." }, { status: 400 });
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
    }

    // 3. Générer le mot de passe temporaire
    const tempPassword = generateTempPassword();

    // 4. Créer l'utilisateur dans Firebase Auth via l'Admin SDK
    const userRecord = await adminAuth.createUser({
      email: cleanEmail,
      password: tempPassword,
      displayName: cleanName,
      emailVerified: true
    });

    // 5. Attribuer le Custom Claim "student"
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'student' });

    // 6. Créer le profil initial dans Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: cleanEmail,
      displayName: cleanName,
      photoURL: null,
      level: 'Débutant',
      role: 'student',
      stats: {
        questionsAsked: 0,
        protocolsGenerated: 0,
        quizCorrect: 0,
        quizTotal: 0,
        flashcardsMastered: [],
        quizHistory: []
      },
      requirePasswordChange: true,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Compte étudiant créé avec succès : ${cleanEmail} (UID: ${userRecord.uid})`);

    // Retourner les informations nécessaires pour l'affichage ou l'envoi de mail
    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      name: cleanName,
      email: cleanEmail,
      tempPassword
    });
  } catch (error: any) {
    console.error("❌ Erreur lors de la création du compte étudiant :", error);
    return NextResponse.json({ error: error?.message || "Une erreur interne est survenue." }, { status: 500 });
  }
}
