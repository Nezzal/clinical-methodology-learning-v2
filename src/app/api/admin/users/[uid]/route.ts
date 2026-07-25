import { NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/utils/firebase-admin';
import { loadEnvLocal } from '@/utils/env';

// Fonction de vérification d'autorisation (rôle Super-Admin uniquement)
async function verifySuperAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: "Non autorisé (Token manquant)", status: 401 };
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return { error: "Interdit (Droits super-administrateur requis)", status: 403 };
    }
    return { decodedToken };
  } catch (err: any) {
    console.error("❌ Échec de vérification du jeton Super-Admin:", err.message);
    return { error: "Session invalide ou expirée", status: 401 };
  }
}

// 1. Mise à jour du statut de l'étudiant (Suspension / Activation)
export async function PATCH(
  req: Request, 
  { params }: { params: { uid: string } | Promise<{ uid: string }> }
) {
  loadEnvLocal();
  
  const authCheck = await verifySuperAdmin(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const resolvedParams = await params;
  const uid = resolvedParams.uid;

  try {
    const { status, tier } = await req.json();

    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status) {
      if (status !== 'active' && status !== 'suspended') {
        return NextResponse.json({ error: "Statut invalide. Les choix sont : active, suspended." }, { status: 400 });
      }
      await adminAuth.updateUser(uid, { disabled: status === 'suspended' });
      updates.status = status;
      if (status === 'suspended') {
        await adminAuth.revokeRefreshTokens(uid);
      }
    }

    if (tier) {
      const validTiers = ['découverte', 'pro', 'expert', 'ultra', 'institution'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: "Formule invalide." }, { status: 400 });
      }
      updates['subscription.tier'] = tier;
    }

    const userDocRef = adminDb.collection('users').doc(uid);
    await userDocRef.update(updates);

    console.log(`✅ Utilisateur ${uid} mis à jour avec succès.`);
    return NextResponse.json({ success: true, message: `Utilisateur mis à jour avec succès.` });
  } catch (error: any) {
    console.error("❌ Erreur lors de la modification du statut utilisateur :", error);
    return NextResponse.json({ error: error?.message || "Une erreur interne est survenue." }, { status: 500 });
  }
}

// 2. Suppression complète de l'utilisateur et de ses données
export async function DELETE(
  req: Request,
  { params }: { params: { uid: string } | Promise<{ uid: string }> }
) {
  loadEnvLocal();

  const authCheck = await verifySuperAdmin(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const resolvedParams = await params;
  const uid = resolvedParams.uid;

  try {
    console.log(`⏳ Suppression complète des données et du compte de l'utilisateur : ${uid}`);

    // A. Supprimer tous les documents de chat dans Firestore
    const chatsRef = adminDb.collection('users').doc(uid).collection('chats');
    const chatsSnap = await chatsRef.get();
    const chatBatch = adminDb.batch();
    chatsSnap.docs.forEach(doc => {
      chatBatch.delete(chatsRef.doc(doc.id));
    });
    await chatBatch.commit();
    if (chatsSnap.size > 0) {
      console.log(`   - ${chatsSnap.size} chats supprimés.`);
    }

    // B. Supprimer tous les protocoles dans Firestore
    const protosRef = adminDb.collection('users').doc(uid).collection('protocols');
    const protosSnap = await protosRef.get();
    const protoBatch = adminDb.batch();
    protosSnap.docs.forEach(doc => {
      protoBatch.delete(protosRef.doc(doc.id));
    });
    await protoBatch.commit();
    if (protosSnap.size > 0) {
      console.log(`   - ${protosSnap.size} protocoles supprimés.`);
    }

    // C. Supprimer le profil utilisateur principal dans Firestore
    await adminDb.collection('users').doc(uid).delete();
    console.log(`   - Profil Firestore supprimé.`);

    // D. Supprimer le compte dans Firebase Authentication
    try {
      await adminAuth.deleteUser(uid);
      console.log(`   - Compte Firebase Auth supprimé.`);
    } catch (authErr: any) {
      // Si l'utilisateur n'existe pas dans Auth, on ignore l'erreur car on veut s'assurer que les données Firestore soient nettoyées
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
    }

    console.log(`✅ Utilisateur ${uid} et toutes ses données supprimés avec succès.`);
    return NextResponse.json({ success: true, message: "Utilisateur et ses données associés supprimés avec succès." });
  } catch (error: any) {
    console.error("❌ Erreur lors de la suppression de l'utilisateur :", error);
    return NextResponse.json({ error: error?.message || "Une erreur interne est survenue." }, { status: 500 });
  }
}
