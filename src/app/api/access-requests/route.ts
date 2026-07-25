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
      phone,
      requestedRole,
      requestedTier = 'découverte'
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
    if (!phone?.trim()) errors.push("Le téléphone est requis.");

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

    const cleanRole = requestedRole === 'teacher' ? 'teacher' : 'student';
    const cleanTier = (['découverte', 'pro', 'ultra', 'institution'].includes(requestedTier)) ? requestedTier : 'découverte';

    // 3. Insérer la demande dans Firestore
    const isFreeTest = cleanTier === 'découverte';

    const requestData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      institution: institution.trim(),
      profession: profession.trim(),
      city: city.trim(),
      country: country.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      requestedRole: cleanRole,
      requestedTier: cleanTier,
      status: isFreeTest ? 'approved' : 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedAt: isFreeTest ? admin.firestore.FieldValue.serverTimestamp() : null,
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

        const isB2bOrUltra = cleanTier === 'ultra' || cleanTier === 'institution';
        const isDecouverte = cleanTier === 'découverte';

        // Calcul exact de la date et heure d'expiration (72 heures = 3 jours)
        const now = new Date();
        const expiryDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const formattedNow = now.toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const formattedNowTime = now.toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit'
        });

        const formattedExpiryDate = expiryDate.toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const formattedExpiryTime = expiryDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit'
        });

        await transporter.sendMail({
          from: `"Plateforme Methodo&Clinique" <${smtpUser}>`,
          to: cleanEmail,
          subject: isDecouverte 
            ? "Confirmation de votre demande d'accès Test Découverte (3j) - Methodo&Clinique"
            : isB2bOrUltra 
              ? `Réception de votre demande (${cleanTier.toUpperCase()}) - Methodo&Clinique`
              : "Confirmation de votre demande d'accès PRO - Methodo&Clinique",
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fafbfc;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; background: linear-gradient(135deg, #0d9488, #0284c7); border-radius: 14px; margin-bottom: 12px;">
                  <span style="color: white; font-size: 24px;">⚕</span>
                </div>
                <h1 style="color: #1e293b; margin: 0; font-size: 1.4rem; font-weight: 600;">Plateforme Methodo&Clinique</h1>
                <p style="color: #64748b; margin: 4px 0 0; font-size: 0.85rem;">Méthodologie de Recherche Clinique</p>
              </div>

              <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #0f766e; font-weight: 600; font-size: 0.9rem;">
                  Votre demande d'accès (${cleanTier.toUpperCase()}) a bien été enregistrée
                </p>
              </div>

              <p style="color: #334155; font-size: 0.92rem; line-height: 1.6;">Bonjour <strong>${firstName.trim()} ${lastName.trim()}</strong>,</p>

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
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Formule Demandée</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0d9488; font-weight: bold;">Formule ${cleanTier.toUpperCase()}</td>
                </tr>
              </table>

              ${isDecouverte ? `
              <div style="background: #f0fdfa; border: 1.5px solid #0d9488; border-radius: 10px; padding: 18px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0f766e; font-size: 1.05rem;">
                  🟢 Conditions de l'Offre Test Découverte (3 Jours)
                </h3>
                
                <p style="margin: 0 0 12px 0; color: #334155; font-size: 0.9rem; line-height: 1.5;">
                  Votre demande d'accès test gratuit de <strong>3 jours (72 heures)</strong> est enregistrée. Vos identifiants vous permettent de découvrir gratuitement les fonctionnalités majeures de la plateforme.
                </p>

                <!-- Encadré d'expiration -->
                <div style="background: #ffffff; border: 2px solid #0d9488; border-radius: 8px; padding: 14px; margin-bottom: 14px; text-align: center;">
                  <div style="font-size: 0.78rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Période de Validité du Test</div>
                  <div style="font-size: 0.88rem; color: #334155; margin: 4px 0;">
                    Demande enregistrée le : <strong>${formattedNow} à ${formattedNowTime}</strong>
                  </div>
                  <div style="font-size: 1.05rem; color: #0f766e; font-weight: 800; margin-top: 6px; background: #e6fffa; padding: 8px; border-radius: 6px; border: 1px dashed #0d9488;">
                    ⏰ Date & Heure Expiration : ${formattedExpiryDate} à ${formattedExpiryTime}
                  </div>
                  <div style="font-size: 0.76rem; color: #64748b; margin-top: 4px;">(Accès automatiquement limité après cette échéance)</div>
                </div>

                <div style="font-size: 0.88rem; color: #1e293b; font-weight: 700; margin-bottom: 6px;">Fonctionnalités incluses durant vos 3 jours d'essai :</div>
                <ul style="margin: 0 0 14px 0; padding-left: 20px; color: #475569; font-size: 0.86rem; line-height: 1.7;">
                  <li>5 questions / jour avec l'Assistant IA en Méthodologie</li>
                  <li>1 protocole de recherche clinique (export avec filigrane)</li>
                  <li>1 article STROBE (export avec filigrane)</li>
                  <li>1 synthèse bibliographique PubMed</li>
                  <li>Calculateur NSN (Version Démo)</li>
                </ul>

                <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 14px 0;" />

                <p style="margin: 0 0 6px 0; color: #0f766e; font-size: 0.85rem; font-weight: 600;">
                  📲 Règlement par BaridiMob
                </p>
                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 0.82rem; line-height: 1.5;">
                  Pour passer à un accès complet illimité (Formule PRO / ULTRA), lever les filigranes et bénéficier de vos jours bonus (+7j Pro / +14j Ultra), vous pouvez effectuer votre virement par BaridiMob :
                </p>
                <div style="background: #ffffff; border: 1px dashed #0d9488; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 0.88rem; color: #0f766e;">
                  <strong>BaridiMob (RIP) :</strong> 00799999000041210947<br />
                  <strong>Titulaire :</strong> Professeur Nezzal Abdelmalek
                </div>
              </div>
              ` : isB2bOrUltra ? `
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #1e40af; font-size: 0.9rem; line-height: 1.6;">
                  Un e-mail de confirmation vous est envoyé pour vous confirmer la bonne réception de votre demande. Un administrateur prendra directement contact avec vous par e-mail afin d'étudier vos besoins et vous transmettre les modalités d'accès sur-mesure pour la <strong>Formule ${cleanTier.toUpperCase()}</strong>.
                </p>
              </div>
              ` : `
              <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #0f766e; font-size: 0.9rem; line-height: 1.6;">
                  Merci pour votre confiance. Pour valider votre abonnement définitif et bénéficier des <strong>+7 jours bonus offerts sur BaridiMob</strong>, voici les coordonnées BaridiMob :
                </p>
                <div style="background: #ffffff; border: 1px dashed #0d9488; padding: 12px 14px; border-radius: 6px; font-family: monospace; font-size: 0.92rem; color: #0f766e;">
                  <strong>BaridiMob (RIP) :</strong> 00799999000041210947<br />
                  <strong>Titulaire :</strong> Professeur Nezzal Abdelmalek
                </div>
              </div>
              `}

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
              <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center;">Message automatique — Ne pas répondre directement.</p>
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
          from: `"Plateforme Methodo&Clinique" <${smtpUser}>`,
          to: adminNotificationEmail,
          subject: `Nouvelle demande d'accès [${cleanRole === 'teacher' ? 'Enseignant' : 'Étudiant'}] - ${firstName.trim()} ${lastName.trim()}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e40af; margin-top: 0;">Nouvelle demande d'inscription [${cleanRole === 'teacher' ? 'Enseignant' : 'Étudiant'}]</h2>
              <p>Un utilisateur a demandé l'accès à la Plateforme Methodo&Clinique. Le courrier de confirmation lui a été envoyé automatiquement.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 0.9rem;">
                <strong>Type d'accès demandé :</strong> ${cleanRole === 'teacher' ? '👨‍🏫 Enseignant / Superviseur' : '🎓 Étudiant'}<br/>
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