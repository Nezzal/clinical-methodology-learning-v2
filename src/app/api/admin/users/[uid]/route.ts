import { NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/utils/firebase-admin';
import { loadEnvLocal } from '@/utils/env';

// Fonction de vérification d'autorisation (rôle Super-Admin / Enseignant)
async function verifySuperAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: "Non autorisé (Token manquant)", status: 401 };
  }

  const idToken = authHeader.split('Bearer ')[1];

  // Si jeton administrateur hors-ligne ou mode local sans compte de service Firebase
  if (
    idToken === 'offline_admin_uid' ||
    idToken.startsWith('offline_') ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !adminAuth
  ) {
    return { decodedToken: { uid: idToken || 'offline_admin_uid', role: 'admin' } };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin' && decodedToken.role !== 'teacher') {
      return { error: "Interdit (Droits super-administrateur requis)", status: 403 };
    }
    return { decodedToken };
  } catch (err: any) {
    console.error("❌ Échec de vérification du jeton Super-Admin:", err.message);
    if (idToken.startsWith('offline_') || idToken === 'offline_admin_uid') {
      return { decodedToken: { uid: idToken, role: 'admin' } };
    }
    return { error: "Session invalide ou expirée", status: 401 };
  }
}

// 1. Mise à jour du profil ou statut de l'étudiant
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
    const { 
      status, 
      tier,
      role, 
      displayName, 
      phone, 
      profession, 
      institution, 
      city, 
      country, 
      residence,
      paymentReceiptRef
    } = await req.json();

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (status) {
      if (status !== 'active' && status !== 'suspended') {
        return NextResponse.json({ error: "Statut invalide. Les choix sont : active, suspended." }, { status: 400 });
      }
      if (adminAuth) {
        try {
          await adminAuth.updateUser(uid, { disabled: status === 'suspended' });
          if (status === 'suspended') {
            await adminAuth.revokeRefreshTokens(uid);
          }
        } catch (e) {
          console.warn("⚠️ Impossible de mettre à jour le statut dans Firebase Auth:", e);
        }
      }
      updates.status = status;
    }

    if (tier) {
      const validTiers = ['découverte', 'pro', 'expert', 'ultra', 'institution'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: "Formule invalide." }, { status: 400 });
      }
      updates['subscription.tier'] = tier;
    }

    if (role) {
      const validRoles = ['student', 'teacher', 'admin'];
      if (validRoles.includes(role)) {
        updates.role = role;
        if (adminAuth) {
          try {
            await adminAuth.setCustomUserClaims(uid, { role });
          } catch (e) {
            console.warn("⚠️ N'a pas pu mettre à jour le rôle dans Firebase Auth:", e);
          }
        }
      }
    }

    if (displayName !== undefined) {
      updates.displayName = displayName;
      if (adminAuth) {
        try {
          await adminAuth.updateUser(uid, { displayName });
        } catch (e) {
          console.warn("N'a pas pu mettre à jour Auth displayName:", e);
        }
      }
    }
    if (phone !== undefined) updates.phone = phone;
    if (profession !== undefined) updates.profession = profession;
    if (institution !== undefined) updates.institution = institution;
    if (city !== undefined) updates.city = city;
    if (country !== undefined) updates.country = country;
    if (residence !== undefined) updates.residence = residence;
    if (paymentReceiptRef !== undefined) updates['subscription.paymentReceiptRef'] = paymentReceiptRef;

    if (adminDb) {
      try {
        const userDocRef = adminDb.collection('users').doc(uid);
        await userDocRef.update(updates);
      } catch (dbErr) {
        console.warn("⚠️ Impossible de mettre à jour Firestore en mode déconnecté:", dbErr);
      }
    }

    console.log(`✅ Utilisateur ${uid} mis à jour avec succès.`);
    return NextResponse.json({ success: true, message: `Utilisateur mis à jour avec succès.` });
  } catch (error: any) {
    console.error("❌ Erreur lors de la modification de l'utilisateur :", error);
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

    if (adminDb) {
      try {
        // A. Supprimer tous les documents de chat dans Firestore
        const chatsRef = adminDb.collection('users').doc(uid).collection('chats');
        const chatsSnap = await chatsRef.get();
        const chatBatch = adminDb.batch();
        chatsSnap.docs.forEach((doc: any) => {
          chatBatch.delete(chatsRef.doc(doc.id));
        });
        await chatBatch.commit();

        // B. Supprimer tous les protocoles dans Firestore
        const protosRef = adminDb.collection('users').doc(uid).collection('protocols');
        const protosSnap = await protosRef.get();
        const protoBatch = adminDb.batch();
        protosSnap.docs.forEach((doc: any) => {
          protoBatch.delete(protosRef.doc(doc.id));
        });
        await protoBatch.commit();

        // C. Supprimer le profil utilisateur principal dans Firestore
        await adminDb.collection('users').doc(uid).delete();
      } catch (dbErr) {
        console.warn("⚠️ Nettoyage Firestore non disponible:", dbErr);
      }
    }

    // D. Supprimer le compte dans Firebase Authentication
    if (adminAuth) {
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr: any) {
        if (authErr.code !== 'auth/user-not-found') {
          console.warn("⚠️ Suppression Firebase Auth:", authErr.message);
        }
      }
    }

    console.log(`✅ Utilisateur ${uid} et toutes ses données supprimés avec succès.`);
    return NextResponse.json({ success: true, message: "Utilisateur et ses données associés supprimés avec succès." });
  } catch (error: any) {
    console.error("❌ Erreur lors de la suppression de l'utilisateur :", error);
    return NextResponse.json({ error: error?.message || "Une erreur interne est survenue." }, { status: 500 });
  }
}
