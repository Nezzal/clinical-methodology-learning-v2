export interface UserProfileInfo {
  authorName: string;
  profession: string;
  institution: string;
  city: string;
}

/**
 * Extrait de façon unifiée les informations de profil de l'utilisateur
 * (Auteur, Profession, Institution, Ville) depuis le state auth ou le localStorage.
 */
export function getUserProfileHeaderInfo(profile?: any, user?: any): UserProfileInfo {
  let localData: any = {};
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('recif_profile_data');
      if (saved) localData = JSON.parse(saved);
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  const authorName =
    profile?.displayName ||
    user?.displayName ||
    localData.displayName ||
    (typeof window !== 'undefined' ? localStorage.getItem('user_profile_name') : null) ||
    'Chercheur / Praticien';

  const profession =
    profile?.profession ||
    localData.profession ||
    '';

  const institution =
    profile?.institution ||
    localData.institution ||
    '';

  const city =
    profile?.city ||
    localData.city ||
    '';

  return {
    authorName,
    profession,
    institution,
    city
  };
}
