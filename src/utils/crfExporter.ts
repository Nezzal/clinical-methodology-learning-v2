/**
 * Utility for exporting & converting RECIF CRFs to MéthodoCRF compatible schema
 */

export interface MethodoCRFField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'textarea' | 'scale';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  unit?: string;
  help?: string;
  cdash?: string;
}

export interface MethodoCRFSection {
  id: string;
  title: string;
  description?: string;
  fields: MethodoCRFField[];
}

export interface MethodoCRFTemplate {
  id: string;
  title: string;
  code: string;
  version: string;
  description: string;
  author: string;
  category?: string;
  dateCreated: string;
  sections: MethodoCRFSection[];
  rawMarkdown?: string;
}

/**
 * Converts a RECIF Markdown CRF or protocol data into a structured MéthodoCRF schema object
 */
export function parseMarkdownCrfToMethodoSchema(
  markdownText: string,
  metadata: { title?: string; acronym?: string; methodology?: string } = {}
): MethodoCRFTemplate {
  const code = (metadata.acronym || 'CRF-STUDY').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const crfId = `crf-recif-${Date.now()}`;
  const title = metadata.title || 'Cahier d\'Observation Clinique (CRF)';
  
  const sections: MethodoCRFSection[] = [];
  
  if (markdownText) {
    // Splitting by H2 headers (## Fiche X or ## Section X)
    const rawSections = markdownText.split(/^##\s+/m);
    
    rawSections.forEach((secText, idx) => {
      if (!secText.trim()) return;
      
      const lines = secText.trim().split('\n');
      const sectionTitle = lines[0].replace(/^#+\s*/, '').trim();
      const bodyLines = lines.slice(1);
      
      const fields: MethodoCRFField[] = [];
      let fieldCounter = 1;
      
      bodyLines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.includes('[ ]') || trimmed.includes('[____]') || trimmed.includes(':')) {
          let label = trimmed
            .replace(/^[-*|]\s*/, '')
            .replace(/\[\s*\]/g, '')
            .replace(/\[_+\]/g, '')
            .replace(/\|/g, ' ')
            .trim();
            
          if (label && label.length > 3 && !label.startsWith('#') && !label.startsWith('---')) {
            let fieldType: MethodoCRFField['type'] = 'text';
            let options: string[] | undefined = undefined;
            
            if (trimmed.includes('[ ]')) {
              fieldType = 'checkbox';
            }
            if (label.toLowerCase().includes('date')) {
              fieldType = 'date';
            } else if (label.toLowerCase().includes('âge') || label.toLowerCase().includes('taille') || label.toLowerCase().includes('poids') || label.toLowerCase().includes('score')) {
              fieldType = 'number';
            } else if (label.includes('?') || label.includes('Oui') || label.includes('Non')) {
              fieldType = 'radio';
              options = ['Oui', 'Non', 'Non évalué'];
            }
            
            fields.push({
              id: `f_${idx}_${fieldCounter++}`,
              label: label.substring(0, 100),
              type: fieldType,
              required: true,
              options
            });
          }
        }
      });
      
      if (fields.length === 0) {
        fields.push({
          id: `f_${idx}_1`,
          label: `Éléments de recueil : ${sectionTitle.substring(0, 60)}`,
          type: 'textarea',
          required: true,
          placeholder: 'Saisir les observations cliniques ou remarques...'
        });
      }
      
      sections.push({
        id: `sec_${idx + 1}`,
        title: sectionTitle,
        description: `Section extraite du protocole RECIF`,
        fields
      });
    });
  }
  
  if (sections.length < 2) {
    return {
      id: crfId,
      title,
      code,
      version: '1.0',
      description: `Cahier d'observation clinique généré automatiquement par RECIF pour l'étude ${code}.`,
      author: 'RECIF Méthodologie Clinique',
      category: metadata.methodology || 'Recherche Clinique',
      dateCreated: new Date().toISOString(),
      rawMarkdown: markdownText,
      sections: [
        {
          id: 'sec-1',
          title: '1. Éligibilité & Critères d\'Inclusion',
          description: 'Vérification des critères du protocole',
          fields: [
            { id: 'patient_id', label: 'Code Anonymisé Patient (USUBJID)', type: 'text', required: true, placeholder: 'ex: PAT-001' },
            { id: 'inclusion_date', label: 'Date d\'inclusion', type: 'date', required: true },
            { id: 'critere_inclusion_valide', label: 'Tous les critères d\'inclusion sont-ils remplis ?', type: 'radio', required: true, options: ['Oui', 'Non'] },
            { id: 'critere_exclusion_absent', label: 'Absence totale de critère de non-inclusion ?', type: 'radio', required: true, options: ['Oui', 'Non'] }
          ]
        },
        {
          id: 'sec-2',
          title: '2. Données Démographiques & Anthropométriques',
          description: 'Informations de base du patient',
          fields: [
            { id: 'age', label: 'Âge', type: 'number', required: true, unit: 'ans' },
            { id: 'sexe', label: 'Sexe biologique', type: 'radio', required: true, options: ['Homme', 'Femme'] },
            { id: 'taille', label: 'Taille', type: 'number', required: true, unit: 'cm' },
            { id: 'poids', label: 'Poids', type: 'number', required: true, unit: 'kg' }
          ]
        },
        {
          id: 'sec-3',
          title: '3. Examen Clinique & Critères de Jugement',
          description: 'Recueil des données d\'évaluation de l\'étude',
          fields: [
            { id: 'critere_principal', label: 'Mesure du critère de jugement principal', type: 'text', required: true },
            { id: 'observations_cliniques', label: 'Observations et résultats des examens', type: 'textarea', required: false }
          ]
        },
        {
          id: 'sec-4',
          title: '4. Événements Indésirables & Sécurité',
          description: 'Pharmacovigilance et tolérance (CDASH Module AE)',
          fields: [
            { id: 'evenement_indesirable', label: 'Survenue d\'un événement indésirable ?', type: 'radio', required: true, options: ['Non', 'Oui (Modéré)', 'Oui (Grave / EIG)'] },
            { id: 'description_ei', label: 'Description et conduite tenue si événement', type: 'textarea', required: false }
          ]
        }
      ]
    };
  }

  return {
    id: crfId,
    title,
    code,
    version: '1.0',
    description: `Cahier d'observation clinique généré par RECIF pour ${code}.`,
    author: 'RECIF Méthodologie Clinique',
    category: metadata.methodology || 'Recherche Clinique',
    dateCreated: new Date().toISOString(),
    rawMarkdown: markdownText,
    sections
  };
}

/**
 * Triggers browser download of the MéthodoCRF JSON template
 */
export function downloadCrfJson(crfTemplate: MethodoCRFTemplate): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(crfTemplate, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const fileName = `CRF_${(crfTemplate.code || 'RECIF').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`;
  downloadAnchor.setAttribute('download', fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Generates direct import URL (Deep-link) for MéthodoCRF
 */
export function generateMethodoCrfDeepLink(
  crfTemplate: MethodoCRFTemplate,
  baseUrl: string = 'http://localhost:5173'
): string {
  try {
    const jsonStr = JSON.stringify(crfTemplate);
    const encodedPayload = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    return `${baseUrl.replace(/\/$/, '')}/?import_crf=${encodedPayload}`;
  } catch (err) {
    console.error('Erreur encodage DeepLink CRF:', err);
    return baseUrl;
  }
}
