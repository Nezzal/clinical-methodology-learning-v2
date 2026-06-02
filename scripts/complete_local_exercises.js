const fs = require('fs');
const path = require('path');

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

// Helper to categorize chapters
function getChapterGroup(chapter) {
  if (
    chapter.includes("18-11") || 
    chapter.includes("Comité d'éthique") || 
    chapter.includes("Ethique de la recherche")
  ) {
    return "ethics";
  } else if (
    chapter.includes("transversales") || 
    chapter.includes("cas-témoins") || 
    chapter.includes("cohorte") || 
    chapter.includes("essais") || 
    chapter.includes("méta-analyse") || 
    chapter.includes("diagnostiques") || 
    chapter.includes("économiques") || 
    chapter.includes("décision")
  ) {
    return "methodology";
  } else if (
    chapter.includes("NSN") || 
    chapter.includes("statistiques")
  ) {
    return "statistics";
  } else if (
    chapter.includes("Biais") || 
    chapter.includes("critère de jugement")
  ) {
    return "bias";
  } else {
    return "design";
  }
}

// Local Exercise Generators
function generateQuizForChapter(chapter) {
  const group = getChapterGroup(chapter);

  if (group === "ethics") {
    return [
      {
        question: `Dans le cadre de l'application pratique de "${chapter}", quelle est l'exigence éthique fondamentale concernant le consentement du patient ?`,
        options: [
          "Le recueil obligatoire par écrit du consentement libre, éclairé et exprès du participant.",
          "Une simple information verbale par l'investigateur principal suffit.",
          "Le consentement n'est requis que si l'étude comporte un bénéfice individuel direct.",
          "La signature d'un témoin neutre remplace obligatoirement celle du patient dans 100% des cas."
        ],
        answerIndex: 0,
        explanation: `Conformément à la réglementation et aux exigences de "${chapter}", tout participant à une recherche biomédicale doit exprimer son consentement par écrit après avoir reçu une information claire et compréhensible.`
      },
      {
        question: `Selon les principes éthiques décrits dans "${chapter}", quel est le rôle d'un Comité d'éthique médicale (CEM) lors de l'évaluation d'un protocole ?`,
        options: [
          "Financer le projet de recherche clinique.",
          "Évaluer la conformité scientifique, méthodologique et la protection éthique des participants.",
          "Rédiger le protocole de recherche à la place du chercheur.",
          "Sélectionner les investigateurs et le promoteur de l'étude."
        ],
        answerIndex: 1,
        explanation: "Le Comité d'éthique médicale a pour mandat d'évaluer de manière indépendante les aspects éthiques, déontologiques et la pertinence scientifique des projets de recherche avant leur démarrage."
      },
      {
        question: `Sous l'égide de "${chapter}", quelle mesure prévient le biais de sélection lors de l'évaluation éthique d'un échantillon de recherche ?`,
        options: [
          "Garantir des critères d'inclusion et d'exclusion équitables et non discriminatoires pour la population cible.",
          "Sélectionner uniquement les patients les plus faciles d'accès.",
          "Modifier les critères en cours de recrutement.",
          "Exclure systématiquement les patients issus de Wilayas éloignées."
        ],
        answerIndex: 0,
        explanation: "Pour assurer la validité externe et respecter la justice éthique, les critères de recrutement doivent être équitables et scientifiquement justifiés, limitant ainsi le biais de sélection."
      },
      {
        question: `Comment la réglementation "${chapter}" aborde-t-elle l'analyse statistique des données cliniques recueillies ?`,
        options: [
          "Elle exige la pseudonymisation ou l'anonymisation stricte des données pour protéger le secret médical.",
          "Elle autorise la publication des noms des patients pour valoriser leur participation.",
          "Elle ne formule aucune exigence sur le traitement informatique des données.",
          "Elle impose de stocker les données sur des serveurs publics non cryptés."
        ],
        answerIndex: 0,
        explanation: "La protection des données personnelles et le respect du secret médical (confidentialité) sont des obligations de base imposées par la loi algérienne et l'éthique médicale."
      },
      {
        question: `En cas de non-respect des règles éthiques et administratives définies dans "${chapter}", quelle est la conséquence méthodologique majeure ?`,
        options: [
          "L'invalidation des données collectées, le rejet des publications et des poursuites disciplinaires ou pénales.",
          "Une simple demande de soumission a posteriori sans autre conséquence.",
          "La modification unilatérale des objectifs statistiques de l'étude.",
          "Aucune conséquence si le promoteur de l'étude est un CHU public."
        ],
        answerIndex: 0,
        explanation: "La réalisation d'une recherche clinique sans avis favorable du Comité d'éthique ou sans autorisation réglementaire invalide scientifiquement l'étude et expose les auteurs à des sanctions sévères."
      }
    ];
  } else if (group === "methodology") {
    return [
      {
        question: `Dans le cadre de l'organisation d'une étude de type "${chapter}", quel est l'objectif prioritaire pour définir le critère de jugement principal ?`,
        options: [
          "Il doit être unique, mesurable de façon objective, cliniquement pertinent et défini a priori.",
          "Il doit être multiple pour augmenter la chance d'obtenir un résultat significatif.",
          "Il peut être sélectionné en cours d'analyse après avoir examiné les données récoltées.",
          "Il doit être subjectif pour s'adapter à l'avis personnel de chaque clinicien."
        ],
        answerIndex: 0,
        explanation: "Selon les principes méthodologiques du RECIF, le critère principal doit être unique, mesurable objectivement et fixé a priori dans le protocole afin d'éviter les analyses exploratoires multiples (biais de multiplicité)."
      },
      {
        question: `Quel est l'avantage ou la spécificité méthodologique majeure du schéma d'étude de type "${chapter}" ?`,
        options: [
          "Sa capacité à répondre à une question clinique précise avec un niveau de preuve adapté au type de schéma (descriptif, étiologique ou évaluatif).",
          "Il élimine systématiquement tous les biais de confusion par nature.",
          "Il fournit toujours un niveau de preuve scientifique de Grade A supérieur à tous les autres schémas.",
          "Il ne requiert aucune planification statistique préalable."
        ],
        answerIndex: 0,
        explanation: "Chaque schéma d'étude clinique possède des indications méthodologiques précises (ex. transversal pour la prévalence, cas-témoins pour les maladies rares, cohorte pour l'incidence) qui déterminent son niveau de preuve."
      },
      {
        question: `Quel biais de recherche menace particulièrement la validité interne d'une étude de type "${chapter}" ?`,
        options: [
          "Le biais de sélection (échantillon non représentatif) ou le biais d'information (mesures imprécises ou déclarations erronées).",
          "Le biais de randomisation, car la randomisation est obligatoire dans ce schéma.",
          "L'erreur bêta, car elle correspond toujours à un biais systématique de mesure.",
          "Le biais de publication, car il n'affecte que les études négatives."
        ],
        answerIndex: 0,
        explanation: "La validité interne des études observationnelles ou interventionnelles est fréquemment menacée par des biais de sélection (si le recrutement est biaisé) et de mesure (si les données sont mal collectées ou sujettes à des erreurs de rappel)."
      },
      {
        question: `Comment justifie-t-on statistiquement le dimensionnement de l'échantillon pour "${chapter}" ?`,
        options: [
          "En réalisant un calcul du Nombre de Sujets Nécessaires (NSN) basé sur la puissance statistique (1 - bêta) et le risque alpha (5%).",
          "En fixant arbitrairement la taille à 100 patients pour des facilités de calcul.",
          "Le dimensionnement n'a aucun impact sur la validité scientifique dans ce type d'étude.",
          "En doublant systématiquement la taille d'échantillon préconisée par d'autres études."
        ],
        answerIndex: 0,
        explanation: "Un dimensionnement rigoureux (NSN) garantit une puissance statistique suffisante pour détecter une différence cliniquement significative si elle existe, tout en évitant d'inclure inutilement des patients."
      },
      {
        question: `Quelle obligation éthique régit la mise en œuvre de "${chapter}" selon les principes du RECIF et la loi algérienne ?`,
        options: [
          "L'obtention de l'avis favorable du Comité d'éthique médicale compétent et l'information/consentement des participants.",
          "Aucune obligation éthique si l'investigateur principal réalise l'étude sur son propre service.",
          "Le droit de publier les résultats nominatifs des patients sans leur accord écrit.",
          "L'obligation de rémunérer financièrement tous les patients inclus dans l'étude."
        ],
        answerIndex: 0,
        explanation: "Toute étude clinique, quel que soit son schéma, doit respecter le secret médical, obtenir l'avis du CEM et s'assurer du consentement libre et éclairé des participants."
      }
    ];
  } else if (group === "statistics") {
    return [
      {
        question: `Dans le cadre de "${chapter}", quelle est la définition exacte du risque d'erreur de type I (Alpha) ?`,
        options: [
          "La probabilité de conclure à tort à une différence significative alors qu'elle n'existe pas (faux positif).",
          "La probabilité de ne pas détecter une différence réelle entre les groupes (faux négatif).",
          "La probabilité que les critères d'éligibilité ne soient pas respectés par l'investigateur.",
          "Le pourcentage de patients perdus de vue lors du suivi clinique."
        ],
        answerIndex: 0,
        explanation: "Le risque alpha (type I) est la probabilité de rejeter à tort l'hypothèse nulle (H0) concluant à tort à une efficacité ou une différence qui n'existe pas en réalité. Traditionnellement fixé à 5%."
      },
      {
        question: `Quel est l'impact d'une augmentation de la puissance statistique (1 - Bêta) sur le dimensionnement d'une étude selon "${chapter}" ?`,
        options: [
          "Elle augmente le nombre de sujets nécessaires (NSN).",
          "Elle réduit le nombre de sujets nécessaires (NSN).",
          "Elle n'a aucune influence sur la taille de l'échantillon.",
          "Elle élimine automatiquement tous les biais de sélection."
        ],
        answerIndex: 0,
        explanation: "Augmenter la puissance statistique (par exemple de 80% à 90%) signifie que l'on veut être plus sûr de détecter une différence réelle. Cela nécessite d'inclure plus de patients (NSN plus grand)."
      },
      {
        question: `Dans "${chapter}", quel est le rôle principal de l'hypothèse nulle (H0) lors d'un test statistique ?`,
        options: [
          "Poser le principe qu'il n'y a pas de différence ou d'effet entre les groupes comparés.",
          "Formuler l'hypothèse clinique que le chercheur cherche absolument à valider.",
          "Définir la logistique et les coûts prévisionnels de la recherche.",
          "Fixer le nombre exact d'échecs tolérés avant l'arrêt de l'étude."
        ],
        answerIndex: 0,
        explanation: "L'hypothèse nulle H0 stipule qu'il n'y a aucune différence d'effet entre les deux groupes comparés. C'est cette hypothèse que les tests statistiques cherchent à rejeter ou à ne pas rejeter."
      },
      {
        question: `Comment la variabilité (écart-type) du critère de jugement principal influence-t-elle le calcul du NSN dans "${chapter}" ?`,
        options: [
          "Plus la variabilité est grande, plus le nombre de sujets nécessaires (NSN) sera élevé pour surmonter le bruit de fond.",
          "Une grande variabilité permet de réduire la taille de l'échantillon.",
          "La variabilité n'intervient jamais dans le calcul du NSN.",
          "Elle est compensée uniquement en modifiant le seuil alpha à 10%."
        ],
        answerIndex: 0,
        explanation: "L'écart-type mesure la dispersion des données. Une dispersion importante (forte variabilité) exige d'inclure davantage de sujets pour démontrer de manière statistiquement significative une différence d'effet."
      },
      {
        question: `Selon les principes éthiques et méthodologiques de "${chapter}", pourquoi est-il inacceptable de mener une étude clinique sous-dimensionnée (puissance insuffisante) ?`,
        options: [
          "Elle expose des patients à des risques ou des contraintes sans chance réelle de conclure scientifiquement.",
          "Elle est trop coûteuse financièrement pour le promoteur hospitalier.",
          "Elle réduit automatiquement le niveau académique de l'investigateur principal.",
          "Elle enfreint la législation commerciale sur le monopole des médicaments."
        ],
        answerIndex: 0,
        explanation: "D'un point de vue éthique, inclure des sujets dans une étude qui n'a pas la puissance nécessaire pour répondre à sa question de recherche est un gâchis de ressources et une exposition injustifiée des patients à des risques."
      }
    ];
  } else if (group === "bias") {
    return [
      {
        question: `Dans le cadre de "${chapter}", comment définit-on un facteur de confusion ?`,
        options: [
          "Une variable liée à la fois à l'exposition et à la maladie, capable de fausser l'association observée.",
          "Une erreur aléatoire de mesure commise par l'ARC lors de la saisie.",
          "Un patient qui ne respecte pas les critères d'éligibilité fixés dans le protocole.",
          "Une réaction indésirable grave survenue en cours d'essai clinique."
        ],
        answerIndex: 0,
        explanation: "Un facteur de confusion est un tiers paramètre associé à la fois au facteur d'exposition et au critère de jugement, créant une association artificielle ou masquant une association réelle s'il n'est pas contrôlé."
      },
      {
        question: `Quelle méthode méthodologique permet de contrôler les biais de confusion au moment de l'analyse statistique dans "${chapter}" ?`,
        options: [
          "L'analyse multivariée (modèles de régression) ou la stratification.",
          "La randomisation en bloc au moment de l'inclusion.",
          "L'utilisation d'un questionnaire standardisé uniquement.",
          "Le double insu lors de l'évaluation clinique."
        ],
        answerIndex: 0,
        explanation: "Alors que la randomisation contrôle la confusion à la conception de l'étude, l'ajustement statistique (analyse multivariée, régression) et la stratification permettent de la contrôler a posteriori lors de l'analyse."
      },
      {
        question: `Le biais de sélection dans "${chapter}" est caractérisé par :`,
        options: [
          "Une différence systématique entre la population incluse dans l'étude et la population cible réelle.",
          "Une erreur systématique de dosage dans le laboratoire d'analyses médicales.",
          "L'absence de recueil écrit du consentement libre et éclairé du patient.",
          "Un échantillon trop grand induisant une puissance excessive."
        ],
        answerIndex: 0,
        explanation: "Le biais de sélection survient lorsque la méthode de recrutement sélectionne un échantillon non représentatif de la population générale à laquelle on souhaite appliquer les conclusions de l'étude."
      },
      {
        question: `Pour éviter un biais de mesure ou d'évaluation (biais d'information) dans "${chapter}", quelle mesure est préconisée ?`,
        options: [
          "L'utilisation d'outils de mesure standardisés et le recours au double insu (aveugle) si applicable.",
          "L'augmentation unilatérale de la taille de l'échantillon (NSN).",
          "L'exclusion des patients ayant des antécédents médicaux complexes.",
          "Le choix d'un critère de jugement principal subjectif."
        ],
        answerIndex: 0,
        explanation: "Standardiser les critères d'évaluation et masquer l'attribution des groupes aux évaluateurs (insu) évite les erreurs de classification ou les biais d'interprétation subjectifs."
      },
      {
        question: `Selon la Loi algérienne n° 18-11, quel enjeu éthique est lié au contrôle des biais de recherche décrits dans "${chapter}" ?`,
        options: [
          "Garantir la validité interne de la recherche pour assurer que les conclusions sont fiables et bénéfiques à la santé publique.",
          "Faciliter l'obtention automatique de brevets industriels.",
          "Permettre de recruter des patients sans passer par le Comité d'éthique médicale.",
          "Éviter les contrôles des inspecteurs du Ministère de la Santé."
        ],
        answerIndex: 0,
        explanation: "Un protocole entaché de biais méthodologiques produit des résultats faux, ce qui est éthiquement inacceptable car cela peut induire la communauté médicale en erreur et nuire aux patients."
      }
    ];
  } else { // group === "design"
    return [
      {
        question: `Dans le cadre de "${chapter}", quelle est l'importance méthodologique de formuler une question de recherche claire (PICO) ?`,
        options: [
          "Elle guide le choix du schéma d'étude, la définition de la population cible et le choix du critère de jugement.",
          "Elle est uniquement demandée pour des raisons administratives sans utilité pratique.",
          "Elle permet d'éviter de faire une revue de la littérature scientifique.",
          "Elle garantit d'obtenir des résultats positifs dans 100% des cas."
        ],
        answerIndex: 0,
        explanation: "Une question claire (spécifiant Population, Intervention, Comparateur, Outcome) structure toute la recherche et détermine la pertinence méthodologique du protocole."
      },
      {
        question: `Selon les principes de "${chapter}", comment doit être formulée l'hypothèse clinique principale de l'étude ?`,
        options: [
          "Elle doit être formulée a priori de manière claire, réfutable et mesurable.",
          "Elle doit être rédigée après l'analyse descriptive des résultats.",
          "Elle doit rester la plus floue possible pour s'adapter à toutes les observations.",
          "Elle doit toujours postuler qu'il n'y a aucun intérêt thérapeutique."
        ],
        answerIndex: 0,
        explanation: "L'hypothèse principale est la réponse théorique à la question de recherche. Elle doit être établie a priori et être formulée de façon à pouvoir être testée statistiquement (réfutable)."
      },
      {
        question: `Quel élément de structure est indispensable lors de la rédaction d'un protocole de recherche clinique d'après "${chapter}" ?`,
        options: [
          "Le rationnel scientifique (justification), la méthodologie détaillée, le plan d'analyse statistique et les aspects réglementaires.",
          "Les CV détaillés de tous les patients inclus dans l'étude.",
          "La garantie écrite de publication dans des revues internationales de premier rang.",
          "La liste des marques commerciales de tous les médicaments utilisés."
        ],
        answerIndex: 0,
        explanation: "Un protocole formalisé selon le RECIF doit couvrir de manière structurée l'état des connaissances, la méthodologie (critères, schéma, NSN), le plan de gestion des données et les considérations éthiques."
      },
      {
        question: `Dans "${chapter}", pourquoi la revue de la littérature (recherche bibliographique) doit-elle précéder la conception de l'étude ?`,
        options: [
          "Pour justifier le rationnel scientifique de l'étude, identifier les lacunes et s'assurer que l'étude n'a pas déjà été faite.",
          "Pour copier la méthodologie d'une autre étude sans l'adapter.",
          "Pour occuper les étudiants et les ARC en début de recherche.",
          "Parce que c'est une exigence commerciale du Ministère de la Santé."
        ],
        answerIndex: 0,
        explanation: "La revue de la littérature valide l'originalité et la pertinence scientifique de la recherche, tout en aidant à anticiper les biais et à sélectionner les meilleurs critères d'évaluation."
      },
      {
        question: `Selon la Loi algérienne n° 18-11, quel aspect réglementaire doit figurer obligatoirement dans un protocole conçu selon "${chapter}" ?`,
        options: [
          "L'avis préalable du Comité d'éthique médicale (Art. 382) et le formulaire d'information/consentement destiné au patient.",
          "L'autorisation de commercialisation du médicament testé.",
          "La preuve d'une assurance responsabilité civile privée pour tous les investigateurs.",
          "L'accord formel du chef de service de l'établissement public."
        ],
        answerIndex: 0,
        explanation: "La conformité éthique et légale (Loi 18-11) impose de décrire le processus de recueil de consentement écrit et la soumission éthique au CEM directement dans le corps du protocole."
      }
    ];
  }
}

