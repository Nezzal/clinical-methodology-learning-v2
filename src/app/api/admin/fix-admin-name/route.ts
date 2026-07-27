import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/utils/firebase-admin';

export async function GET() {
  try {
    const adminEmails = [
      'nezzal.abdelmalek@gmail.com',
      'nezzal.abdelmalek@yahoo.fr',
      'admin@recif.dz'
    ];
    const targetName = 'Nezzal Abdelmalek';
    const updated: any[] = [];

    if (adminDb) {
      const usersSnap = await adminDb.collection('users').get();
      for (const doc of usersSnap.docs) {
        const data = doc.data();
        const email = (data.email || '').toLowerCase();
        const displayName = data.displayName || '';

        const isMatch = adminEmails.some(ae => email.includes(ae) || (data.displayName && data.displayName.toLowerCase().includes(ae)));

        if (isMatch || data.role === 'admin') {
          await adminDb.collection('users').doc(doc.id).set({
            displayName: targetName,
            firstName: 'Nezzal',
            lastName: 'Abdelmalek',
            role: 'admin',
            userType: 'admin',
            profession: 'Administrateur / Professeur',
            subscription: {
              ...(data.subscription || {}),
              tier: 'admin',
              status: 'active',
              updatedAt: new Date().toISOString()
            }
          }, { merge: true });

          if (adminAuth) {
            try {
              await adminAuth.updateUser(doc.id, { displayName: targetName });
            } catch (e) {
              console.warn("Auth update skipped for", doc.id);
            }
          }

          updated.push({
            id: doc.id,
            previousName: displayName,
            newName: targetName,
            email: data.email
          });
        }
      }

      // Also update access_requests if present
      const reqsSnap = await adminDb.collection('access_requests').get();
      for (const doc of reqsSnap.docs) {
        const data = doc.data();
        const email = (data.email || '').toLowerCase();
        if (adminEmails.some(ae => email.includes(ae))) {
          await adminDb.collection('access_requests').doc(doc.id).update({
            firstName: 'Nezzal',
            lastName: 'Abdelmalek',
            requestedTier: 'admin',
            tier: 'admin'
          });
        }
      }
    }

    return NextResponse.json({ success: true, count: updated.length, updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
