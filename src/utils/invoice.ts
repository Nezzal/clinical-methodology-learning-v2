import { COMPANY_NIF } from './constants';

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientEmail: string;
  clientInstitution?: string;
  clientCity?: string;
  clientCountry?: string;
  tier: string;
  role?: string;
  amount?: string;
  paymentRef?: string;
  logoBase64?: string;
}

/**
 * Tarifs par défaut selon la formule si non précisé
 */
export function getTierPrice(tier: string, country?: string): string {
  const cleanTier = (tier || 'pro').toLowerCase();
  const isDz = !country || ['algérie', 'algerie', 'dz', 'algeria'].includes(country.toLowerCase());

  switch (cleanTier) {
    case 'pro':
      return isDz ? '3 500 DZD' : '15 EUR / $15 USD';
    case 'expert':
      return isDz ? '6 500 DZD' : '30 EUR / $30 USD';
    case 'ultra':
      return isDz ? '12 000 DZD' : '50 EUR / $50 USD';
    case 'institution':
      return 'Sur Devis';
    default:
      return isDz ? '3 500 DZD' : '15 EUR';
  }
}

/**
 * Génère le code HTML complet de la facture officielle PedagogiAfrica
 */
export function generateInvoiceHTML(data: InvoiceData): string {
  const {
    invoiceNumber,
    date,
    clientName,
    clientEmail,
    clientInstitution = 'Non renseignée',
    clientCity = '',
    clientCountry = 'Algérie',
    tier,
    amount = getTierPrice(tier, clientCountry),
    paymentRef = 'Non spécifié',
    logoBase64
  } = data;

  const logoSrc = logoBase64 || '/logo_pedagogiafrica.png';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${invoiceNumber} - PedagogiAfrica</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 24px;
      background-color: #ffffff;
    }
    .invoice-card {
      max-width: 750px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      background: #ffffff;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 16px;
    }
    .header-table td {
      vertical-align: top;
    }
    .issuer-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #0d9488;
      margin: 0 0 4px 0;
    }
    .issuer-sub {
      font-size: 1rem;
      font-weight: 700;
      color: #334155;
      margin: 0 0 4px 0;
    }
    .issuer-info {
      font-size: 0.85rem;
      color: #64748b;
      line-height: 1.4;
    }
    .invoice-title-badge {
      text-align: right;
    }
    .invoice-badge {
      display: inline-block;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .invoice-num {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      margin: 4px 0;
    }
    .invoice-date {
      font-size: 0.85rem;
      color: #64748b;
    }
    .client-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .client-box-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: #0d9488;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .client-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 0.9rem;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background: #0d9488;
      color: #ffffff;
      padding: 10px 14px;
      text-align: left;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .items-table td {
      padding: 14px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.9rem;
    }
    .totals-table {
      width: 100%;
      margin-left: auto;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .totals-table td {
      padding: 6px 12px;
      font-size: 0.9rem;
    }
    .totals-table .total-row td {
      font-size: 1.1rem;
      font-weight: 800;
      color: #0d9488;
      border-top: 2px solid #0d9488;
      padding-top: 10px;
    }
    .tva-notice {
      background: #fffbeb;
      border: 1px solid #fef08a;
      color: #b45309;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 24px;
      text-align: center;
    }
    .footer-stamp {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px dashed #cbd5e1;
      padding-top: 16px;
      font-size: 0.8rem;
      color: #64748b;
    }
    .stamp-box {
      text-align: right;
    }
    .stamp-name {
      font-weight: 800;
      color: #0f172a;
      font-size: 0.95rem;
    }

    @media print {
      body {
        padding: 0;
        background: none;
      }
      .invoice-card {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="invoice-card">
    <table class="header-table">
      <tr>
        <td style="width: 60%;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="${logoSrc}" alt="Pedagogi Africa" style="width: 70px; height: 70px; object-fit: contain;" />
            <div>
              <div class="issuer-title">PedagogiAfrica</div>
              <div class="issuer-sub">Pr NEZZAL Abdelmalek</div>
              <div class="issuer-info">
                🏛️ <strong>NIF :</strong> ${COMPANY_NIF}<br/>
                🌐 Plateforme de Recherche & Méthodologie Clinique
              </div>
            </div>
          </div>
        </td>
        <td style="width: 40%; text-align: right;">
          <div class="invoice-badge">✓ FACTURE OFFICIELLE</div>
          <div class="invoice-num">N° ${invoiceNumber}</div>
          <div class="invoice-date"><strong>Date d'émission :</strong> ${date}</div>
        </td>
      </tr>
    </table>

    <div class="client-box">
      <div class="client-box-title">👤 FACTURÉ À (BENÉFICIAIRE) :</div>
      <div class="client-grid">
        <div>
          <span style="color: #64748b; font-size: 0.78rem; display: block;">Nom & Prénom :</span>
          <strong>${clientName}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.78rem; display: block;">Adresse E-mail :</span>
          <strong>${clientEmail}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.78rem; display: block;">Institution / Faculté :</span>
          <span>${clientInstitution}</span>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.78rem; display: block;">Localisation :</span>
          <span>${[clientCity, clientCountry].filter(Boolean).join(', ')}</span>
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description du produit / service</th>
          <th>Référence / Transaction</th>
          <th style="text-align: right;">Montant Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Abonnement Plateforme RECIF — Formule ${tier.toUpperCase()}</strong><br/>
            <span style="font-size: 0.8rem; color: #64748b;">Accès complet aux outils de recherche clinique, générateur de protocoles & tuteur IA.</span>
          </td>
          <td>
            <code style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: monospace;">${paymentRef}</code>
          </td>
          <td style="text-align: right; font-weight: 700; font-size: 1rem;">
            ${amount}
          </td>
        </tr>
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td style="text-align: right; color: #64748b;">Sous-total HT :</td>
        <td style="text-align: right; font-weight: 700; width: 140px;">${amount}</td>
      </tr>
      <tr>
        <td style="text-align: right; color: #64748b;">TVA (0% - Exonérée) :</td>
        <td style="text-align: right; font-weight: 700; color: #166534;">0,00 DA (0%)</td>
      </tr>
      <tr class="total-row">
        <td style="text-align: right;">MONTANT TOTAL TTC :</td>
        <td style="text-align: right;">${amount}</td>
      </tr>
    </table>

    <div class="tva-notice">
      ℹ️ TVA non applicable — Exonération de TVA conformément à la réglementation fiscale en vigueur (NIF : ${COMPANY_NIF}).
    </div>

    <div class="footer-stamp" style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #0d9488; padding-top: 16px; margin-top: 20px;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <!-- QR Code de vérification officielle généré avec métadonnées -->
        <img 
          src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`VERIFICATION FACTURE OFFICIELLE\nNo Facture: ${invoiceNumber}\nEmetteur: PedagogiAfrica - Pr NEZZAL Abdelmalek\nNIF: ${COMPANY_NIF}\nClient: ${clientName} (${clientEmail})\nFormule: ${tier.toUpperCase()}\nMontant: ${amount}\nDate: ${date}\nStatut: CERTIFIE ET CONFORME`)}" 
          alt="QR Code de Vérification Officielle" 
          style="width: 85px; height: 85px; border: 1px solid #cbd5e1; padding: 4px; background: #ffffff; border-radius: 6px;" 
        />
        <div>
          <div style="font-size: 0.78rem; font-weight: 800; color: #0d9488; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
            🛡️ Sceau & QR-Code de Vérification Numérique
          </div>
          <div style="font-size: 0.74rem; color: #64748b; font-family: monospace; line-height: 1.4;">
            ID Certificat : VERIF-PA-${invoiceNumber.replace(/[^A-Z0-9]/gi, '')}<br/>
            NIF Émetteur : ${COMPANY_NIF}<br/>
            Document officiel certifié par PedagogiAfrica
          </div>
        </div>
      </div>

      <div class="stamp-box" style="text-align: right;">
        <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 4px; font-weight: 600;">Signature & Cachet Numérique :</div>
        <div class="stamp-name" style="font-weight: 800; color: #0f172a; font-size: 0.95rem;">Professeur NEZZAL Abdelmalek</div>
        <div style="font-size: 0.78rem; color: #0d9488; font-weight: 700; margin-top: 2px;">
          Fondateur PedagogiAfrica — NIF ${COMPANY_NIF}
        </div>
      </div>
    </div>
  </div>

</body>
</html>
  `;
}
