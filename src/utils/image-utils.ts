/**
 * Utilitaire pour compresser et assainir la photo d'un reçu côté client
 * - Redimensionne l'image (max 1200px)
 * - Efface les métadonnées EXIF (GPS, appareil...) via canvas re-render
 * - Compresse en WebP / JPEG (qualité 0.75) pour un envoi ultra-léger (< 300Ko)
 */
export async function compressAndSanitizeImage(file: File, maxDimension = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    // Vérification basique du type MIME
    if (!file.type.startsWith('image/')) {
      reject(new Error('Le fichier sélectionné n\'est pas une image valide.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcul du redimensionnement si nécessaire
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Impossible de créer le contexte 2D pour traiter l\'image.'));
          return;
        }

        // Dessiner l'image (élimine automatiquement toutes les données EXIF cachées)
        ctx.drawImage(img, 0, 0, width, height);

        // Essayer WebP, sinon JPEG comme fallback
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image.'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Déclenche le téléchargement d'un DataURL ou d'une URL d'image sur l'ordinateur de l'utilisateur
 */
export function downloadImage(dataUrlOrUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrlOrUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
