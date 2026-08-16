import { supabase } from './supabaseClient';

/**
 * Normalise une chaîne de caractères pour créer un slug lisible et propre.
 * Exemple: "Exceller sur Excel & Power Query (2024) !" -> "exceller-sur-excel-power-query-2024"
 */
export function generateSlug(text: string): string {
  if (!text) return '';

  return text
    .toString()
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Enlève les diacritiques/accents
    .toLowerCase()
    .trim()
    .replace(/&/g, '-et-') // Remplace & par -et-
    .replace(/[^a-z0-9 -]/g, '') // Supprime les caractères spéciaux non alphanumériques
    .replace(/\s+/g, '-') // Remplace les espaces par des tirets
    .replace(/-+/g, '-') // Évite les tirets multiples consécutifs
    .replace(/^-+/, '') // Enlève les tirets au début
    .replace(/-+$/, ''); // Enlève les tirets à la fin
}

/**
 * Teste si la chaîne correspond au format d'un UUID.
 */
export function isUuid(str: string | undefined | null): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
}

/**
 * Génère un slug unique pour une formation en interrogeant Supabase.
 */
export async function getUniqueSlug(title: string, currentCourseId?: string): Promise<string> {
  const baseSlug = generateSlug(title) || 'formation';
  let candidateSlug = baseSlug;
  let counter = 1;

  try {
    while (true) {
      let query = supabase
        .from('courses')
        .select('id, slug')
        .eq('slug', candidateSlug);

      if (currentCourseId) {
        query = query.neq('id', currentCourseId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Vérification slug Supabase (colonne slug peut-être absente):', error.message);
        return candidateSlug;
      }

      if (!data || data.length === 0) {
        // Le slug est disponible !
        return candidateSlug;
      }

      // Si le slug est déjà pris, ajouter un suffixe numérique
      counter++;
      candidateSlug = `${baseSlug}-${counter}`;
    }
  } catch (err) {
    console.warn('Erreur lors de la génération du slug unique:', err);
    return candidateSlug;
  }
}

/**
 * Migration automatique: génère et enregistre un slug pour toutes les formations existantes qui n'en ont pas.
 */
export async function ensureSlugsForExistingCourses(): Promise<void> {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select('*');

    if (error || !courses) {
      return;
    }

    for (const course of courses) {
      if (!course.slug && course.title) {
        const uniqueSlug = await getUniqueSlug(course.title, course.id);
        const updateRes = await supabase
          .from('courses')
          .update({ slug: uniqueSlug })
          .eq('id', course.id);
        if (updateRes.error) {
          // Si la colonne 'slug' n'existe pas en BDD, interrompre proprement
          break;
        }
      }
    }
  } catch (err) {
    console.warn('Migration des slugs ignorée ou échouée:', err);
  }
}
