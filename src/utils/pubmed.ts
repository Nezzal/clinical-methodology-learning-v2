// src/utils/pubmed.ts

export interface PubMedArticle {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  doi?: string;
  authors: string[];
  abstract: string;
  pubTypes: string[];
  url: string;
}

export interface PubMedSearchOptions {
  retmax?: number;
  yearStart?: number;
  yearEnd?: number;
  publicationType?: string; // 'clinical_trial' | 'meta_analysis' | 'systematic_review' | 'review' | 'all'
  sort?: 'relevance' | 'pub_date';
}

function cleanXmlTags(str: string): string {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Découpe et extrait le contenu XML des articles PubMed retournés par efetch
 */
export function parsePubmedXml(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];
  const articleBlocks = xml.split('<PubmedArticle>');

  for (let i = 1; i < articleBlocks.length; i++) {
    const block = articleBlocks[i];

    // PMID
    const pmidMatch = block.match(/<PMID[^>]*>([\s\S]*?)<\/PMID>/);
    const pmid = pmidMatch ? cleanXmlTags(pmidMatch[1]) : '';
    if (!pmid) continue;

    // Article Title
    const titleMatch = block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleMatch ? cleanXmlTags(titleMatch[1]) : 'Titre non disponible';

    // Journal Title
    const journalMatch =
      block.match(/<Journal[^>]*>[\s\S]*?<Title[^>]*>([\s\S]*?)<\/Title>/) ||
      block.match(/<Journal[^>]*>[\s\S]*?<ISOAbbreviation[^>]*>([\s\S]*?)<\/ISOAbbreviation>/);
    const journal = journalMatch ? cleanXmlTags(journalMatch[1]) : 'Journal non spécifié';

    // Year
    let year = '';
    const yearMatch =
      block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) ||
      block.match(/<DateCompleted>[\s\S]*?<Year>(\d{4})<\/Year>/) ||
      block.match(/<DateRevised>[\s\S]*?<Year>(\d{4})<\/Year>/);
    if (yearMatch) {
      year = yearMatch[1];
    } else {
      year = 'N/A';
    }

    // DOI
    const doiMatch = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/);
    const doi = doiMatch ? cleanXmlTags(doiMatch[1]) : '';

    // Publication Types
    const pubTypes: string[] = [];
    const pubTypeRegex = /<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g;
    let ptMatch: RegExpExecArray | null;
    while ((ptMatch = pubTypeRegex.exec(block)) !== null) {
      const typeStr = cleanXmlTags(ptMatch[1]);
      if (typeStr) pubTypes.push(typeStr);
    }

    // Authors
    const authors: string[] = [];
    const authorListMatch = block.match(/<AuthorList[^>]*>([\s\S]*?)<\/AuthorList>/);
    if (authorListMatch) {
      const authorRegex = /<Author[^>]*>([\s\S]*?)<\/Author>/g;
      let authMatch: RegExpExecArray | null;
      while ((authMatch = authorRegex.exec(authorListMatch[1])) !== null) {
        const authBlock = authMatch[1];
        const lastName = cleanXmlTags((authBlock.match(/<LastName>([\s\S]*?)<\/LastName>/) || [])[1] || '');
        const initials = cleanXmlTags((authBlock.match(/<Initials>([\s\S]*?)<\/Initials>/) || authBlock.match(/<ForeName>([\s\S]*?)<\/ForeName>/) || [])[1] || '');
        const collectiveName = cleanXmlTags((authBlock.match(/<CollectiveName>([\s\S]*?)<\/CollectiveName>/) || [])[1] || '');

        if (collectiveName) {
          authors.push(collectiveName);
        } else if (lastName) {
          authors.push(`${lastName} ${initials}`.trim());
        }
      }
    }

    // Abstract
    let abstract = '';
    const abstractMatch = block.match(/<Abstract[^>]*>([\s\S]*?)<\/Abstract>/);
    if (abstractMatch) {
      const abstractTextRegex = /<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g;
      let absMatch: RegExpExecArray | null;
      const absParts: string[] = [];
      while ((absMatch = abstractTextRegex.exec(abstractMatch[1])) !== null) {
        const attrs = absMatch[1];
        const content = cleanXmlTags(absMatch[2]);
        const labelMatch = attrs.match(/Label="([^"]+)"/i);
        if (labelMatch && labelMatch[1]) {
          absParts.push(`${labelMatch[1]}: ${content}`);
        } else {
          absParts.push(content);
        }
      }
      abstract = absParts.join('\n\n') || cleanXmlTags(abstractMatch[1]);
    } else {
      abstract = 'Aucun résumé disponible dans PubMed.';
    }

    articles.push({
      pmid,
      title,
      journal,
      year,
      doi,
      authors: authors.length > 0 ? authors : ['Auteur non spécifié'],
      abstract,
      pubTypes,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }

  return articles;
}

/**
 * Recherche des articles sur PubMed via NCBI Entrez API
 */
export async function searchPubMed(query: string, options: PubMedSearchOptions = {}): Promise<PubMedArticle[]> {
  const { retmax = 10, yearStart, yearEnd, publicationType, sort = 'relevance' } = options;

  let term = query.trim();

  // Ajouter les filtres de type de publication
  if (publicationType === 'clinical_trial') {
    term += ' AND (clinical trial[Filter] OR randomized controlled trial[Filter])';
  } else if (publicationType === 'meta_analysis') {
    term += ' AND meta-analysis[Filter]';
  } else if (publicationType === 'systematic_review') {
    term += ' AND systematic review[Filter]';
  } else if (publicationType === 'review') {
    term += ' AND review[Filter]';
  }

  // Ajouter les filtres d'année
  if (yearStart && yearEnd) {
    term += ` AND (${yearStart}:${yearEnd}[dp])`;
  } else if (yearStart) {
    term += ` AND (${yearStart}:3000[dp])`;
  } else if (yearEnd) {
    term += ` AND (1800:${yearEnd}[dp])`;
  }

  const encodedTerm = encodeURIComponent(term);
  let searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedTerm}&retmode=json&retmax=${retmax}`;
  
  if (sort === 'pub_date') {
    searchUrl += '&sort=pub_date';
  }

  const searchRes = await fetch(searchUrl, { cache: 'no-store' });
  if (!searchRes.ok) {
    throw new Error(`Erreur lors de la recherche PubMed (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  const ids: string[] = searchData.esearchresult?.idlist || [];

  if (ids.length === 0) {
    return [];
  }

  return fetchArticlesByPmids(ids);
}

/**
 * Récupère les détails XML complets de plusieurs articles PubMed par leurs PMIDs
 */
export async function fetchArticlesByPmids(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
  const res = await fetch(fetchUrl, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Erreur lors du téléchargement des données PubMed (${res.status})`);
  }

  const xmlText = await res.text();
  return parsePubmedXml(xmlText);
}
