import { supabase } from './supabaseClient';

/**
 * Assure qu'une entrée existe dans la table client_profiles pour l'utilisateur donné.
 * Si l'entrée n'existe pas, elle sera créée automatiquement pour éviter les erreurs de contrainte de clé étrangère.
 */
export async function ensureClientProfile(userId: string, userMetadata?: any): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Vérifier si la ligne existe déjà
    const { data } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (data && data.id) {
      return true;
    }

    // 2. Créer le profil manquant
    const meta = userMetadata || {};
    const firstName = meta.first_name || meta.full_name?.split(' ')[0] || 'Utilisateur';
    const lastName = meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || '';
    const phone = meta.phone || '';

    const { error: insertErr } = await supabase
      .from('client_profiles')
      .upsert([
        {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          phone: phone
        }
      ], { onConflict: 'id' });

    if (insertErr) {
      console.warn("Notice: ensureClientProfile upsert failed:", insertErr.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn("Notice: ensureClientProfile error:", err?.message || err);
    return false;
  }
}
