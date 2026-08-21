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
 * Génère un slug unique pour un entraînement en interrogeant Supabase.
 */
export async function getUniqueTrainingSlug(title: string, currentTrainingId?: string): Promise<string> {
  const baseSlug = generateSlug(title) || 'entrainement';
  let candidateSlug = baseSlug;
  let counter = 1;

  try {
    while (true) {
      let query = supabase
        .from('training_sessions')
        .select('id, slug')
        .eq('slug', candidateSlug);

      if (currentTrainingId) {
        query = query.neq('id', currentTrainingId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Vérification slug entraînement Supabase (colonne slug peut-être absente):', error.message);
        return candidateSlug;
      }

      if (!data || data.length === 0) {
        return candidateSlug;
      }

      counter++;
      candidateSlug = `${baseSlug}-${counter}`;
    }
  } catch (err) {
    console.warn('Erreur lors de la génération du slug unique entraînement:', err);
    return candidateSlug;
  }
}

/**
 * Génère un slug unique pour un cours interactif en interrogeant Supabase.
 */
export async function getUniqueInteractiveCourseSlug(title: string, currentCourseId?: string): Promise<string> {
  const baseSlug = generateSlug(title) || 'cours-interactif';
  let candidateSlug = baseSlug;
  let counter = 1;

  try {
    while (true) {
      let query = supabase
        .from('interactive_courses')
        .select('id, slug')
        .eq('slug', candidateSlug);

      if (currentCourseId) {
        query = query.neq('id', currentCourseId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Vérification slug cours interactif Supabase:', error.message);
        return candidateSlug;
      }

      if (!data || data.length === 0) {
        return candidateSlug;
      }

      counter++;
      candidateSlug = `${baseSlug}-${counter}`;
    }
  } catch (err) {
    console.warn('Erreur lors de la génération du slug cours interactif:', err);
    return candidateSlug;
  }
}

/**
 * Migration automatique: génère et enregistre un slug pour tous les entraînements existants qui n'en ont pas.
 */
export async function ensureSlugsForExistingTrainings(): Promise<void> {
  try {
    const { data: sessions, error } = await supabase
      .from('training_sessions')
      .select('*');

    if (error || !sessions) {
      return;
    }

    for (const session of sessions) {
      if (!session.slug && session.title) {
        const uniqueSlug = await getUniqueTrainingSlug(session.title, session.id);
        const updateRes = await supabase
          .from('training_sessions')
          .update({ slug: uniqueSlug })
          .eq('id', session.id);
        if (updateRes.error) {
          break;
        }
      }
    }
  } catch (err) {
    console.warn('Migration des slugs entraînements ignorée ou échouée:', err);
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

/**
 * Migration automatique: génère et enregistre un slug pour tous les cours interactifs existants qui n'en ont pas.
 */
export async function ensureSlugsForExistingInteractiveCourses(): Promise<void> {
  try {
    const { data: interactiveCourses, error } = await supabase
      .from('interactive_courses')
      .select('*');

    if (error || !interactiveCourses) {
      return;
    }

    for (const course of interactiveCourses) {
      if (!course.slug && course.title) {
        const uniqueSlug = await getUniqueInteractiveCourseSlug(course.title, course.id);
        const updateRes = await supabase
          .from('interactive_courses')
          .update({ slug: uniqueSlug })
          .eq('id', course.id);
        if (updateRes.error) {
          break;
        }
      }
    }
  } catch (err) {
    console.warn('Migration des slugs cours interactifs ignorée ou échouée:', err);
  }
}
