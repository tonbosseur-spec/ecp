import { supabase } from './supabaseClient';

export interface ManualRegistrationParams {
  courseId: string;
  amount: number;
  paymentType?: 'full' | 'installment';
  trancheNumber?: number;
  notes?: string;
}

export interface ManualRegistrationResponse {
  success: boolean;
  registrationId?: string;
  paymentId?: string;
  error?: string;
  message?: string;
}

/**
 * Enregistre une demande d'inscription et un paiement en attente (mode manuel).
 * Statut initial : pending. L'accès sera débloqué après validation par l'administrateur.
 */
export async function createManualRegistration(params: ManualRegistrationParams): Promise<ManualRegistrationResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        success: false,
        error: 'UNAUTHENTICATED',
        message: 'Vous devez être connecté pour vous inscrire.'
      };
    }

    const userId = session.user.id;

    // Vérifier si une inscription existe déjà pour ce cours
    const { data: existingReg, error: regCheckError } = await supabase
      .from('registrations')
      .select('id, payment_status')
      .eq('client_id', userId)
      .eq('course_id', params.courseId)
      .maybeSingle();

    if (regCheckError) {
      console.error('Erreur vérification inscription:', regCheckError);
    }

    let registrationId = existingReg?.id;

    if (!registrationId) {
      // Créer une nouvelle inscription avec statut 'pending'
      const { data: newReg, error: createRegError } = await supabase
        .from('registrations')
        .insert({
          client_id: userId,
          course_id: params.courseId,
          payment_status: 'pending',
          payment_type: params.paymentType || 'full',
          amount_paid: 0,
          registered_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createRegError || !newReg) {
        console.error('Erreur création inscription:', createRegError);
        return {
          success: false,
          error: 'REGISTRATION_FAILED',
          message: 'Impossible de créer votre inscription. Veuillez réessayer.'
        };
      }

      registrationId = newReg.id;
    }

    // Créer une entrée dans la table payments avec statut 'pending'
    const due_date = new Date().toISOString();
    const { data: newPayment, error: createPaymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        registration_id: registrationId,
        course_id: params.courseId,
        amount: params.amount,
        status: 'pending',
        payment_type: params.paymentType || 'full',
        tranche_number: params.trancheNumber || 1,
        due_date,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createPaymentError) {
      console.warn('Création du paiement warning (peut-être déjà existant):', createPaymentError);
    }

    return {
      success: true,
      registrationId,
      paymentId: newPayment?.id,
      message: 'Demande d\'inscription enregistrée avec succès. Effectuez votre paiement manuel pour débloquer votre accès.'
    };
  } catch (err: any) {
    console.error('Erreur createManualRegistration:', err);
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Erreur lors de l\'enregistrement de votre demande. Veuillez vérifier votre connexion.'
    };
  }
}

