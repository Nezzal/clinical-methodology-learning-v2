import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPrivateKey, createSign } from 'crypto';

export async function POST(req: Request) {
  try {
    const { email, tier, expiresAt } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Adresse e-mail requise." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const expiresTimestamp = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 365 * 24 * 60 * 60 * 1000;
    const cleanTier = (tier || 'pro').toLowerCase();

    const licenseData = {
      email: cleanEmail,
      expiresAt: expiresTimestamp,
      tier: cleanTier,
      generatedAt: Date.now()
    };

    const privateKeyPath = path.join(process.cwd(), 'scripts', 'license-keys', 'private.json');
    if (!fs.existsSync(privateKeyPath)) {
      return NextResponse.json({ error: "Clé privée secrète introuvable sur le serveur." }, { status: 500 });
    }

    const privateKeyJWK = JSON.parse(fs.readFileSync(privateKeyPath, 'utf8'));
    const privateKeyObj = createPrivateKey({ key: privateKeyJWK, format: 'jwk' });

    const dataString = JSON.stringify(licenseData);
    const sign = createSign('SHA256');
    sign.update(dataString);

    const signature = sign.sign({
      key: privateKeyObj,
      dsaEncoding: 'ieee-p1363'
    }, 'base64');

    const licenseTokenObj = {
      data: dataString,
      sig: signature
    };

    const licenseKey = Buffer.from(JSON.stringify(licenseTokenObj)).toString('base64');

    return NextResponse.json({
      success: true,
      licenseKey,
      data: licenseData
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Erreur génération licence :", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
