const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Charger .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const version = '2.0.6';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

console.log(`\n==================================================`);
console.log(`📢 Diffusion du mail de mise à jour v${version}`);
console.log(`==================================================\n`);

if (!smtpUser || !smtpPass) {
  console.warn("⚠️ SMTP_USER ou SMTP_PASS non trouvé dans .env.local.");
  console.log("Pour envoyer des emails réels, veuillez renseigner vos identifiants SMTP dans .env.local.");
  process.exit(1);
}

const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b132b; color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 620px; margin: 0 auto; background-color: #1c2541; border: 1px solid #3a506b; border-radius: 12px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { text-align: center; border-bottom: 1px solid #3a506b; padding-bottom: 20px; margin-bottom: 24px; }
    .title { color: #38bdf8; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; }
    .version-badge { display: inline-block; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .section-title { color: #2dd4bf; font-size: 17px; font-weight: 600; margin-top: 24px; margin-bottom: 12px; border-left: 3px solid #2dd4bf; padding-left: 10px; }
    ul { padding-left: 20px; margin: 0 0 20px 0; }
    li { margin-bottom: 10px; color: #e2e8f0; line-height: 1.5; font-size: 14px; }
    .btn-group { display: flex; flex-direction: column; gap: 10px; margin: 24px 0; }
    .btn { display: block; text-align: center; padding: 12px 18px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 14px; transition: all 0.2s ease; }
    .btn-mac { background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff !important; }
    .btn-win { background: linear-gradient(135deg, #0d9488, #0f766e); color: #ffffff !important; }
    .btn-linux { background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff !important; }
    .footer { border-top: 1px solid #3a506b; padding-top: 18px; margin-top: 28px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Methodo&amp;Clinique</h1>
      <span class="version-badge">Mise à jour v${version} disponible</span>
    </div>

    <p style="font-size: 15px; color: #f1f5f9; line-height: 1.6;">Bonjour,</p>
    <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
      Nous avons le plaisir de vous annoncer la disponibilité de la <strong>nouvelle version v${version} de l'application Methodo&amp;Clinique</strong> ! Cette mise à jour apporte de nombreuses améliorations pour la rédaction de vos travaux de recherche, vos protocoles cliniques et vos articles scientifiques aux normes STROBE.
    </p>

    <div class="section-title">🌟 Les Nouveautés Majeures de la v${version} :</div>
    <ul>
      <li>🎙️ <strong>Dictée Vocale IA sur l'Application Desktop</strong> : Posez vos questions au Tuteur IA et dictez vos données à la voix directement depuis l'application Mac, Windows & Linux avec une transcription instantanée et haute précision.</li>
      <li>📜 <strong>Formule PRO 100% Sans Filigrane</strong> : L'ensemble des exportations PDF pour les abonnés PRO et ULTRA sont désormais totalement exemptes de filigrane sur vos protocoles et articles STROBE.</li>
      <li>📚 <strong>Gestion & Double Transfert des Revues PubMed</strong> : Sauvegardez, ouvrez, régénérez ou supprimez vos revues en 1 clic. Injectez directement vos recherches PubMed dans le <em>Rationnel de votre Protocole</em> ou dans le <em>Contexte scientifique de votre Article STROBE (Critère 3)</em>.</li>
      <li>⚖️ <strong>Déclaration Éthique de l'IA (Normes ICMJE & STROBE)</strong> : Formulaire pré-rempli conforme aux recommandations officielles de l'<strong>ICMJE</strong> pour déclarer en toute transparence l'utilisation de l'assistant méthodologique IA dans vos publications.</li>
      <li>🎨 <strong>Interface STROBE Optimisée</strong> : Navigation fluide entre les 6 onglets de rédaction sans tronquature d'affichage.</li>
    </ul>

    <div class="section-title">📥 Télécharger la Nouvelle Version Desktop :</div>
    <p style="font-size: 13px; color: #94a3b8; margin-bottom: 14px;">
      Si vous utilisez l'application Desktop sur Mac, Windows ou Linux, téléchargez la mise à jour dès maintenant :
    </p>
    <div class="btn-group">
      <a href="https://github.com/mednajah/clinical-methodology-learning/releases/download/v${version}/RECIF-MethodoClinique-${version}-arm64.dmg" class="btn btn-mac">🍎 Télécharger pour Mac (.dmg)</a>
      <a href="https://github.com/mednajah/clinical-methodology-learning/releases/download/v${version}/RECIF-MethodoClinique.Setup.${version}.exe" class="btn btn-win">🪟 Télécharger pour Windows (.exe)</a>
      <a href="https://github.com/mednajah/clinical-methodology-learning/releases/download/v${version}/RECIF-MethodoClinique-${version}.AppImage" class="btn btn-linux">🐧 Télécharger pour Linux (.AppImage)</a>
    </div>

    <div class="footer">
      Merci pour votre confiance et votre engagement dans la recherche médicale rigoureuse !<br>
      <strong>L'équipe Methodo&amp;Clinique</strong> • <em>Assistance Méthodologique &amp; Rédaction Clinique assistée par IA</em>
    </div>
  </div>
</body>
</html>
`;

console.log("✅ Template HTML préparé avec succès.");
