'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import styles from './page.module.css';

type StudyType = 'transversal' | 'comparative_prop' | 'comparative_mean' | 'case_control' | 'diagnostic';

export default function CalculatorPage() {
  const [studyType, setStudyType] = useState<StudyType>('transversal');

  // Common parameters
  const [alpha, setAlpha] = useState<number>(0.05);
  const [power, setPower] = useState<number>(0.80);
  const [lostRate, setLostRate] = useState<number>(0.10); // 10% lost to follow-up

  // Transversal study parameters
  const [pTransversal, setPTransversal] = useState<number>(0.50); // 50%
  const [dTransversal, setDTransversal] = useState<number>(0.05); // 5% precision
  const [finitePop, setFinitePop] = useState<boolean>(false);
  const [popSize, setPopSize] = useState<number>(1000);

  // Comparative proportions study parameters
  const [p1Comparative, setP1Comparative] = useState<number>(0.40); // 40% in group 1
  const [p2Comparative, setP2Comparative] = useState<number>(0.25); // 25% in group 2

  // Comparative means study parameters
  const [deltaMean, setDeltaMean] = useState<number>(5.0); // expected difference
  const [sigmaMean, setSigmaMean] = useState<number>(10.0); // common standard deviation

  // Case-control parameters
  const [p0CaseControl, setP0CaseControl] = useState<number>(0.30); // 30% exposure in controls
  const [orCaseControl, setOrCaseControl] = useState<number>(2.0); // expected Odds Ratio
  const [kControls, setKControls] = useState<number>(1); // 1 control per case

  // Diagnostic study parameters
  const [prevDiag, setPrevDiag] = useState<number>(0.20); // 20% prevalence
  const [perfDiag, setPerfDiag] = useState<number>(0.90); // 90% sensitivity or specificity
  const [dDiag, setDDiag] = useState<number>(0.05); // 5% precision

  // Copy status
  const [copied, setCopied] = useState<boolean>(false);

  // Z-scores lookup
  const getZAlpha = (a: number): number => {
    if (a === 0.01) return 2.576;
    if (a === 0.10) return 1.645;
    return 1.96; // 0.05
  };

  const getZBeta = (pow: number): number => {
    if (pow === 0.70) return 0.524;
    if (pow === 0.90) return 1.282;
    if (pow === 0.95) return 1.645;
    return 0.842; // 0.80
  };

  // Calculation results
  const [nsnRaw, setNsnRaw] = useState<number>(0);
  const [nsnAdjusted, setNsnAdjusted] = useState<number>(0);
  const [nsnGroup1, setNsnGroup1] = useState<number>(0);
  const [nsnGroup2, setNsnGroup2] = useState<number>(0);
  const [nsnGroup1Adj, setNsnGroup1Adj] = useState<number>(0);
  const [nsnGroup2Adj, setNsnGroup2Adj] = useState<number>(0);
  const [formulaString, setFormulaString] = useState<string>('');
  const [reportText, setReportText] = useState<string>('');

  useEffect(() => {
    calculateNSN();
  }, [
    studyType, alpha, power, lostRate,
    pTransversal, dTransversal, finitePop, popSize,
    p1Comparative, p2Comparative,
    deltaMean, sigmaMean,
    p0CaseControl, orCaseControl, kControls,
    prevDiag, perfDiag, dDiag
  ]);

  const calculateNSN = () => {
    const zAlpha = getZAlpha(alpha);
    const zBeta = getZBeta(power);
    let raw = 0;
    let group1 = 0;
    let group2 = 0;
    let formula = '';
    let report = '';

    const alphaPct = (alpha * 100).toFixed(0);
    const powerPct = (power * 100).toFixed(0);
    const lostPct = (lostRate * 100).toFixed(0);

    if (studyType === 'transversal') {
      // Cochran formula
      const n = (Math.pow(zAlpha, 2) * pTransversal * (1 - pTransversal)) / Math.pow(dTransversal, 2);
      let finalN = n;
      if (finitePop && popSize > 0) {
        finalN = n / (1 + (n - 1) / popSize);
      }
      raw = Math.ceil(finalN);
      formula = `N = (Z² * p * (1-p)) / d²${finitePop ? '  [Ajusté pour population finie]' : ''}`;
      
      const prevPct = (pTransversal * 100).toFixed(0);
      const precPct = (dTransversal * 100).toFixed(1);
      
      report = `Pour estimer une prévalence attendue de ${prevPct}% avec une marge d'erreur de +/- ${precPct}% et un niveau de confiance de ${100 - alpha * 100}% (risque alpha = ${alphaPct}%), la taille d'échantillon minimale statistiquement requise est de ${raw} sujets.\n\nEn tenant compte d'un taux d'attrition/perdus de vue de ${lostPct}%, il sera nécessaire de recruter au total ${Math.ceil(raw / (1 - lostRate))} sujets.`;
    } 
    else if (studyType === 'comparative_prop') {
      // Comparison of 2 proportions
      const diff = Math.abs(p1Comparative - p2Comparative);
      if (diff > 0) {
        const nGroup = (Math.pow(zAlpha + zBeta, 2) * (p1Comparative * (1 - p1Comparative) + p2Comparative * (1 - p2Comparative))) / Math.pow(diff, 2);
        group1 = Math.ceil(nGroup);
        group2 = Math.ceil(nGroup);
        raw = group1 + group2;
      } else {
        group1 = 0;
        group2 = 0;
        raw = 0;
      }
      formula = `N_groupe = (Z_alpha + Z_beta)² * [p1(1-p1) + p2(1-p2)] / (p1 - p2)²`;
      
      const p1Pct = (p1Comparative * 100).toFixed(0);
      const p2Pct = (p2Comparative * 100).toFixed(0);
      
      report = `Dans le cadre d'un essai clinique comparatif avec un critère de jugement qualitatif, pour mettre en évidence une différence entre un taux de succès attendu de ${p1Pct}% dans le Groupe 1 (ex. Traitement Innovant) et de ${p2Pct}% dans le Groupe 2 (ex. Traitement Standard / Témoin), avec un risque alpha de ${alphaPct}% et une puissance statistique de ${powerPct}%, la taille d'échantillon minimale statistiquement requise est de ${group1} sujets par groupe, soit un total de ${raw} sujets.\n\nEn ajustant pour un taux de perdus de vue estimé à ${lostPct}%, le recrutement devra cibler ${Math.ceil(group1 / (1 - lostRate))} sujets par groupe, soit un effectif total à inclure de ${Math.ceil(raw / (1 - lostRate))} sujets.`;
    } 
    else if (studyType === 'comparative_mean') {
      // Comparison of 2 means
      if (deltaMean > 0) {
        const nGroup = (2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(sigmaMean, 2)) / Math.pow(deltaMean, 2);
        group1 = Math.ceil(nGroup);
        group2 = Math.ceil(nGroup);
        raw = group1 + group2;
      } else {
        group1 = 0;
        group2 = 0;
        raw = 0;
      }
      formula = `N_groupe = 2 * (Z_alpha + Z_beta)² * sigma² / delta²`;
      
      report = `Pour détecter une différence moyenne cliniquement pertinente de ${deltaMean} unités entre les deux groupes d'étude, avec un écart-type supposé commun de ${sigmaMean}, un risque de faux positif alpha de ${alphaPct}% et une puissance de détection de ${powerPct}%, l'effectif minimal statistiquement requis est de ${group1} sujets par groupe, soit un total de ${raw} sujets.\n\nEn incluant une compensation de ${lostPct}% pour les perdus de vue, il faudra recruter ${Math.ceil(group1 / (1 - lostRate))} sujets par bras, soit un effectif total de ${Math.ceil(raw / (1 - lostRate))} sujets.`;
    } 
    else if (studyType === 'case_control') {
      // Case control formula
      // p1 is exposure rate in cases
      const p1 = (orCaseControl * p0CaseControl) / (1 - p0CaseControl + orCaseControl * p0CaseControl);
      const pBar = (p1 + kControls * p0CaseControl) / (1 + kControls);
      
      const diff = Math.abs(p1 - p0CaseControl);
      if (diff > 0) {
        const numerator = Math.pow(
          zAlpha * Math.sqrt((1 + 1 / kControls) * pBar * (1 - pBar)) +
          zBeta * Math.sqrt(p1 * (1 - p1) + (p0CaseControl * (1 - p0CaseControl)) / kControls),
          2
        );
        const nCases = numerator / Math.pow(diff, 2);
        group1 = Math.ceil(nCases); // cases
        group2 = Math.ceil(kControls * nCases); // controls
        raw = group1 + group2;
      } else {
        group1 = 0;
        group2 = 0;
        raw = 0;
      }
      formula = `N_cas = {Z_a * sqrt[(1+1/k)*p_bar*(1-p_bar)] + Z_b * sqrt[p1(1-p1) + p0(1-p0)/k]}² / (p1 - p0)²`;
      
      const p0Pct = (p0CaseControl * 100).toFixed(0);
      const p1Pct = (p1 * 100).toFixed(0);
      
      report = `Dans le cadre d'une étude Cas-Témoins, pour mettre en évidence un Odds Ratio (OR) de ${orCaseControl} avec un taux d'exposition chez les témoins estimé à ${p0Pct}% (ce qui correspond à un taux attendu de ${p1Pct}% chez les cas), avec un risque alpha bilatéral de ${alphaPct}% et une puissance statistique de ${powerPct}%, en incluant un ratio de ${kControls} Témoin(s) par Cas, l'effectif requis est de ${group1} Cas et ${group2} Témoins, soit un total de ${raw} sujets.\n\nEn prévoyant un taux d'exclusion/perdus de vue de ${lostPct}%, le recrutement devra porter sur ${Math.ceil(group1 / (1 - lostRate))} Cas et ${Math.ceil(group2 / (1 - lostRate))} Témoins, soit un total à inclure de ${Math.ceil(raw / (1 - lostRate))} sujets.`;
    } 
    else if (studyType === 'diagnostic') {
      // Diagnostic study: sensitivity/specificity estimation with prevalence
      const nSub = (Math.pow(zAlpha, 2) * perfDiag * (1 - perfDiag)) / Math.pow(dDiag, 2);
      group1 = Math.ceil(nSub); // subjects with/without disease needed
      
      if (prevDiag > 0) {
        raw = Math.ceil(nSub / prevDiag); // total subjects to screen
      } else {
        raw = 0;
      }
      group2 = raw - group1; // other subjects screened
      
      formula = `N_malades = (Z² * p * (1-p)) / d²   [N_total = N_malades / Prévalence]`;
      
      const perfPct = (perfDiag * 100).toFixed(0);
      const precPct = (dDiag * 100).toFixed(1);
      const prevPct = (prevDiag * 100).toFixed(0);
      
      report = `Pour évaluer les performances d'un test diagnostique avec une sensibilité ou spécificité attendue de ${perfPct}%, avec une marge d'erreur de +/- ${precPct}% et un niveau de confiance de ${100 - alpha * 100}% (alpha = ${alphaPct}%), il est indispensable d'évaluer au minimum ${group1} sujets cibles (malades ou non-malades selon le critère). En supposant une prévalence de la pathologie de ${prevPct}% dans la population d'étude, il sera nécessaire de recruter et dépister un effectif total de ${raw} patients pour obtenir l'effectif ciblé.\n\nEn compensant pour un taux de dossiers inexploitables/perdus de vue de ${lostPct}%, le recrutement devra cibler un effectif total de ${Math.ceil(raw / (1 - lostRate))} patients (dont ${Math.ceil(group1 / (1 - lostRate))} sujets cibles).`;
    }

    setNsnRaw(raw);
    setNsnGroup1(group1);
    setNsnGroup2(group2);
    
    // Adjusted sizes
    const totalAdj = Math.ceil(raw / (1 - lostRate));
    setNsnAdjusted(totalAdj);
    setNsnGroup1Adj(Math.ceil(group1 / (1 - lostRate)));
    setNsnGroup2Adj(Math.ceil(group2 / (1 - lostRate)));
    
    setFormulaString(formula);
    setReportText(report);
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>Calculateur de Taille d'Échantillon (NSN)</h1>
          <p className={styles.subtitle}>
            Calculez le nombre de sujets nécessaires de manière rigoureuse en sélectionnant la méthodologie de votre recherche.
          </p>
        </header>

        <div className={styles.container}>
          {/* Settings Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Step 1: Study Type selection */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <span style={{ background: 'var(--accent-primary)', color: 'var(--bg-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', fontSize: '0.8rem', fontWeight: 'bold' }}>1</span>
                Type d'étude & Objectif
              </h3>
              
              <div className={styles.studyTypesGrid}>
                <button 
                  className={`${styles.studyTypeBtn} ${studyType === 'transversal' ? styles.activeStudyType : ''}`}
                  onClick={() => setStudyType('transversal')}
                >
                  <span className={styles.studyTypeName}>Enquête transversale / descriptive</span>
                  <span className={styles.studyTypeDesc}>Estimer une proportion ou une prévalence dans une seule population.</span>
                </button>

                <button 
                  className={`${styles.studyTypeBtn} ${studyType === 'comparative_prop' ? styles.activeStudyType : ''}`}
                  onClick={() => setStudyType('comparative_prop')}
                >
                  <span className={styles.studyTypeName}>Essai comparatif (Critère qualitatif)</span>
                  <span className={styles.studyTypeDesc}>Comparer deux pourcentages d'événements (guérison, décès, etc.) entre 2 groupes.</span>
                </button>

                <button 
                  className={`${styles.studyTypeBtn} ${studyType === 'comparative_mean' ? styles.activeStudyType : ''}`}
                  onClick={() => setStudyType('comparative_mean')}
                >
                  <span className={styles.studyTypeName}>Essai comparatif (Critère quantitatif)</span>
                  <span className={styles.studyTypeDesc}>Comparer les valeurs moyennes d'une mesure continue entre 2 groupes.</span>
                </button>

                <button 
                  className={`${styles.studyTypeBtn} ${studyType === 'case_control' ? styles.activeStudyType : ''}`}
                  onClick={() => setStudyType('case_control')}
                >
                  <span className={styles.studyTypeName}>Étude Cas-Témoins</span>
                  <span className={styles.studyTypeDesc}>Détecter un Odds Ratio d'exposition entre malades (cas) et non malades (témoins).</span>
                </button>

                <button 
                  className={`${styles.studyTypeBtn} ${studyType === 'diagnostic' ? styles.activeStudyType : ''}`}
                  onClick={() => setStudyType('diagnostic')}
                >
                  <span className={styles.studyTypeName}>Étude d'exactitude diagnostique</span>
                  <span className={styles.studyTypeDesc}>Estimer la sensibilité ou la spécificité d'un nouveau test par rapport à une référence.</span>
                </button>
              </div>
            </div>

            {/* Step 2: Settings form */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <span style={{ background: 'var(--accent-primary)', color: 'var(--bg-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', fontSize: '0.8rem', fontWeight: 'bold' }}>2</span>
                Paramètres d'entrée
              </h3>

              <div className={styles.formGrid}>
                {/* Alpha Risk */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Risque alpha (α) - Faux positifs</label>
                  <select 
                    className={styles.select} 
                    value={alpha} 
                    onChange={(e) => setAlpha(parseFloat(e.target.value))}
                  >
                    <option value={0.05}>5% (Recommandé - standard)</option>
                    <option value={0.01}>1% (Tranchant)</option>
                    <option value={0.10}>10% (Exploratoire)</option>
                  </select>
                </div>

                {/* Power (if applicable) */}
                {studyType !== 'transversal' && studyType !== 'diagnostic' && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Puissance statistique (1-β)</label>
                    <select 
                      className={styles.select} 
                      value={power} 
                      onChange={(e) => setPower(parseFloat(e.target.value))}
                    >
                      <option value={0.80}>80% (Standard en clinique)</option>
                      <option value={0.90}>90% (Robuste)</option>
                      <option value={0.95}>95% (Exigeant)</option>
                      <option value={0.70}>70% (Exploratoire)</option>
                    </select>
                  </div>
                )}

                {/* Lost to follow-up Rate */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Taux estimé de perdus de vue</label>
                  <div className={styles.rangeContainer}>
                    <input 
                      type="range" 
                      min="0" 
                      max="0.4" 
                      step="0.05"
                      className={styles.slider} 
                      value={lostRate} 
                      onChange={(e) => setLostRate(parseFloat(e.target.value))}
                    />
                    <span className={styles.sliderVal}>{(lostRate * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Transversal inputs */}
                {studyType === 'transversal' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Prévalence attendue (p)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.95" 
                          step="0.05"
                          className={styles.slider} 
                          value={pTransversal} 
                          onChange={(e) => setPTransversal(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>{(pTransversal * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Marge d'erreur / Précision (d)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.01" 
                          max="0.15" 
                          step="0.01"
                          className={styles.slider} 
                          value={dTransversal} 
                          onChange={(e) => setDTransversal(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>+/- {(dTransversal * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className={`${styles.formGroup} ${styles.formGroupFull}`} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <input 
                        type="checkbox" 
                        id="finitePop" 
                        checked={finitePop}
                        onChange={(e) => setFinitePop(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="finitePop" className={styles.label} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        Ajuster pour une population totale finie
                      </label>
                    </div>

                    {finitePop && (
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Taille de la population cible</label>
                        <input 
                          type="number" 
                          className={styles.input} 
                          min="10"
                          value={popSize} 
                          onChange={(e) => setPopSize(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Comparative proportions inputs */}
                {studyType === 'comparative_prop' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Proportion dans Groupe 1 (p1)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.95" 
                          step="0.05"
                          className={styles.slider} 
                          value={p1Comparative} 
                          onChange={(e) => setP1Comparative(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>{(p1Comparative * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Proportion dans Groupe 2 (p2)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.95" 
                          step="0.05"
                          className={styles.slider} 
                          value={p2Comparative} 
                          onChange={(e) => setP2Comparative(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>{(p2Comparative * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Comparative means inputs */}
                {studyType === 'comparative_mean' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Différence moyenne attendue (Δ)</label>
                      <input 
                        type="number" 
                        className={styles.input} 
                        step="0.1"
                        min="0.1"
                        value={deltaMean} 
                        onChange={(e) => setDeltaMean(Math.max(0.1, parseFloat(e.target.value) || 0))}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Écart-type commun supposé (σ)</label>
                      <input 
                        type="number" 
                        className={styles.input} 
                        step="0.1"
                        min="0.1"
                        value={sigmaMean} 
                        onChange={(e) => setSigmaMean(Math.max(0.1, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                  </>
                )}

                {/* Case-control inputs */}
                {studyType === 'case_control' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Taux d'exposition chez témoins (p0)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.95" 
                          step="0.05"
                          className={styles.slider} 
                          value={p0CaseControl} 
                          onChange={(e) => setP0CaseControl(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>{(p0CaseControl * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Odds Ratio à détecter (OR)</label>
                      <input 
                        type="number" 
                        className={styles.input} 
                        step="0.1"
                        min="1.1"
                        value={orCaseControl} 
                        onChange={(e) => setOrCaseControl(Math.max(1.1, parseFloat(e.target.value) || 0))}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Ratio de Témoins par Cas (k)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="1" 
                          max="4" 
                          step="1"
                          className={styles.slider} 
                          value={kControls} 
                          onChange={(e) => setKControls(parseInt(e.target.value))}
                        />
                        <span className={styles.sliderVal}>{kControls} : 1</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Diagnostic accuracy inputs */}
                {studyType === 'diagnostic' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Prévalence de la pathologie (P)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.95" 
                          step="0.05"
                          className={styles.slider} 
                          value={prevDiag} 
                          onChange={(e) => setPrevDiag(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>{(prevDiag * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Sensibilité ou Spécificité attendue</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.50" 
                          max="0.99" 
                          step="0.05"
                          className={styles.slider} 
                          value={perfDiag} 
                          onChange={(e) => setPerfDiag(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>{(perfDiag * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Précision souhaitée (+/- d)</label>
                      <div className={styles.rangeContainer}>
                        <input 
                          type="range" 
                          min="0.01" 
                          max="0.15" 
                          step="0.01"
                          className={styles.slider} 
                          value={dDiag} 
                          onChange={(e) => setDDiag(parseFloat(e.target.value))}
                        />
                        <span className={styles.sliderVal}>+/- {(dDiag * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Results Column */}
          <div className={styles.resultsContainer}>
            
            {/* Number Display Card */}
            <div className={styles.resultDisplayCard}>
              <div className={styles.resultValue}>{nsnAdjusted}</div>
              <div className={styles.resultLabel}>Sujets à inclure au total</div>
              <div className={styles.resultSubLabel}>
                (Dont {nsnRaw} sujets selon le calcul statistique brut, plus {(lostRate * 100).toFixed(0)}% de perdus de vue)
              </div>

              {/* Group breakdowns */}
              {studyType !== 'transversal' && (
                <div className={styles.resultSplit}>
                  <div className={styles.splitItem}>
                    <div className={styles.splitVal}>
                      {studyType === 'case_control' ? nsnGroup1Adj : nsnGroup1Adj}
                    </div>
                    <div className={styles.splitLabel}>
                      {studyType === 'case_control' ? 'Cas à inclure' : 'Bras A (Groupe 1)'}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Stat brut : {nsnGroup1})</span>
                  </div>

                  <div className={styles.splitItem}>
                    <div className={styles.splitVal}>
                      {studyType === 'case_control' ? nsnGroup2Adj : nsnGroup2Adj}
                    </div>
                    <div className={styles.splitLabel}>
                      {studyType === 'case_control' ? 'Témoins à inclure' : 'Bras B (Groupe 2)'}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Stat brut : {nsnGroup2})</span>
                  </div>
                </div>
              )}

              {studyType === 'diagnostic' && (
                <div className={styles.resultSplit}>
                  <div className={styles.splitItem}>
                    <div className={styles.splitVal}>{nsnGroup1Adj}</div>
                    <div className={styles.splitLabel}>Patients cibles requis</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Stat brut : {nsnGroup1})</span>
                  </div>
                  <div className={styles.splitItem}>
                    <div className={styles.splitVal}>{nsnGroup2Adj}</div>
                    <div className={styles.splitLabel}>Autres patients à dépister</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Stat brut : {nsnGroup2})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info and descriptives */}
            <div className={styles.infoSection}>
              {/* Formula explanation */}
              <div className={styles.formulaBox}>
                <div className={styles.formulaTitle}>Formule statistique de référence</div>
                <div className={styles.formulaCode}>{formulaString}</div>
              </div>

              {/* Generated text copy-paste */}
              <div className={styles.reportBox}>
                <div className={styles.reportHeader}>
                  <span className={styles.reportTitle}>Rédiger la justification dans votre protocole</span>
                  <button className={styles.copyBtn} onClick={handleCopyReport}>
                    {copied ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copié !
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copier
                      </>
                    )}
                  </button>
                </div>
                <p className={styles.reportText}>{reportText}</p>
              </div>

              {/* Statistical reminder warning banner */}
              <div className={styles.helpAlert}>
                <svg className={styles.helpAlertIcon} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  <strong>Conseil de méthodologie (RECIF) :</strong> La taille de l'échantillon doit toujours être déterminée sur la base du <strong>critère de jugement principal</strong>. Si vous avez plusieurs critères principaux, calculez la taille pour chacun d'eux et conservez le effectif le plus grand pour garantir la puissance globale de l'étude.
                </span>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
