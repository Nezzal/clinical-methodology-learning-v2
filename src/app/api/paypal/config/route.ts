import { NextResponse } from 'next/server';
import { loadEnvLocal } from '@/utils/env';

export async function GET() {
  loadEnvLocal();
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || 'test';
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  return NextResponse.json({ clientId, mode });
}
