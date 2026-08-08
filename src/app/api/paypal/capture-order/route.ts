import { NextResponse } from 'next/server';
import { getPayPalAccessToken, getPayPalBaseUrl, isPayPalConfigured } from '@/utils/paypal';
import { adminDb, adminAuth, admin } from '@/utils/firebase-admin';
import nodemailer from 'nodemailer';
import { loadEnvLocal } from '@/utils/env';

export async function POST(req: Request) {
  loadEnvLocal();
  try {
    const body = await req.json();
    const { orderID, userInfo, tier = 'pro', duration = '1m' } = body;

    if (!orderID) {
      return NextResponse.json({ error: "Identifiant de commande PayPal (orderID) manquant." }, { status: 400 });
    }

    const {
      firstName = '',
      lastName = '',
      institution = '',
      profession = '',
      city = '',
      country = '',
      email = '',
      phone = '',
      requestedRole = 'student'
    } = userInfo || {};

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "L'adresse e-mail est obligatoire pour l'activation." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Capture de la commande auprès de l'API PayPal (ou validation en mode simulation)
    if (!isPayPalConfigured() || typeof orderID === 'string' && orderID.startsWith('DEMO_PAYPAL_ORDER_')) {
      console.log("ℹ️ [PayPal Sandbox Demo] Validation simulée de la commande de démonstration:", orderID);
    } else {
      const accessToken = await getPayPalAccessToken();
      const baseUrl = getPayPalBaseUrl();

      const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const captureData = await captureResponse.json();

      if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
        console.error("❌ Échec de capture de commande PayPal:", captureData);
        return NextResponse.json({
          error: captureData.message || "Le paiement PayPal n'a pas pu être validé ou a été refusé."
        }, { status: 400 });
      }
    }

    // 2. Calcul exact des dates de validité et jours bonus
    const durationMonths = duration === '1m' ? 1 : duration === '3m' ? 3 : duration === '6m' ? 6 : 12;
    const bonusDays = tier === 'ultra' ? 14 : tier === 'pro' ? 7 : 10; // +7j Pro, +14j Ultra, +10j Expert

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
    expiresAt.setDate(expiresAt.getDate() + bonusDays);

    const cleanRole = requestedRole === 'teacher' ? 'teacher' : 'student';
    const cleanTier = ['pro', 'expert', 'ultra'].includes(tier) ? tier : 'pro';

    // 3. Gestion / Création automatique du compte utilisateur Firebase Auth & Firestore
    let uid = '';
    let isNewUser = false;
    let tempPassword = '';

    if (adminAuth) {
      try {
        const existingUser = await adminAuth.getUserByEmail(cleanEmail);
        uid = existingUser.uid;
        await adminAuth.setCustomUserClaims(uid, { role: cleanRole });
      } catch (authErr: unknown) {
        const errObj = authErr as { code?: string };
        if (errObj?.code === 'auth/user-not-found') {
          // Créer l'utilisateur si inexistant
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          tempPassword = "Pass-";
          for (let i = 0; i < 5; i++) {
            tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
          }

          const newUser = await adminAuth.createUser({
            email: cleanEmail,
            password: tempPassword,
            displayName: `${firstName.trim()} ${lastName.trim()}`.trim() || cleanEmail.split('@')[0],
            emailVerified: true
          });
          uid = newUser.uid;
          await adminAuth.setCustomUserClaims(uid, { role: cleanRole });
          isNewUser = true;
        } else {
          console.warn("⚠️ Firebase Auth lookup warning:", authErr);
        }
      }
    }

    if (!uid) {
      uid = cleanEmail.replace(/[^a-z0-9]/g, '_');
    }

    // Mise à jour / Création du profil utilisateur dans Firestore
    const userDocRef = adminDb.collection('users').doc(uid);
    await userDocRef.set({
      uid,
      email: cleanEmail,
      displayName: `${firstName.trim()} ${lastName.trim()}`.trim() || cleanEmail.split('@')[0],
      role: cleanRole,
      institution: institution.trim(),
      profession: profession.trim(),
      city: city.trim(),
      country: country.trim(),
      phone: phone.trim(),
      subscription: {
        tier: cleanTier,
        status: 'active',
        startDate: now.toISOString(),
        validUntil: expiresAt.toISOString(),
        durationMonths,
        bonusDaysAdded: bonusDays,
        paymentVerified: true,
        paymentReceiptRef: orderID,
        paymentMethod: 'paypal'
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 4. Mise à jour / Création du document d'accès dans access_requests
    const docId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const requestDocRef = adminDb.collection('access_requests').doc(docId);
    await requestDocRef.set({
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
      status: 'approved',
      paymentStatus: 'paid_paypal',
      paymentReceiptRef: orderID,
      paymentMethod: 'paypal',
      paymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 5. Envoi d'e-mail de confirmation avec Nodemailer
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

        const formattedExpiryDate = expiresAt.toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        await transporter.sendMail({
          from: `"Plateforme Methodo-Clinique" <${smtpUser}>`,
          to: cleanEmail,
          subject: `✅ Activation Instantanée - Votre abonnement ${cleanTier.toUpperCase()} (Paiement PayPal réussi)`,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, #0d9488, #0284c7); border-radius: 16px; margin-bottom: 12px; color: white; font-size: 26px;">
                  ⚕
                </div>
                <h1 style="color: #1e293b; margin: 0; font-size: 1.4rem; font-weight: 700;">Plateforme Methodo-Clinique</h1>
                <p style="color: #0d9488; margin: 4px 0 0; font-size: 0.9rem; font-weight: 600;">Confirmation de Paiement & Activation Automatique</p>
              </div>

              <div style="background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #15803d; font-weight: 700; font-size: 0.95rem;">
                  🎉 Votre paiement PayPal a été validé avec succès !
                </p>
                <p style="margin: 4px 0 0 0; color: #166534; font-size: 0.85rem;">
                  Votre formule <strong>${cleanTier.toUpperCase()}</strong> (${durationMonths} mois + ${bonusDays} jours offerts) est désormais active.
                </p>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Détails du Paiement & Référence</div>
                <div style="font-size: 0.88rem; color: #334155; margin: 4px 0;"><strong>Référence de transaction PayPal :</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${orderID}</code></div>
                <div style="font-size: 0.88rem; color: #334155; margin: 4px 0;"><strong>Formule souscrite :</strong> ${cleanTier.toUpperCase()}</div>
                <div style="font-size: 0.88rem; color: #334155; margin: 4px 0;"><strong>Bonus offerts :</strong> +${bonusDays} jours offerts</div>
                <div style="font-size: 0.88rem; color: #0d9488; font-weight: 700; margin-top: 6px;">📅 Date d'expiration de votre accès : ${formattedExpiryDate}</div>
              </div>

              ${isNewUser ? `
              <div style="background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                <div style="font-size: 0.88rem; color: #1d4ed8; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">🔑 Vos identifiants de connexion instantanés</div>
                <div style="margin: 4px 0; font-size: 0.9rem; color: #1e293b;"><strong>E-mail :</strong> <code>${cleanEmail}</code></div>
                <div style="margin: 4px 0; font-size: 0.9rem; color: #1e293b;"><strong>Mot de passe temporaire :</strong> <code style="background: #dbeafe; border: 1px solid #3b82f6; padding: 3px 8px; border-radius: 4px; color: #1e40af; font-weight: bold;">${tempPassword}</code></div>
                <div style="font-size: 0.78rem; color: #64748b; margin-top: 6px;">Vous pourrez personnaliser votre mot de passe depuis votre espace profil.</div>
              </div>
              ` : ''}

              <p style="color: #475569; font-size: 0.9rem; line-height: 1.6;">
                Vous pouvez maintenant vous connecter et profiter pleinement de toutes les fonctionnalités avancées de la plateforme Methodo-Clinique.
              </p>

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
              <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center;">Message automatique d'activation — Plateforme RECIF Methodo-Clinique</p>
            </div>
          `
        });
      } catch (mailErr) {
        console.error("⚠️ Erreur lors de l'envoi de l'e-mail de confirmation PayPal:", mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Paiement PayPal réussi ! Abonnement ${cleanTier.toUpperCase()} activé jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}.`,
      details: {
        orderID,
        tier: cleanTier,
        validUntil: expiresAt.toISOString(),
        bonusDaysAdded: bonusDays,
        credentials: isNewUser ? { email: cleanEmail, tempPassword } : null
      }
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erreur lors de la validation du paiement PayPal.";
    console.error("❌ Erreur API /api/paypal/capture-order:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
