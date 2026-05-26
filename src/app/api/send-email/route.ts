import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.warn("⚠️ Configuration SMTP manquante dans .env.local. Envoi d'email simulé.");
      console.log(`\n==================================================\n[EMAIL SIMULÉ] A : ${to}\nSujet : ${subject}\nContenu :\n${html}\n==================================================\n`);
      return NextResponse.json({ success: true, message: "Email simulé (SMTP non configuré dans .env.local)" });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"Plateforme RECIF" <${smtpUser}>`,
      to,
      subject,
      html
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: "Email envoyé avec succès via SMTP" });
  } catch (error: any) {
    console.error("❌ Erreur lors de l'envoi de l'email via SMTP:", error);
    return NextResponse.json({ success: false, error: error?.message || error }, { status: 500 });
  }
}
