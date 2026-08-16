import { supabase } from './supabaseClient';

export interface InitiatePaymentParams {
  registrationId?: string;
  courseId?: string;
  amount: number;
  courseTitle?: string;
  paymentType?: 'full' | 'installment';
  trancheNumber?: number;
  redirectUrl?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  link?: string;
  transId?: string;
  externalId?: string;
  error?: string;
  message?: string;
}

/**
 * Initialise un paiement Fapshi (Mobile Money / Orange Money) sécurisé
 * en appelant l'API serveur avec le JWT de session de l'étudiant.
 */
export async function initiateFapshiPayment(params: InitiatePaymentParams): Promise<InitiatePaymentResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return {
        success: false,
        error: 'UNAUTHENTICATED',
        message: 'Vous devez être connecté pour effectuer un paiement.'
      };
    }

    const payload = {
      registration_id: params.registrationId,
      course_id: params.courseId,
      amount: Math.round(params.amount),
      course_title: params.courseTitle,
      payment_type: params.paymentType || 'full',
      tranche_number: params.trancheNumber || 1,
      redirect_url: params.redirectUrl || `${window.location.origin}/client/payment/result`
    };

    const response = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success || !data?.link) {
      const errMsg = data?.message || data?.error || 'Erreur lors de l\'initialisation du paiement.';
      return {
        success: false,
        error: data?.error || 'PAYMENT_INITIATE_FAILED',
        message: errMsg
      };
    }

    return {
      success: true,
      link: data.link,
      transId: data.transId,
      externalId: data.externalId,
      message: data.message
    };
  } catch (err: any) {
    console.error('Erreur initiateFapshiPayment:', err);
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Impossible de joindre le serveur de paiement. Vérifiez votre connexion internet.'
    };
  }
}
