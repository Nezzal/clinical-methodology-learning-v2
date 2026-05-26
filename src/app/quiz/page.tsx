'use client';

import React, { useState, useEffect } from 'react';
import { getProgress, updateProgress, QuizAttempt } from '@/utils/storage';
import { useAuth } from '@/context/AuthContext';
import { syncUserProfile } from '@/utils/firestore';
import styles from './page.module.css';

interface Flashcard {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface Question {
  id: number;
  category: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

// 20 Chapters from RECIF TOC & Algerian law references for the dropdown
const RECIF_CHAPTERS = [
  "Loi algérienne n° 18-11 relative à la santé",
  "Rôle du Comité d'éthique médicale algérien (Art. 382)",
  "Calcul du nombre de sujets nécessaires (NSN)",
  "Biais de sélection, de mesure et de confusion",
  "Choix du critère de jugement principal",
  "Chapitre I : Question de recherche, hypothèse",
  "Chapitre II : La revue de la littérature",
  "Chapitre III : Ethique de la recherche",
  "Chapitre IV : Les études transversales",
  "Chapitre V : Les études cas-témoins",
  "Chapitre VI : Les études de cohorte",
  "Chapitre VII : Les essais cliniques",
  "Chapitre VIII : La méta-analyse",
  "Chapitre IX : Les études de stratégies diagnostiques",
  "Chapitre X : Les études économiques",
  "Chapitre XI : Les analyses de décision",
  "Chapitre XII : Biais et facteurs confondants",
  "Chapitre XIII : La rédaction du protocole",
  "Chapitre XIV : Les outils de mesure & questionnaires",
  "Chapitre XV : La mesure de la qualité de vie",
  "Chapitre XVI : Notions de statistiques pour le clinicien",
  "Chapitre XVIII : La rédaction médicale",
  "Chapitre XIX : Applicabilité et valorisation"
];

const DEFAULT_FLASHCARDS: Flashcard[] = [
  {
    id: 'fc_1',
    category: 'Biais & Méthodologie',
    question: 'Biais de confusion',
    answer: 'Distorsion de l\'association entre une exposition et une maladie par un troisième facteur (facteur de confusion) lié à la fois à l\'exposition et à la maladie.'
  },
  {
    id: 'fc_2',
    category: 'Biais & Méthodologie',
    question: 'Randomisation',
    answer: 'Répartition aléatoire des participants entre les groupes de traitement. C\'est la seule méthode permettant de répartir de façon équilibrée les facteurs de confusion connus et inconnus.'
  },
  {
    id: 'fc_3',
    category: 'Critères de Jugement',
    question: 'Critère de jugement principal',
    answer: 'Critère unique choisi à priori pour répondre à l\'objectif principal de l\'étude. C\'est sur ce critère que repose le calcul du nombre de sujets nécessaires (NSN).'
  },
  {
    id: 'fc_4',
    category: 'Statistiques',
    question: 'Puissance statistique (1 - Bêta)',
    answer: 'Probabilité de mettre en évidence une différence significative entre les traitements si cette différence existe réellement. Elle est couramment fixée à 80% ou 90%.'
  },
  {
    id: 'fc_5',
    category: 'Statistiques',
    question: 'Erreur Alpha (type I)',
    answer: 'Probabilité de conclure à tort qu\'il existe une différence significative alors qu\'il n\'y en a pas (faux positif). Classiquement fixée à 5%.'
  },
  {
    id: 'fc_6',
    category: 'Réglementation',
    question: 'Étude interventionnelle',
    answer: 'Étude sur l\'être humain comportant une intervention thérapeutique, préventive ou diagnostique (Art. 377 de la loi 18-11 en Algérie). Requiert l\'autorisation du Ministère de la Santé et l\'avis d\'un comité d\'éthique.'
  },
  {
    id: 'fc_7',
    category: 'Réglementation',
    question: 'Étude observationnelle',
    answer: 'Étude clinique purement épidémiologique ou pharmaco-épidémiologique, sans aucune intervention (Loi 18-11). Requiert également un avis du comité d\'éthique.'
  },
  {
    id: 'fc_8',
    category: 'Biais & Méthodologie',
    question: 'Double Insu (Double-Blind)',
    answer: 'Méthode où ni le patient ni le médecin investigateur ne connaissent le traitement attribué. Permet de prévenir les biais d\'évaluation et de comportement.'
  },
  {
    id: 'fc_9',
    category: 'Réglementation',
    question: 'Comité d\'éthique médicale',
    answer: 'Comité indépendant créé au niveau des services extérieurs chargés de la santé en Algérie pour évaluer les aspects éthiques et scientifiques de tout projet de recherche (Art. 382).'
  },
  {
    id: 'fc_10',
    category: 'Réglementation',
    question: 'Ministère de la Santé',
    answer: 'Autorité publique algérienne qui instruit et délivre l\'autorisation de réalisation d\'études cliniques sur l\'être humain dans un délai de trois (3) mois (Art. 381).'
  },
  {
    id: 'fc_11',
    category: 'Statistiques',
    question: 'Hypothèse Nulle (H0)',
    answer: 'Hypothèse de base selon laquelle il n\'y a pas de différence d\'effet entre les groupes comparés. Les tests statistiques cherchent à évaluer sa plausibilité.'
  },
  {
    id: 'fc_12',
    category: 'Biais & Méthodologie',
    question: 'Étude Cas-Témoins',
    answer: 'Étude observationnelle rétrospective comparant des malades (cas) à des non-malades (témoins). Adaptée aux maladies rares, elle permet de calculer l\'Odds Ratio.'
  }
];

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 1,
    category: 'Réglementation',
    question: 'En Algérie, selon la loi n° 18-11 relative à la santé, quelle autorité publique doit accorder son autorisation avant le démarrage d\'une étude clinique sur l\'être humain ?',
    options: [
      'L\'Ordre National des Médecins uniquement',
      'Le Wali de la wilaya concernée',
      'Le ministre chargé de la santé',
      'L\'Agence Nationale du Sang (ANS)'
    ],
    answerIndex: 2,
    explanation: 'Selon l\'article 381 de la loi n° 18-11 relative à la santé, les études cliniques sur l\'être humain sont subordonnées à l\'autorisation du ministre chargé de la santé, qui se prononce dans un délai de trois (3) mois.'
  },
  {
    id: 2,
    category: 'Biais & Méthodologie',
    question: 'Quel est l\'objectif principal du processus de randomisation dans un essai clinique contrôlé ?',
    options: [
      'Assurer que les patients reçoivent le meilleur traitement disponible',
      'Équilibrer les caractéristiques des patients (biais de confusion connus et inconnus) entre les groupes',
      'Empêcher le médecin de connaître le traitement administré (insu)',
      'Réduire la taille d\'échantillon nécessaire'
    ],
    answerIndex: 1,
    explanation: 'La randomisation permet de distribuer de manière aléatoire les facteurs pronostiques et de confusion (qu\'ils soient connus ou non) de façon équilibrée entre le groupe expérimental et le groupe contrôle.'
  },
  {
    id: 3,
    category: 'Statistiques',
    question: 'Que représente le risque d\'erreur de type I (Alpha) dans un test d\'hypothèse ?',
    options: [
      'La probabilité de conclure à tort à une différence significative (faux positif)',
      'La probabilité de ne pas détecter une différence qui existe (faux négatif)',
      'La probabilité que le protocole de soin ne soit pas respecté',
      'Le pourcentage de données manquantes toléré'
    ],
    answerIndex: 0,
    explanation: 'Le risque alpha est la probabilité de rejeter à tort l\'hypothèse nulle H0. C\'est-à-dire de conclure qu\'un traitement est efficace alors qu\'en réalité son effet est identique au placebo.'
  },
  {
    id: 4,
    category: 'Critères de Jugement',
    question: 'Parmi les caractéristiques suivantes, laquelle n\'est PAS requise pour un critère de jugement principal d\'après le manuel RECIF ?',
    options: [
      'Il doit être unique',
      'Il doit être cliniquement pertinent',
      'Il doit être mesurable de façon objective et reproductible',
      'Il doit être composite dans 100% des cas'
    ],
    answerIndex: 3,
    explanation: 'Un critère principal doit être unique et cliniquement pertinent. S\'il est parfois composite (associant plusieurs événements cliniques) pour augmenter la puissance, ce n\'est absolument pas une obligation réglementaire ou méthodologique.'
  },
  {
    id: 5,
    category: 'Biais & Méthodologie',
    question: 'Pour étudier l\'association entre une exposition et une maladie très rare, quel type de schéma d\'étude est le plus approprié méthodologiquement ?',
    options: [
      'Étude de cohorte prospective',
      'Essai clinique randomisé contrôlé',
      'Étude Cas-Témoins',
      'Étude transversale de prévalence'
    ],
    answerIndex: 2,
    explanation: 'L\'étude Cas-Témoins (rétrospective) est idéale pour les maladies rares. On recrute des cas (malades) et on cherche des témoins sains pour comparer leur exposition passée. Suivre une cohorte de sujets sains en attendant qu\'ils développent une maladie rare prendrait trop de temps et nécessiterait trop de sujets.'
  },
  {
    id: 6,
    category: 'Réglementation',
    question: 'En Algérie, en plus de l\'autorisation ministérielle, quel autre avis indépendant est obligatoirement requis avant d\'entamer une étude clinique (Art. 383 de la loi 18-11) ?',
    options: [
      'L\'avis d\'un jury de confrères hospitalo-universitaires',
      'L\'avis favorable d\'un comité d\'éthique médicale pour les études cliniques',
      'L\'approbation du Directeur Général du CHU',
      'Un avis du procureur de la République'
    ],
    answerIndex: 1,
    explanation: 'Conformément aux articles 382 et 383 de la loi n° 18-11 relative à la santé, toute étude clinique doit obligatoirement obtenir l\'avis favorable préalable d\'un comité d\'éthique médicale pour les études cliniques.'
  },
  {
    id: 7,
    category: 'Biais & Méthodologie',
    question: 'Qu\'implique une procédure d\'évaluation en "double insu" (double-blind) ?',
    options: [
      'Que le patient et son pharmacien ignorent le traitement',
      'Que le patient et l\'investigateur médical ignorent le traitement administré',
      'Que les biostatisticiens et les promoteurs ignorent les résultats',
      'Que l\'étude dispose de deux comités de surveillance différents'
    ],
    answerIndex: 1,
    explanation: 'Dans le double insu, le patient et le médecin investigateur ignorent le traitement reçu (actif ou comparateur). Cela évite les biais de comportement du patient et les biais d\'évaluation des critères par le médecin.'
  },
  {
    id: 8,
    category: 'Statistiques',
    question: 'Quelle est la valeur du risque d\'erreur alpha habituellement tolérée en recherche clinique ?',
    options: [
      '10% (p < 0.10)',
      '5% (p < 0.05)',
      '1% (p < 0.01)',
      '0.1% (p < 0.001)'
    ],
    answerIndex: 1,
    explanation: 'Le seuil de signification de 5% (erreur alpha = 0.05) est le standard académique universellement accepté en biostatistique pour rejeter l\'hypothèse nulle H0.'
  },
  {
    id: 9,
    category: 'Statistiques',
    question: 'Quelle mesure d\'association est calculée en priorité à l\'issue d\'une étude Cas-Témoins ?',
    options: [
      'Le Risque Relatif (RR)',
      'La réduction du risque absolu (RRA)',
      'L\'Odds Ratio (OR)',
      'Le taux d\'incidence'
    ],
    answerIndex: 2,
    explanation: 'Dans une étude Cas-Témoins, on ne connaît pas l\'incidence de la maladie car le nombre de malades est fixé artificiellement au départ par le chercheur. On ne peut donc pas calculer de Risque Relatif (RR), mais un Odds Ratio (OR) qui estime ce risque.'
  },
  {
    id: 10,
    category: 'Statistiques',
    question: 'La puissance statistique d\'une étude (1 - Bêta) est directement proportionnelle à :',
    options: [
      'L\'augmentation du nombre de sujets inclus',
      'La réduction de la différence d\'effet recherchée',
      'L\'augmentation de la variabilité (écart-type) du critère',
      'La réduction du risque d\'erreur alpha'
    ],
    answerIndex: 0,
    explanation: 'La puissance d\'une étude augmente si l\'on augmente la taille de l\'échantillon (plus de sujets inclus), si la différence attendue est grande, si la dispersion est faible ou si le risque alpha accepté est plus lâche.'
  }
];

