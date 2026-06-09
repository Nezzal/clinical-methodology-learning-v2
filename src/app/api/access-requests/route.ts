import { NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/utils/firebase-admin';
import nodemailer from 'nodemailer';
import { loadEnvLocal } from '@/utils/env';

// Cache simple en mémoire pour limiter le spam (un e-mail toutes les 60s)
const recentRequests = new Map<string, number>();

export async function POST(req: Request) {
  loadEnvLocal();
  try {
    const { name, email } = await req.json();

    if (!name || !name.trim() || !email || !email.trim()) {
      return NextResponse.json({ error: "Le nom et l'adresse e-mail sont requis." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // Validation du format de l'e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: "Format d'adresse e-mail invalide." }, { status: 400 });
    }

    // Rate Limiting anti-abus : 1 requête toutes les 60 secondes par e-mail
    const now = Date.now();
    const lastRequest = recentRequests.get(cleanEmail);
    if (lastRequest && now - lastRequest < 60 * 1000) {
      return NextResponse.json({ error: "Une demande a déjà été soumise récemment pour cet e-mail. Veuillez patienter une minute." }, { status: 429 });
    }
    recentRequests.set(cleanEmail, now);

    // 1. Vérifier si un compte avec cet e-mail existe déjà dans Firebase Authentication
    try {
      await adminAuth.getUserByEmail(cleanEmail);
      return NextResponse.json({ error: "Un compte avec cette adresse e-mail existe déjà sur la plateforme." }, { status: 400 });
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        console.error("❌ Erreur Firebase Auth lookup:", authErr);
        return NextResponse.json({ error: "Erreur lors de la vérification du compte." }, { status: 500 });
      }
    }

    // 2. Vérifier s'il y a déjà une demande d'accès en attente pour cet e-mail dans Firestore
    const docId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const requestDocRef = adminDb.collection('access_requests').doc(docId);
    const requestDoc = await requestDocRef.get();
    
    if (requestDoc.exists) {
      return NextResponse.json({ error: "Une demande d'accès est déjà en attente de validation pour cet e-mail." }, { status: 400 });
    }

    // 3. Insérer le document de demande d'accès dans Firestore (SANS MOT DE PASSE EN CLAIR !)
    await requestDocRef.set({
      name: cleanName,
      email: cleanEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Envoyer un e-mail de notification à l'administrateur
    const adminNotificationEmail = process.env.NEXT_PUBLIC_ADMIN_NOTIFICATION_EMAIL;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (adminNotificationEmail && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        await transporter.sendMail({
          from: `"Plateforme RECIF" <${smtpUser}>`,
          to: adminNotificationEmail,
          subject: "Nouvelle demande d'accès en attente - RECIF",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0d9488; margin-top: 0;">Nouvelle demande d'inscription</h2>
              <p>Un utilisateur a demandé l'accès à la plateforme RECIF :</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <strong>Nom complet :</strong> ${cleanName}<br/>
                <strong>Adresse e-mail :</strong> ${cleanEmail}
              </div>
              <p>Rendez-vous dans votre Espace Superviseur sur la plateforme pour valider ou rejeter cette demande.</p>
            </div>
          `
        });
      } catch (mailErr) {
        console.error("⚠️ Impossible d'envoyer l'e-mail de notification admin:", mailErr);
      }
    }

    return NextResponse.json({ success: true, message: "Votre demande d'accès a été enregistrée avec succès et est en attente de validation par votre superviseur." });
  } catch (error: any) {
    console.error("❌ Erreur lors de la soumission de la demande d'accès:", error);
    return NextResponse.json({ error: error?.message || "Une erreur interne est survenue." }, { status: 500 });
  }
}
