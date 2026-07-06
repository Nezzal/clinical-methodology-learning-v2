import { NextResponse } from 'next/server';
import { adminDb, admin } from '@/utils/firebase-admin';
import { loadEnvLocal } from '@/utils/env';

export async function PATCH(req: Request) {
  loadEnvLocal();
  try {
    const { docId, paymentReceivedBy, status, rejectedBy, rejectionReason } = await req.json();

    if (!docId) {
      return NextResponse.json({ error: "Identifiant de demande manquant." }, { status: 400 });
    }

    const docRef = adminDb.collection('access_requests').doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    const currentData = doc.data();

    if (status === 'rejected') {
      await docRef.update({
        status: 'rejected',
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectedBy: rejectedBy || null,
        rejectionReason: rejectionReason || ''
      });
      return NextResponse.json({ success: true, message: "Demande rejetée." });
    }

    // Marquer le paiement comme reçu
    if (currentData.status !== 'pending') {
      return NextResponse.json({ error: "Cette demande n'est pas en attente de paiement." }, { status: 400 });
    }

    await docRef.update({
      status: 'payment_received',
      paymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentReceivedBy: paymentReceivedBy || null
    });

    return NextResponse.json({ success: true, message: "Paiement marqué comme reçu." });
  } catch (error: any) {
    console.error("Erreur mise à jour demande:", error);
    return NextResponse.json({ error: error?.message || "Erreur interne." }, { status: 500 });
  }
}