export default function QuizPage() {
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState<'flashcards' | 'quiz'>('flashcards');

  // Helper pour sauvegarder localement et synchroniser avec Firestore
  const handleUpdateProgress = async (updater: (stats: any) => any) => {
    updateProgress(updater);
    if (user) {
      try {
        await syncUserProfile(user.uid, user.email, user.displayName, user.photoURL, getProgress());
      } catch (e) {
        console.error("Erreur de synchronisation des statistiques sur Firestore:", e);
      }
    }
  };

  // Flashcards & Quiz active lists (state-driven for dynamic generation)
  const [questionsList, setQuestionsList] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [cardsList, setCardsList] = useState<Flashcard[]>(DEFAULT_FLASHCARDS);
  const [isDynamic, setIsDynamic] = useState(false);
  const [currentDynamicTopic, setCurrentDynamicTopic] = useState('');

  // Generation state
  const [selectedChapter, setSelectedChapter] = useState(RECIF_CHAPTERS[0]);
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  // Flashcards flip & mastery state
  const [flippedCards, setFlippedCards] = useState<{ [key: string]: boolean }>({});
  const [masteredCards, setMasteredCards] = useState<string[]>([]);

  // Quiz execution state
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizFinished, setQuizFinished] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);

  useEffect(() => {
    const handleProgressChange = () => {
      const progress = getProgress();
      setMasteredCards(progress.flashcardsMastered || []);
      setQuizHistory(progress.quizHistory || []);
    };
    handleProgressChange();
    window.addEventListener('progress_changed', handleProgressChange);
    return () => {
      window.removeEventListener('progress_changed', handleProgressChange);
    };
  }, [user]);

  // Handler for custom dynamic material generation
  const handleGenerateMaterial = async (typeToGen: 'quiz' | 'flashcards') => {
    const topic = customTopic.trim() || selectedChapter;
    setGenerating(true);

    try {
      const response = await fetch('/api/generate-learning-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: typeToGen, topic })
      });

      const data = await response.json();

      if (response.ok && data.items) {
        if (typeToGen === 'quiz') {
          const formattedQuestions = data.items.map((q: any, index: number) => ({
            id: index + 1,
            category: topic,
            question: q.question,
            options: q.options,
            answerIndex: q.answerIndex,
            explanation: q.explanation
          }));
          setQuestionsList(formattedQuestions);
          setCurrentQuestionIdx(0);
          setSelectedOption(null);
          setCorrectAnswersCount(0);
          setQuizAnswered(false);
          setQuizFinished(false);
          setActiveMode('quiz');
        } else {
          const formattedCards = data.items.map((c: any, index: number) => ({
            id: `dynamic_fc_${index}_${Math.random()}`,
            category: topic,
            question: c.question,
            answer: c.answer
          }));
          setCardsList(formattedCards);
          setFlippedCards({});
          setActiveMode('flashcards');
        }
        setIsDynamic(true);
        setCurrentDynamicTopic(topic);
        setCustomTopic('');
      } else {
        throw new Error(data.error || 'Erreur de génération.');
      }
    } catch (e: any) {
      alert(`⚠️ Échec de la génération : ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Restores original clinical methodology database
  const handleRestoreDefaults = () => {
    setQuestionsList(DEFAULT_QUESTIONS);
    setCardsList(DEFAULT_FLASHCARDS);
    setIsDynamic(false);
    setCurrentDynamicTopic('');
    
    // Reset execution states
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setCorrectAnswersCount(0);
    setQuizAnswered(false);
    setQuizFinished(false);
    setFlippedCards({});
  };

  // Flashcards Handlers
  const handleCardClick = (id: string) => {
    setFlippedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleMastery = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Éviter de retourner la carte
    const isCurrentlyMastered = masteredCards.includes(id);
    let updated: string[];

    if (isCurrentlyMastered) {
      updated = masteredCards.filter((cardId) => cardId !== id);
    } else {
      updated = [...masteredCards, id];
    }

    setMasteredCards(updated);
    handleUpdateProgress(() => ({ flashcardsMastered: updated }));
  };

  const handleResetFlashcards = () => {
    if (confirm('Voulez-vous réinitialiser votre progression des flashcards ?')) {
      setMasteredCards([]);
      setFlippedCards({});
      handleUpdateProgress(() => ({ flashcardsMastered: [] }));
    }
  };

  // Quiz Handlers
  const handleOptionClick = (optionIdx: number) => {
    if (quizAnswered) return;
    setSelectedOption(optionIdx);
    setQuizAnswered(true);

    const question = questionsList[currentQuestionIdx];
    if (optionIdx === question.answerIndex) {
      setCorrectAnswersCount((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setQuizAnswered(false);

    if (currentQuestionIdx < questionsList.length - 1) {
      setCurrentQuestionIdx((prev) => prev + 1);
    } else {
      setQuizFinished(true);
      
      const finalCorrect = correctAnswersCount;
      const newAttempt: QuizAttempt = {
        id: Math.random().toString(36).substring(7),
        date: new Date().toISOString(),
        topic: isDynamic ? currentDynamicTopic : "Quiz d'Évaluation Officiel",
        correct: finalCorrect,
        total: questionsList.length,
        scorePct: Math.round((finalCorrect / questionsList.length) * 100)
      };

      // Enregistrer le score du quiz dans les statistiques globales
      handleUpdateProgress((stats) => {
        const updatedHistory = stats.quizHistory ? [newAttempt, ...stats.quizHistory] : [newAttempt];
        return {
          quizCorrect: stats.quizCorrect + finalCorrect,
          quizTotal: stats.quizTotal + questionsList.length,
          quizHistory: updatedHistory.slice(0, 50)
        };
      });
    }
  };

  const handleResetQuiz = () => {
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setCorrectAnswersCount(0);
    setQuizAnswered(false);
    setQuizFinished(false);
  };

  const handleClearGlobalQuizStats = () => {
    if (confirm('Voulez-vous réinitialiser l\'historique de vos scores et tentatives de quiz ?')) {
      handleUpdateProgress(() => ({
        quizCorrect: 0,
        quizTotal: 0,
        quizHistory: []
      }));
      alert('Historique et scores réinitialisés.');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Quiz & Flashcards RECIF</h1>
        <p className={styles.subtitle}>
          Entraînez-vous de manière interactive pour mémoriser les notions de recherche clinique et tester vos connaissances.
        </p>
      </header>

      {/* COMPOSANT PREMIUM : GÉNÉRATEUR IA DYNAMIQUE */}
      <section className="glass-card" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
          Générateur dynamique d'exercices par l'IA
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Générez de nouveaux exercices à l'infini en choisissant un chapitre du livre RECIF/loi algérienne ou en saisissant votre propre thématique clinique.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sélectionner un chapitre RECIF</label>
            <select 
              className="form-select" 
              value={selectedChapter} 
              onChange={(e) => setSelectedChapter(e.target.value)}
              disabled={generating}
            >
              {RECIF_CHAPTERS.map((chap, i) => (
                <option key={i} value={chap}>{chap}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ou saisir un thème personnalisé</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="ex. Les biais de sélection dans les cohortes..." 
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              disabled={generating}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleGenerateMaterial('flashcards')}
              disabled={generating}
              style={{ fontSize: '0.85rem', padding: '0.7rem 1rem' }}
            >
              Générer des Cartes
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => handleGenerateMaterial('quiz')}
              disabled={generating}
              style={{ fontSize: '0.85rem', padding: '0.7rem 1rem' }}
            >
              {generating ? 'Génération...' : 'Générer un Quiz'}
            </button>
          </div>
        </div>

        {isDynamic && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>
              Mode personnalisé activé : <strong>"{currentDynamicTopic}"</strong>
            </span>
            <button 
              className="btn btn-secondary" 
              onClick={handleRestoreDefaults}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            >
              Retour au programme officiel
            </button>
          </div>
        )}
      </section>

      {/* Selecteur de mode */}
      <div className={styles.toggleNav}>
        <button
          className={`${styles.toggleBtn} ${activeMode === 'flashcards' ? styles.activeToggle : ''}`}
          onClick={() => setActiveMode('flashcards')}
        >
          {isDynamic ? 'Flashcards générées (5)' : `Flashcards Mémos (${cardsList.length})`}
        </button>
        <button
          className={`${styles.toggleBtn} ${activeMode === 'quiz' ? styles.activeToggle : ''}`}
          onClick={() => setActiveMode('quiz')}
        >
          {isDynamic ? 'Quiz généré (5)' : `Quiz d'Évaluation (${questionsList.length})`}
        </button>
      </div>

      {/* Contenu du mode Flashcards */}
      {activeMode === 'flashcards' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Cartes maîtrisées : <strong>{masteredCards.filter(id => cardsList.some(c => c.id === id)).length} / {cardsList.length}</strong> ({Math.round((masteredCards.filter(id => cardsList.some(c => c.id === id)).length / cardsList.length) * 100) || 0}%)
            </span>
            {masteredCards.length > 0 && (
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleResetFlashcards}>
                Réinitialiser les cartes
              </button>
            )}
          </div>

          <div className={styles.flashcardGrid}>
            {cardsList.map((card) => {
              const isFlipped = !!flippedCards[card.id];
              const isMastered = masteredCards.includes(card.id);

              return (
                <div
                  key={card.id}
                  className={styles.cardContainer}
                  onClick={() => handleCardClick(card.id)}
                >
                  <div className={`${styles.cardInner} ${isFlipped ? styles.cardFlipped : ''}`}>
                    {/* Recto */}
                    <div className={styles.cardFront}>
                      {isMastered && <span className={styles.masteredBadge}>Acquis</span>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        {card.category}
                      </span>
                      <h4>{card.question}</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '1rem', opacity: 0.8 }}>
                        Cliquer pour retourner
                      </span>
                    </div>

                    {/* Verso */}
                    <div className={styles.cardBack}>
                      <p>{card.answer}</p>
                      <div className={styles.masteryActions}>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                          onClick={(e) => handleToggleMastery(e, card.id)}
                        >
                          {isMastered ? 'À réviser' : 'Je maîtrise ✓'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Contenu du mode Quiz */}
      {activeMode === 'quiz' && (
        <div className="animate-fade-in">
          {!quizFinished ? (
            <div className={`${styles.quizCard} glass-card`}>
              {/* Indicateur de progression */}
              <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${((currentQuestionIdx + 1) / questionsList.length) * 100}%` }}
                  />
                </div>
                <div className={styles.progressText}>
                  <span>Catégorie : <strong>{questionsList[currentQuestionIdx].category}</strong></span>
                  <span>Question {currentQuestionIdx + 1} sur {questionsList.length}</span>
                </div>
              </div>

              {/* Texte de la question */}
              <h3 className={styles.questionText}>
                {questionsList[currentQuestionIdx].question}
              </h3>

              {/* Options */}
              <div className={styles.optionsList}>
                {questionsList[currentQuestionIdx].options.map((option, idx) => {
                  const isCorrect = idx === questionsList[currentQuestionIdx].answerIndex;
                  const isSelected = idx === selectedOption;

                  let optClassName = '';
                  if (quizAnswered) {
                    if (isCorrect) optClassName = styles.correctOption;
                    else if (isSelected) optClassName = styles.wrongOption;
                  }

                  return (
                    <button
                      key={idx}
                      className={`${styles.optionBtn} ${optClassName}`}
                      onClick={() => handleOptionClick(idx)}
                      disabled={quizAnswered}
                    >
                      <span>{option}</span>
                      {quizAnswered && isCorrect && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {quizAnswered && isSelected && !isCorrect && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Boite d'explication */}
              {quizAnswered && (
                <div className={styles.explanationBox}>
                  <div className={styles.explanationTitle}>Explication Méthodologique :</div>
                  <p className={styles.explanationText}>
                    {questionsList[currentQuestionIdx].explanation}
                  </p>
                </div>
              )}

              {/* Pied de page du quiz */}
              <div className={styles.quizFooter}>
                {quizAnswered && (
                  <button className="btn btn-primary" onClick={handleNextQuestion}>
                    {currentQuestionIdx === questionsList.length - 1 ? 'Terminer le Quiz' : 'Question Suivante'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Ecran de résultats */
            <div className={`${styles.quizCard} glass-card styles.resultScreen`} style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.8rem', color: 'var(--accent-primary)', marginBottom: '1rem' }}>Quiz terminé !</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Voici votre bilan d'évaluation méthodologique :</p>
              
              <div className={styles.scoreCircle}>
                <span className={styles.scoreNum}>{correctAnswersCount} / {questionsList.length}</span>
                <span className={styles.scoreLabel}>Score</span>
              </div>

              <p className={styles.feedbackText}>
                {correctAnswersCount === questionsList.length ? '🥇 Score parfait ! Vous maîtrisez parfaitement ce thème.' :
                 correctAnswersCount >= Math.round(questionsList.length * 0.8) ? '🥈 Excellent travail ! Vos bases sont solides.' :
                 correctAnswersCount >= Math.round(questionsList.length * 0.5) ? '🥉 Niveau moyen. Relisez le cours ou interrogez le tuteur pour combler vos doutes.' :
                 '📚 Entraînez-vous encore ! Utilisez nos flashcards et posez des questions à notre tuteur virtuel.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={handleResetQuiz}>
                  Recommencer le Quiz
                </button>
                {isDynamic ? (
                  <button className="btn btn-secondary" onClick={handleRestoreDefaults}>
                    Quitter le Quiz personnalisé
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={() => setActiveMode('flashcards')}>
                    Réviser les Flashcards
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section Historique détaillé */}
          <section className={styles.historySection}>
            <div className={styles.historyHeader}>
              <h3 className={styles.historyTitle}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Historique des tentatives
              </h3>
              {quizHistory.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {quizHistory.length} tentative{quizHistory.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {quizHistory.length === 0 ? (
              <div className={styles.emptyHistory}>
                Aucune tentative de quiz enregistrée pour le moment.
              </div>
            ) : (
              <div className={styles.historyList}>
                {quizHistory.map((item) => {
                  let scoreClass = styles.scoreBad;
                  if (item.scorePct >= 80) scoreClass = styles.scoreExcellent;
                  else if (item.scorePct >= 50) scoreClass = styles.scoreAverage;

                  return (
                    <div key={item.id} className={styles.historyItem}>
                      <div className={styles.historyInfo}>
                        <span className={styles.historyTopic}>{item.topic}</span>
                        <span className={styles.historyDate}>
                          {new Date(item.date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className={`${styles.historyScore} ${scoreClass}`}>
                        {item.correct} / {item.total}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className={styles.resetActions}>
            <button className={styles.resetBtn} onClick={handleClearGlobalQuizStats}>
              Réinitialiser l'historique de mes scores et tentatives de quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
