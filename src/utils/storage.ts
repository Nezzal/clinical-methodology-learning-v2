export interface QuizAttempt {
  id: string;
  date: string;
  topic: string;
  correct: number;
  total: number;
  scorePct: number;
}

export interface LocalStats {
  questionsAsked: number;
  protocolsGenerated: number;
  quizCorrect: number;
  quizTotal: number;
  flashcardsMastered: string[]; // List of card IDs
  recentQuestions: string[];
  recentProtocols: Array<{
    id: string;
    title: string;
    acronym: string;
    date: string;
    content: string;
    crfContent?: string | null;
    formData?: any;
  }>;
  recentArticles?: Array<{
    id: string;
    title: string;
    studyType: string;
    date: string;
    content: string;
    formData?: any;
  }>;
  recentSyntheses?: Array<{
    id: string;
    query: string;
    title: string;
    date: string;
    articlesCount: number;
    content: string;
    articles: any[];
    provider?: string;
  }>;
  quizHistory?: QuizAttempt[];
}

const DEFAULT_STATS: LocalStats = {
  questionsAsked: 0,
  protocolsGenerated: 0,
  quizCorrect: 0,
  quizTotal: 0,
  flashcardsMastered: [],
  recentQuestions: [],
  recentProtocols: [],
  recentArticles: [],
  recentSyntheses: [],
  quizHistory: []
};


const STORAGE_KEY = 'recif_methodology_progress';

export function getProgress(): LocalStats {
  if (typeof window === 'undefined') return DEFAULT_STATS;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : DEFAULT_STATS;
  } catch (e) {
    console.error('Error reading localStorage', e);
    return DEFAULT_STATS;
  }
}

export function saveProgress(stats: LocalStats) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    // Dispatch a custom event to notify other components of changes
    window.dispatchEvent(new Event('progress_changed'));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
}

export function updateProgress(updater: (stats: LocalStats) => Partial<LocalStats>) {
  const current = getProgress();
  const updates = updater(current);
  saveProgress({ ...current, ...updates });
}

export function resetProgress() {
  saveProgress(DEFAULT_STATS);
}

// ===========================================
// STOCKAGE DÉDIÉ SÉCURISÉ DES SYNTHÈSES BIBLIO
// ===========================================
const SYNTHESES_STORAGE_KEY = 'recif_saved_syntheses_list';

export function getSavedSynthesesFromLocal(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(SYNTHESES_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Fallback aux anciennes statistiques
    const stats = getProgress();
    return stats.recentSyntheses || [];
  } catch (e) {
    console.error('Error reading saved syntheses', e);
    return [];
  }
}

export function saveSynthesesToLocal(list: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNTHESES_STORAGE_KEY, JSON.stringify(list));
    // Egalement synchro dans les stats pour compatibilité ascendance
    const current = getProgress();
    saveProgress({ ...current, recentSyntheses: list.slice(0, 15) });
  } catch (e) {
    console.error('Error saving syntheses to localStorage', e);
  }
}
