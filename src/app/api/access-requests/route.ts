import { NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/utils/firebase-admin';
import nodemailer from 'nodemailer';
import { loadEnvLocal } from '@/utils/env';

// Cache simple en mémoire pour limiter le spam (un e-mail toutes les 60s)
const recentRequests = new Map<string, number>();

export async function POST(req: Request) {
  loadEnvLocal();
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      institution,
      profession,
      city,
      country,
      email,
      phone
    } = body;

    // Validations
    const errors: string[] = [];

    if (!firstName?.trim()) errors.push("Le prénom est requis.");
    if (!lastName?.trim()) errors.push("Le nom est requis.");
    if (!email?.trim()) errors.push("L'adresse e-mail est requise.");
    if (!institution?.trim()) errors.push("L'institution est requise.");
    if (!profession?.trim()) errors.push("La profession est requise.");
    if (!city?.trim()) errors.push("La ville est requise.");
    if (!country?.trim()) errors.push("Le pays est requis.");

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: "Format d'adresse e-mail invalide." }, { status: 400 });
    }

    // Rate limiting : 1 demande toutes les 60s par email
    const now = Date.now();
    const lastRequest = recentRequests.get(cleanEmail);
    if (lastRequest && now - lastRequest < 60 * 1000) {
      return NextResponse.json(
        { error: "Une demande a déjà été soumise récemment pour cet e-mail. Veuillez patienter une minute." },
        { status: 429 }
      );
    }
    recentRequests.set(cleanEmail, now);

    // 1. Vérifier si un compte existe déjà dans Firebase Auth
    try {
      await adminAuth.getUserByEmail(cleanEmail);
      return NextResponse.json(
        { error: "Un compte avec cette adresse e-mail existe déjà sur la plateforme. Si vous avez oublié votre mot de passe, utilisez l'option de réinitialisation." },
        { status: 400 }
      );
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        console.error("❌ Erreur Firebase Auth lookup:", authErr.code, authErr.message);
        return NextResponse.json(
          { error: "Impossible de vérifier l'existence du compte. Veuillez réessayer dans quelques instants." },
          { status: 503 }
        );
      }
    }

    // 2. Vérifier s'il y a déjà une demande en attente
    const docId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const requestDocRef = adminDb.collection('access_requests').doc(docId);
    const requestDoc = await requestDocRef.get();

    if (requestDoc.exists) {
      const existingData = requestDoc.data();
      if (existingData?.status === 'pending') {
        return NextResponse.json(
          { error: "Une demande d'accès est déjà en attente de traitement pour cet e-mail. Vous serez contacté(e) prochainement." },
          { status: 400 }
        );
      } else if (existingData?.status === 'rejected') {
        // Permettre une nouvelle demande après rejet
      } else {
        return NextResponse.json(
          { error: "Une demande a déjà été traitée pour cet e-mail." },
          { status: 400 }
        );
      }
    }

    // 3. Insérer la demande dans Firestore
    const requestData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      institution: institution.trim(),
      profession: profession.trim(),
      city: city.trim(),
      country: country.trim(),
      email: cleanEmail,
      phone: phone?.trim() || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentReceivedAt: null,
      paymentReceivedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: ''
    };

    await requestDocRef.set(requestData, { merge: true });

    // 4. Envoyer le courrier de confirmation au demandeur
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: smtpUser, pass: smtpPass }
        });

        await transporter.sendMail({
          from: `"Plateforme Methodo Clinique" <${smtpUser}>`,
          to: cleanEmail,
          subject: "Votre demande d'accès - Plateforme Methodo Clinique",
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fafbfc;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; background: linear-gradient(135deg, #2563EB, #1d4ed8); border-radius: 14px; margin-bottom: 12px;">
                  <span style="color: white; font-size: 24px;">⚕</span>
                </div>
                <h1 style="color: #1e293b; margin: 0; font-size: 1.4rem; font-weight: 600;">Plateforme Methodo Clinique</h1>
                <p style="color: #64748b; margin: 4px 0 0; font-size: 0.85rem;">Méthodologie de Recherche Clinique</p>
              </div>

              <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #0f766e; font-weight: 600; font-size: 0.9rem;">Votre demande d'accès a bien été enregistrée</p>
              </div>

              <p style="color: #334155; font-size: 0.92rem; line-height: 1.6;">Nous avons bien reçu votre demande d'inscription à la plateforme Methodo-Clinique. Voici les informations que vous avez fournies :</p>

              <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.88rem;">
                <tr style="background: #f8fafc;">
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 38%;">Prénom & Nom</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #1e293b;">${firstName.trim()} ${lastName.trim()}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Institution</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #1e293b;">${institution.trim()}</td>
                </tr>
                <tr style="background: #f8fafc;">
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Profession</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #1e293b;">${profession.trim()}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Ville / Pays</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #1e293b;">${city.trim()}, ${country.trim()}</td>
                </tr>
                <tr style="background: #f8fafc;">
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">E-mail</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #1e293b;">${cleanEmail}</td>
                </tr>
                ${phone?.trim() ? `
                <tr>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Téléphone</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #1e293b;">${phone.trim()}</td>
                </tr>` : ''}
              </table>

              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                <p style="margin: 0; color: #1e40af; font-size: 0.88rem; line-height: 1.6;">Le contenu de la plateforme et son fonctionnement, ainsi que les modalités d'abonnement et de paiement vous seront précisés dans le second mail qui suit.</p>
              </div>

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
              <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center;">Cet e-mail a été envoyé automatiquement suite à votre demande d'inscription sur la Plateforme Methodo Clinique.</p>
            </div>
          `
        });
      } catch (mailErr) {
        console.error("Impossible d'envoyer le courrier de confirmation au demandeur:", mailErr);
      }
    }

    // 5. Notification admin
    const adminNotificationEmail = process.env.NEXT_PUBLIC_ADMIN_NOTIFICATION_EMAIL;
    if (adminNotificationEmail && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: smtpUser, pass: smtpPass }
        });

        await transporter.sendMail({
          from: `"Plateforme Methodo Clinique" <${smtpUser}>`,
          to: adminNotificationEmail,
          subject: `Nouvelle demande d'accès - ${firstName.trim()} ${lastName.trim()} (${profession.trim()})`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e40af; margin-top: 0;">Nouvelle demande d'inscription</h2>
              <p>Un utilisateur a demandé l'accès à la Plateforme Methodo Clinique. Le courrier de confirmation lui a été envoyé automatiquement.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 0.9rem;">
                <strong>Prénom :</strong> ${firstName.trim()}<br/>
                <strong>Nom :</strong> ${lastName.trim()}<br/>
                <strong>Institution :</strong> ${institution.trim()}<br/>
                <strong>Profession :</strong> ${profession.trim()}<br/>
                <strong>Ville / Pays :</strong> ${city.trim()}, ${country.trim()}<br/>
                <strong>E-mail :</strong> ${cleanEmail}<br/>
                ${phone?.trim() ? `<strong>Téléphone :</strong> ${phone.trim()}<br/>` : ''}
              </div>
              <p>En attente de traitement. Rendez-vous dans l'Espace Superviseur pour gérer cette demande.</p>
            </div>
          `
        });
      } catch (mailErr) {
        console.error("Impossible d'envoyer la notification admin:", mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Votre demande d'accès a été enregistrée. Un courrier de confirmation vous a été envoyé par e-mail."
    });
  } catch (error: any) {
    console.error("Erreur lors de la soumission de la demande d'accès:", error);
    return NextResponse.json({ error: error?.message || "Une erreur interne est survenue. Veuillez réessayer." }, { status: 500 });
  }
}