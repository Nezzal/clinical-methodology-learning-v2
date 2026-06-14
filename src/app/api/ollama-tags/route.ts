import { NextResponse } from 'next/server';
import { loadEnvLocal } from '@/utils/env';

export async function GET() {
  loadEnvLocal();
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 secondes de timeout pour éviter de bloquer

    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: 'Impossible de récupérer les modèles depuis Ollama' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.warn('⚠️ [Ollama Tags Proxy] Impossible de contacter Ollama local :', error.message || error);
    return NextResponse.json({ error: 'Ollama est injoignable' }, { status: 503 });
  }
}
