import { NextResponse } from 'next/server';
import { adminDb } from '@/utils/firebase-admin';

export async function GET() {
  try {
    const targetKeywords = ['bouhidel', 'wissam', 'bouzegane', 'malik'];
    const updated: any[] = [];

    if (adminDb) {
      const usersSnap = await adminDb.collection('users').get();
      for (const doc of usersSnap.docs) {
        const data = doc.data();
        const searchStr = `${data.displayName || ''} ${data.firstName || ''} ${data.lastName || ''} ${data.email || ''}`.toLowerCase();
        const isMatch = targetKeywords.some(kw => searchStr.includes(kw));

        if (isMatch) {
          await adminDb.collection('users').doc(doc.id).set({
            subscription: {
              ...(data.subscription || {}),
              tier: 'ultra',
              status: 'active',
              updatedAt: new Date().toISOString()
            }
          }, { merge: true });

          updated.push({ id: doc.id, name: data.displayName || data.email, tier: 'ultra' });
        }
      }

      const reqsSnap = await adminDb.collection('access_requests').get();
      for (const doc of reqsSnap.docs) {
        const data = doc.data();
        const searchStr = `${data.firstName || ''} ${data.lastName || ''} ${data.email || ''}`.toLowerCase();
        const isMatch = targetKeywords.some(kw => searchStr.includes(kw));

        if (isMatch) {
          await adminDb.collection('access_requests').doc(doc.id).update({
            requestedTier: 'ultra',
            tier: 'ultra'
          });
        }
      }
    }

    return NextResponse.json({ success: true, count: updated.length, updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
