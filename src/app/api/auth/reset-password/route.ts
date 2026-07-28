import { NextResponse } from 'next/server';
import { adminAuth } from '@/utils/firebase-admin';
import nodemailer from 'nodemailer';
import { loadEnvLocal } from '@/utils/env';

export async function POST(request: Request) {
  loadEnvLocal();
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: "L'adresse e-mail est requise." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Générer le lien de réinitialisation sécurisé via Firebase Admin SDK
    let resetLink = '';
    if (adminAuth) {
      try {
        const actionCodeSettings = {
          url: 'https://clinical-methodology-learning.vercel.app/login',
          handleCodeInApp: false
        };
        resetLink = await adminAuth.generatePasswordResetLink(cleanEmail, actionCodeSettings);
      } catch (authErr: any) {
        console.warn("⚠️ Impossible de générer le lien de réinitialisation via Firebase Admin:", authErr?.message);
        if (authErr?.code === 'auth/user-not-found') {
          return NextResponse.json({ error: "Aucun compte trouvé avec cette adresse e-mail." }, { status: 404 });
        }
      }
    }

    if (!resetLink) {
      return NextResponse.json({ 
        error: "Impossible de générer le lien de réinitialisation. Veuillez contacter le support." 
      }, { status: 500 });
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.warn("⚠️ Configuration SMTP manquante dans .env.local");
      return NextResponse.json({ 
        success: true, 
        message: "Lien de réinitialisation généré (mode développement)",
        resetLink 
      });
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Réinitialisation de votre mot de passe - PedagogiAfrica</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .card { max-width: 600px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        .logo { font-size: 1.5rem; font-weight: 800; color: #2dd4bf; text-decoration: none; margin-bottom: 20px; display: inline-block; }
        .btn { display: inline-block; background: #0d9488; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 1rem; margin: 20px 0; }
        .footer { font-size: 0.8rem; color: #94a3b8; margin-top: 30px; border-top: 1px solid #334155; padding-top: 16px; }
        .link-box { background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 0.8rem; word-break: break-all; color: #38bdf8; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">PedagogiAfrica / RECIF</div>
        <h2 style="color: #f8fafc; margin-top: 0;">🔑 Réinitialisation de votre mot de passe</h2>
        <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.5;">
          Bonjour,<br/><br/>
          Une demande de réinitialisation de mot de passe a été effectuée pour votre compte <strong>${cleanEmail}</strong> sur la plateforme RECIF.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" class="btn" target="_blank">
            👉 Cliquez ici pour réinitialiser votre mot de passe
          </a>
        </div>

        <p style="color: #cbd5e1; font-size: 0.88rem; line-height: 1.5;">
          Si le bouton ne s'ouvre pas directement, vous pouvez copier et coller ce lien sécurisé dans votre navigateur :
        </p>
        <div class="link-box">${resetLink}</div>

        <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 24px;">
          ⚠️ Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité. Votre mot de passe actuel restera inchangé.
        </p>

        <div class="footer">
          <strong>Plateforme de Recherche & Méthodologie Clinique RECIF — PedagogiAfrica</strong><br/>
          Fondateur : Pr NEZZAL Abdelmalek — NIF : 15007180115910202380<br/>
          E-mail Support : pedagogiafrica@gmail.com
        </div>
      </div>
    </body>
    </html>
    `;

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
      to: cleanEmail,
      subject: "🔑 Lien de réinitialisation de votre mot de passe - PedagogiAfrica",
      html: htmlContent
    });

    return NextResponse.json({ 
      success: true, 
      message: "Un e-mail contenant le lien de réinitialisation sécurisé a été envoyé avec succès !" 
    });

  } catch (error: any) {
    console.error("❌ Erreur réinitialisation mot de passe via API:", error);
    return NextResponse.json({ error: error?.message || "Erreur interne lors de la réinitialisation." }, { status: 500 });
  }
}
