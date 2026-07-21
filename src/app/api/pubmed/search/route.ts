import { NextResponse } from 'next/server';
import { verifyUserAuth } from '@/utils/firebase-admin';
import { searchPubMed, PubMedSearchOptions } from '@/utils/pubmed';

export async function POST(req: Request) {
  try {
    const authCheck = await verifyUserAuth(req);
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { query, retmax, yearStart, yearEnd, publicationType, sort } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'La requête de recherche (query) est requise.' }, { status: 400 });
    }

    const options: PubMedSearchOptions = {
      retmax: typeof retmax === 'number' ? Math.min(Math.max(retmax, 1), 30) : 10,
      yearStart: typeof yearStart === 'number' ? yearStart : undefined,
      yearEnd: typeof yearEnd === 'number' ? yearEnd : undefined,
      publicationType: typeof publicationType === 'string' ? publicationType : undefined,
      sort: sort === 'pub_date' ? 'pub_date' : 'relevance',
    };

    console.log(`🔎 [PubMed API] Recherche en cours : "${query}" (retmax: ${options.retmax})`);
    const articles = await searchPubMed(query, options);
    console.log(`✅ [PubMed API] ${articles.length} articles trouvés.`);

    return NextResponse.json({ articles });
  } catch (error: any) {
    console.error('❌ [PubMed API] Erreur lors de la recherche PubMed:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne lors de l\'interrogation de PubMed.' },
      { status: 500 }
    );
  }
}
