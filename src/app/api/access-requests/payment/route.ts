import { NextResponse } from 'next/server';
import { adminDb, admin, verifyUserAuth } from '@/utils/firebase-admin';
import { loadEnvLocal } from '@/utils/env';

export async function PATCH(req: Request) {
  loadEnvLocal();
  
  // Validation de sécurité (vérification de l'authentification et de la non-suspension)
  const authCheck = await verifyUserAuth(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const decodedToken = authCheck.decodedToken;
  // Vérifier les droits (doit être admin ou teacher)
  if (!decodedToken || (decodedToken.role !== 'admin' && decodedToken.role !== 'teacher')) {
    return NextResponse.json({ error: "Interdit (Droits insuffisants)" }, { status: 403 });
  }

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

    if (status === 'quote_sent') {
      await docRef.update({
        status: 'quote_sent',
        quoteSentAt: admin.firestore.FieldValue.serverTimestamp(),
        quoteSentBy: decodedToken.uid
      });
      return NextResponse.json({ success: true, message: "Demande marquée comme Devis envoyé." });
    }

    // Marquer le paiement comme reçu
    if (!currentData) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    if (currentData.status !== 'pending' && currentData.status !== 'quote_sent') {
      return NextResponse.json({ error: "Cette demande n'est pas en attente de paiement ou de devis." }, { status: 400 });
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

export async function DELETE(req: Request) {
  loadEnvLocal();
  
  const authCheck = await verifyUserAuth(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const decodedToken = authCheck.decodedToken;
  if (!decodedToken || (decodedToken.role !== 'admin' && decodedToken.role !== 'teacher')) {
    return NextResponse.json({ error: "Interdit (Droits insuffisants)" }, { status: 403 });
  }

  try {
    const { docId } = await req.json();

    if (!docId) {
      return NextResponse.json({ error: "Identifiant de demande manquant." }, { status: 400 });
    }

    const docRef = adminDb.collection('access_requests').doc(docId);
    await docRef.delete();

    return NextResponse.json({ success: true, message: "Demande supprimée avec succès." });
  } catch (error: any) {
    console.error("Erreur suppression demande:", error);
    return NextResponse.json({ error: error?.message || "Erreur interne." }, { status: 500 });
  }
}