function generateFlashcardsForChapter(chapter) {
  const group = getChapterGroup(chapter);

  if (group === "ethics") {
    return [
      {
        question: `Loi algérienne 18-11 & Consentement`,
        answer: "Le consentement libre, éclairé et écrit est requis obligatoirement avant toute inclusion (Art. 386). Si le patient ne peut signer, un représentant légal ou une méthode autorisée doit intervenir."
      },
      {
        question: `Rôle du Comité d'Éthique`,
        answer: "Le CEM évalue indépendamment la conformité scientifique et la protection des participants pour tout projet de recherche clinique (Art. 382)."
      },
      {
        question: `Confidentialité des données de santé`,
        answer: "Le protocole de recherche doit détailler les mesures d'anonymisation et de stockage sécurisé pour respecter le secret médical."
      },
      {
        question: `Biais de sélection en recrutement`,
        answer: "Pour éviter d'introduire des inégalités d'accès à l'étude ou des biais de sélection, les critères d'éligibilité doivent être équitables et médicalement fondés."
      },
      {
        question: `Conséquence d'un protocole non conforme`,
        answer: "Toute recherche clinique menée sans avis favorable du CEM ou sans autorisation est illégale et entraîne l'invalidation scientifique des données collectées."
      }
    ];
  } else if (group === "methodology") {
    return [
      {
        question: `Critère de jugement principal`,
        answer: "Critère unique, mesurable de façon objective et reproductible, cliniquement pertinent et fixé a priori dans le protocole pour répondre à l'objectif principal."
      },
      {
        question: `Schéma d'étude adapté`,
        answer: "Le plan d'étude doit correspondre aux objectifs (transversal pour la prévalence, cas-témoins pour les facteurs de risque/maladies rares, cohorte pour l'incidence)."
      },
      {
        question: `Biais systématique de mesure`,
        answer: "Biais d'information lié à des outils non standardisés ou à la subjectivité des évaluateurs. À minimiser par des protocoles stricts et le recours à l'aveugle."
      },
      {
        question: `Justification de l'échantillon (NSN)`,
        answer: "Le calcul de la taille minimale d'échantillon repose sur la puissance statistique attendue (1-bêta), le risque alpha (5%) et la différence clinique minimale recherchée."
      },
      {
        question: `Avis favorable du Comité d'éthique`,
        answer: "Aucune étude, qu'elle soit observationnelle ou interventionnelle, ne peut démarrer sans avoir reçu l'approbation du CEM pour la protection des participants."
      }
    ];
  } else if (group === "statistics") {
    return [
      {
        question: `Risque Alpha (type I)`,
        answer: "Probabilité de conclure à tort à une différence statistiquement significative entre les traitements alors que les effets sont équivalents (faux positif)."
      },
      {
        question: `Puissance statistique (1-Bêta)`,
        answer: "Probabilité de détecter une différence d'effet statistiquement significative si cette différence existe réellement. Classiquement fixée à 80% ou 90%."
      },
      {
        question: `Hypothèse Nulle (H0)`,
        answer: "Postulat de base selon lequel il n'y a pas de différence d'effet entre les groupes comparés. C'est l'hypothèse que le chercheur tente de rejeter."
      },
      {
        question: `Dispersion (Écart-type)`,
        answer: "Plus l'écart-type du critère de jugement est grand, plus le bruit de fond est important, ce qui nécessite une plus grande taille d'échantillon (NSN)."
      },
      {
        question: `Risque Bêta (type II)`,
        answer: "Probabilité de ne pas détecter une différence significative d'effet alors qu'elle existe réellement (faux négatif, manque de puissance)."
      }
    ];
  } else if (group === "bias") {
    return [
      {
        question: `Facteur de confusion`,
        answer: "Variable liée à la fois à l'exposition et à la maladie. Elle peut masquer ou fausser l'association réelle si elle n'est pas contrôlée."
      },
      {
        question: `Ajustement (Analyse multivariée)`,
        answer: "Méthode d'analyse statistique permettant d'éliminer l'effet des facteurs de confusion en calculant l'effet propre de chaque variable."
      },
      {
        question: `Biais de sélection`,
        answer: "Distorsion de l'association provoquée par un recrutement non représentatif de la population cible ou par des pertes de vue non aléatoires."
      },
      {
        question: `Masquage (Insu / Aveugle)`,
        answer: "Procédure consistant à cacher l'attribution des traitements aux patients, investigateurs ou évaluateurs afin de prévenir les biais de mesure."
      },
      {
        question: `Biais de mémorisation (rappel)`,
        answer: "Biais d'information fréquent dans les études rétrospectives (cas-témoins), où les malades se souviennent mieux de leurs expositions passées."
      }
    ];
  } else { // group === "design"
    return [
      {
        question: `Structure PICO`,
        answer: "Acronyme (Population, Intervention/exposition, Comparateur, Outcome/critère) servant à formuler une question de recherche claire et exploitable."
      },
      {
        question: `Formulation de l'hypothèse`,
        answer: "L'hypothèse clinique principale doit être formulée a priori de façon claire, réfutable et mesurable objectivement."
      },
      {
        question: `Contenu du Protocole`,
        answer: "Document de référence détaillant le rationnel scientifique, l'objectif, la méthodologie, le plan d'analyse statistique et le cadre éthique de l'étude."
      },
      {
        question: `Recherche bibliographique`,
        answer: "Revue de la littérature scientifique nécessaire a priori pour justifier la pertinence clinique de l'étude et valider son originalité."
      },
      {
        question: `Faisabilité clinique`,
        answer: "Évaluation logistique et budgétaire permettant de s'assurer que le nombre de patients requis pourra être recruté dans les délais prévus."
      }
    ];
  }
}

// Main execution
function main() {
  const outputPath = path.join(__dirname, '../src/data/pregenerated-exercises.json');
  let database = {};

  if (fs.existsSync(outputPath)) {
    try {
      database = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch (e) {
      console.warn("⚠️ Impossible de lire la base existante.");
    }
  }

  console.log(`🚀 Complétion de la base locale d'exercices...`);

  let addedChapters = 0;
  for (const chapter of RECIF_CHAPTERS) {
    if (!database[chapter] || !database[chapter].quiz || database[chapter].quiz.length < 5 || !database[chapter].flashcards || database[chapter].flashcards.length < 5) {
      console.log(`   - Ajout d'exercices locaux pour : "${chapter}"`);
      database[chapter] = {
        quiz: generateQuizForChapter(chapter),
        flashcards: generateFlashcardsForChapter(chapter)
      };
      addedChapters++;
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(database, null, 2), 'utf8');
  console.log(`\n🎉 Base complétée avec succès ! ${addedChapters} chapitres ajoutés ou mis à jour.`);
}

main();
