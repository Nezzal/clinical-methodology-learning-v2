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

    // 1. Vérifier si un compte existe déjà sur la plateforme (Auth ou Firestore)
    if (adminAuth) {
      try {
        await adminAuth.getUserByEmail(cleanEmail);
        return NextResponse.json(
          { error: "Cet e-mail a déjà bénéficié de l'offre d'essai Découverte (3 jours). Connectez-vous à votre compte ou découvrez nos formules d'abonnement PRO & EXPERT." },
          { status: 400 }
        );
      } catch (authErr: unknown) {
        const authErrorObj = authErr as { code?: string; message?: string };
        if (authErrorObj.code !== 'auth/user-not-found') {
          console.warn("⚠️ Firebase Auth lookup warning (non-bloquant):", authErrorObj?.code || authErrorObj?.message || authErr);
        }
      }
    }

    if (adminDb) {
      try {
        const existingUserSnap = await adminDb.collection('users').where('email', '==', cleanEmail).limit(1).get();
        if (!existingUserSnap.empty) {
          return NextResponse.json(
            { error: "Cet e-mail a déjà bénéficié de l'offre d'essai Découverte (3 jours). Connectez-vous à votre compte ou découvrez nos formules d'abonnement PRO & EXPERT." },
            { status: 400 }
          );
        }
      } catch (dbErr) {
        console.warn("⚠️ Firestore user lookup warning (non-bloquant):", dbErr);
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
          { error: "Cet e-mail a déjà bénéficié de l'offre d'essai Découverte (3 jours). Connectez-vous à votre compte ou découvrez nos formules d'abonnement PRO & EXPERT." },
          { status: 400 }
        );
      }
    }

    const cleanRole = requestedRole === 'teacher' ? 'teacher' : 'student';
    const cleanTier = (['découverte', 'pro', 'expert', 'ultra', 'institution'].includes(requestedTier)) ? requestedTier : 'découverte';

    // 3. Insérer la demande dans Firestore et créer le compte automatique si Découverte
    const isFreeTest = cleanTier === 'découverte';
    let tempPassword = '';
    let isNewAccountCreated = false;

    if (isFreeTest) {
      try {
        let userRecord;
        try {
          userRecord = await adminAuth.getUserByEmail(cleanEmail);
        } catch (authErr: unknown) {
          const authErrorObj = authErr as { code?: string; message?: string };
          if (authErrorObj.code === 'auth/user-not-found') {
            // Générer un mot de passe temporaire à 6 caractères lisibles
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            tempPassword = "Test3j-";
            for (let i = 0; i < 4; i++) {
              tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            userRecord = await adminAuth.createUser({
              email: cleanEmail,
              password: tempPassword,
              displayName: `${firstName.trim()} ${lastName.trim()}`,
              emailVerified: true
            });
            await adminAuth.setCustomUserClaims(userRecord.uid, { role: cleanRole });
            isNewAccountCreated = true;
          } else {
            throw authErr;
          }
        }

        // Créer/mettre à jour le document utilisateur dans Firestore
        const expiresAtDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        await adminDb.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email: cleanEmail,
          displayName: `${firstName.trim()} ${lastName.trim()}`,
          role: cleanRole,
          subscription: {
            tier: 'découverte',
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAtDate)
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      } catch (authCreateErr) {
        console.error("Erreur création automatique compte Découverte:", authCreateErr);
      }
    }

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

        const isDecouverte = cleanTier === 'découverte';
        const isPro = cleanTier === 'pro';
        const isExpert = cleanTier === 'expert';
        const isUltra = cleanTier === 'ultra';

        let emailSubject = "Confirmation de votre demande d'accès - Methodo&Clinique";
        if (isDecouverte) emailSubject = "Confirmation de votre demande d'accès Test Découverte (3j) - Methodo&Clinique";
        else if (isPro) emailSubject = "Confirmation de votre demande d'accès PRO - Methodo&Clinique";
        else if (isExpert) emailSubject = "Confirmation de votre demande d'accès EXPERT - Methodo&Clinique";
        else if (isUltra) emailSubject = "Confirmation de votre demande d'accès ULTRA Enseignant - Methodo&Clinique";
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

        const isDz = (!country || country.toLowerCase().trim() === 'algérie' || country.toLowerCase().trim() === 'algerie' || country.toLowerCase().trim() === 'dz' || country.toLowerCase().trim() === 'algeria');

        const paymentInstructionsHtml = isDz ? `
          <div style="background: #ffffff; border: 1px dashed #0d9488; padding: 12px 14px; border-radius: 6px; font-family: monospace; font-size: 0.92rem; color: #0f766e;">
            <strong>BaridiMob (RIP) :</strong> 00799999000041210947<br />
            <strong>Titulaire :</strong> Professeur Nezzal Abdelmalek
          </div>
        ` : `
          <div style="background: #ffffff; border: 1px dashed #0284c7; padding: 12px 14px; border-radius: 6px; font-size: 0.9rem; color: #1e293b;">
            <div style="margin-bottom: 6px; color: #0369a1;"><strong>💳 Compte PayPal :</strong> <code style="background: #e0f2fe; padding: 3px 8px; border-radius: 4px; color: #0369a1; font-weight: bold;">nezzal.abdelmalek@gmail.com</code></div>
            <div style="color: #b45309; margin-top: 6px;"><strong>💸 Western Union :</strong></div>
            <div style="padding-left: 12px; margin-top: 4px; font-size: 0.85rem; color: #475569;">
              • <strong>Bénéficiaire :</strong> Nezzal Hanane Hayette<br />
              • <strong>Destination :</strong> Quebec Brossard, Canada
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"Plateforme Methodo&Clinique" <${smtpUser}>`,
          to: cleanEmail,
          subject: emailSubject,
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
                <tr>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Pays / Zone</td>
                  <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #1e293b;">${country.trim()}</td>
                </tr>
              </table>

              ${isDecouverte ? `
              <div style="background: #f0fdfa; border: 1.5px solid #0d9488; border-radius: 10px; padding: 18px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0f766e; font-size: 1.05rem;">
                  🟢 Conditions de l'Offre Test Découverte (3 Jours)
                </h3>
                
                <p style="margin: 0 0 14px 0; color: #334155; font-size: 0.9rem; line-height: 1.5;">
                  Votre demande d'accès test gratuit de <strong>3 jours (72 heures)</strong> est enregistrée et validée automatiquement.
                </p>

                <!-- Encadré des Identifiants d'Accès -->
                <div style="background: #ffffff; border: 2px solid #10b981; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; text-align: left;">
                  <div style="font-size: 0.88rem; color: #047857; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">
                    🔑 Vos Identifiants d'Accès Instantané
                  </div>
                  <div style="margin: 4px 0; font-size: 0.9rem; color: #1e293b;">
                    <strong>E-mail :</strong> <code style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; color: #0f766e; font-size: 0.95rem; font-weight: 600;">${cleanEmail}</code>
                  </div>
                  <div style="margin: 6px 0; font-size: 0.9rem; color: #1e293b;">
                    <strong>Mot de passe :</strong> <code style="background: #e6fffa; border: 1px solid #0d9488; padding: 4px 10px; border-radius: 4px; color: #0f766e; font-size: 0.98rem; font-weight: bold;">${isNewAccountCreated ? tempPassword : '(Utilisez votre mot de passe habituel)'}</code>
                  </div>
                </div>

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
                  📲 Règlement (${isDz ? 'BaridiMob' : 'PayPal / Western Union'})
                </p>
                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 0.82rem; line-height: 1.5;">
                  Pour passer à un accès complet (Formule PRO, EXPERT ou ULTRA), lever les filigranes et bénéficier de vos jours bonus (+7j Pro / +14j Ultra), vous pouvez effectuer votre virement :
                </p>
                ${paymentInstructionsHtml}
              </div>
              ` : isPro ? `
              <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #0f766e; font-size: 0.9rem; line-height: 1.6;">
                  Merci pour votre demande. Pour valider votre abonnement <strong>Formule PRO (${isDz ? '1 500 DZD / mois' : '20 € / mois'})</strong> et bénéficier des <strong>+7 jours bonus offerts</strong>, voici vos coordonnées de règlement :
                </p>
                ${paymentInstructionsHtml}
              </div>
              ` : isExpert ? `
              <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #a16207; font-size: 0.9rem; line-height: 1.6;">
                  Merci pour votre demande. Pour valider votre abonnement <strong>Formule EXPERT (${isDz ? '3 500 DZD / mois' : '34 € / mois'} — Illimité & PDF HD sans filigrane)</strong>, voici vos coordonnées de règlement :
                </p>
                ${paymentInstructionsHtml}
              </div>
              ` : isUltra ? `
              <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #b45309; font-size: 0.9rem; line-height: 1.6;">
                  Merci pour votre demande. Pour valider votre abonnement <strong>Formule ULTRA Enseignant (${isDz ? '3 500 DZD / mois' : '37 € / mois'} — 1er étudiant encadré inclus + Espace Supervision)</strong> et bénéficier des <strong>+14 jours bonus offerts</strong>, voici vos coordonnées de règlement :
                </p>
                ${paymentInstructionsHtml}
              </div>
              ` : `
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #1e40af; font-size: 0.9rem; line-height: 1.6;">
                  Un e-mail de confirmation vous est envoyé pour vous confirmer la bonne réception de votre demande. Un administrateur prendra directement contact avec vous par e-mail ou téléphone afin d'étudier vos besoins et vous transmettre une proposition sur-mesure pour la <strong>Formule INSTITUTION</strong>.
                </p>
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

        let adminSubject = `Nouvelle demande d'accès [${cleanRole === 'teacher' ? 'Enseignant' : 'Étudiant'}] - ${firstName.trim()} ${lastName.trim()}`;
        let adminHeading = `Nouvelle demande d'inscription [${cleanRole === 'teacher' ? 'Enseignant' : 'Étudiant'}]`;
        let adminIntro = `Un utilisateur a demandé l'accès à la Plateforme Methodo&Clinique. Le courrier de confirmation lui a été envoyé automatiquement.`;

        if (cleanTier === 'institution') {
          adminSubject = `🏛️ [DEVIS INSTITUTION] Demande de devis - ${firstName.trim()} ${lastName.trim()} (${institution.trim()})`;
          adminHeading = `Demande de devis - Formule INSTITUTION`;
          adminIntro = `Un établissement a soumis une demande de devis pour la <strong>Formule INSTITUTION</strong>. Un e-mail de confirmation de réception lui a été envoyé automatiquement. Veuillez prendre contact pour formuler une offre commerciale.`;
        } else if (cleanTier === 'ultra') {
          adminSubject = `👑 [ULTRA GROUPE] Nouvelle demande - ${firstName.trim()} ${lastName.trim()} (${institution.trim()})`;
          adminHeading = `Demande d'accès - Formule ULTRA (Superviseur)`;
          adminIntro = `Un enseignant/encadreur a soumis une demande d'accès pour la <strong>Formule ULTRA</strong> (permettant la supervision de groupe). Veuillez prendre contact pour établir un devis ou confirmer son paiement.`;
        }

        await transporter.sendMail({
          from: `"Plateforme Methodo&Clinique" <${smtpUser}>`,
          to: adminNotificationEmail,
          subject: adminSubject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e40af; margin-top: 0;">${adminHeading}</h2>
              <p>${adminIntro}</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 0.9rem;">
                <strong>Type d'accès demandé :</strong> ${cleanRole === 'teacher' ? '👨‍🏫 Enseignant / Superviseur' : '🎓 Étudiant'}<br/>
                <strong>Formule demandée :</strong> ${cleanTier.toUpperCase()}<br/>
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
      message: isFreeTest 
        ? "Votre accès Découverte (3 jours) est activé ! Vos identifiants ont été envoyés par e-mail." 
        : "Demande enregistrée.",
      credentials: isFreeTest && isNewAccountCreated ? { email: cleanEmail, tempPassword } : null
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Une erreur interne est survenue. Veuillez réessayer.";
    console.error("Erreur lors de la soumission de la demande d'accès:", error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  loadEnvLocal();
  try {
    const { email, receiptTxId, receiptImageData } = await req.json();

    if (!email || !receiptTxId || !receiptTxId.trim()) {
      return NextResponse.json({ error: "L'adresse e-mail et le N° de reçu BaridiMob sont requis." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const docId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const requestDocRef = adminDb.collection('access_requests').doc(docId);
    const docSnap = await requestDocRef.get();

    const updatePayload: Record<string, unknown> = {
      status: 'payment_received',
      paymentReceiptRef: receiptTxId.trim(),
      paymentSubmittedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (receiptImageData) {
      updatePayload.paymentReceiptImage = receiptImageData;
    }

    if (!docSnap.exists) {
      const querySnap = await adminDb.collection('access_requests').where('email', '==', cleanEmail).get();
      if (querySnap.empty) {
        return NextResponse.json({ error: "Aucune demande d'accès trouvée pour cet e-mail." }, { status: 404 });
      }
      const targetDoc = querySnap.docs[0];
      await targetDoc.ref.update(updatePayload);
    } else {
      await requestDocRef.update(updatePayload);
    }

    // Email admin notification
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_NOTIFICATION_EMAIL || smtpUser;

    if (smtpUser && smtpPass && adminEmail) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: smtpUser, pass: smtpPass }
        });

        await transporter.sendMail({
          from: `"Plateforme Methodo&Clinique" <${smtpUser}>`,
          to: adminEmail,
          subject: `📲 Reçu BaridiMob Soumis - ${cleanEmail}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0d9488; margin-top: 0;">Justificatif de paiement BaridiMob soumis</h2>
              <p>Un utilisateur a soumis son N° de reçu BaridiMob pour sa demande d'accès :</p>
              <ul>
                <li><strong>E-mail :</strong> ${cleanEmail}</li>
                <li><strong>N° / Référence Reçu BaridiMob :</strong> <code style="font-size: 1.1rem; color: #0d9488; font-weight: bold;">${receiptTxId.trim()}</code></li>
                ${receiptImageData ? '<li><strong>Photo du reçu :</strong> <i>Une photo scannée/optimisée a été jointe au dossier admin.</i></li>' : ''}
              </ul>
              <p>Le statut de sa demande a été mis à jour à "Paiement reçu" dans l'Espace Superviseur.</p>
            </div>
          `
        });
      } catch (mailErr) {
        console.error("Erreur notification mail admin pour reçu:", mailErr);
      }
    }

    return NextResponse.json({ success: true, message: "Reçu BaridiMob et photo enregistrés avec succès." });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Erreur serveur lors de l'enregistrement du reçu.";
    console.error("Erreur enregistrement reçu BaridiMob:", err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  loadEnvLocal();
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: "L'adresse e-mail est requise." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const docId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const requestDocRef = adminDb.collection('access_requests').doc(docId);
    const docSnap = await requestDocRef.get();

    if (docSnap.exists) {
      await requestDocRef.update({
        paymentReceiptImage: admin.firestore.FieldValue.delete()
      });
    } else {
      const querySnap = await adminDb.collection('access_requests').where('email', '==', cleanEmail).get();
      if (!querySnap.empty) {
        await querySnap.docs[0].ref.update({
          paymentReceiptImage: admin.firestore.FieldValue.delete()
        });
      }
    }

    return NextResponse.json({ success: true, message: "Photo du reçu supprimée avec succès." });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Erreur serveur lors de la suppression.";
    console.error("Erreur suppression photo reçu:", err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}