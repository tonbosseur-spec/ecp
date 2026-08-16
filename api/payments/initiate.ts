import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const fapshiApiUser = process.env.FAPSHI_API_USER || '';
const fapshiApiKey = process.env.FAPSHI_API_KEY || '';
const fapshiEnv = (process.env.FAPSHI_ENV || 'sandbox').toLowerCase();
const fapshiBaseUrl = fapshiEnv === 'live' ? 'https://live.fapshi.com' : 'https://sandbox.fapshi.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Autoriser uniquement POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const { registration_id, course_id, amount, course_title, redirect_url, payment_type, tranche_number } = req.body || {};

    // 2. Validation des paramètres obligatoires
    const parsedAmount = Math.round(Number(amount));
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount < 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'INVALID_AMOUNT', 
        message: 'Le montant minimum est de 100 FCFA.' 
      });
    }

    if (!registration_id && !course_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'MISSING_REGISTRATION_OR_COURSE',
        message: 'Identifiant d\'inscription ou de formation manquant.'
      });
    }

    // 3. Vérification de la configuration serveur Fapshi
    if (!fapshiApiUser || !fapshiApiKey) {
      console.error('[Fapshi Initiate] Clés Fapshi manquantes dans les variables d\'environnement');
      return res.status(500).json({ 
        success: false, 
        error: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message: 'La passerelle de paiement Fapshi n\'est pas encore configurée sur le serveur.'
      });
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'DATABASE_CONFIGURATION_ERROR',
        message: 'Configuration Supabase incomplète côté serveur.'
      });
    }

    // 4. Vérification de l'authentification Supabase (JWT Bearer)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'UNAUTHORIZED',
        message: 'Session utilisateur expirée ou absente.'
      });
    }
    const token = authHeader.split(' ')[1];

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'UNAUTHORIZED',
        message: 'Utilisateur non authentifié.'
      });
    }

    // Client Supabase avec privilèges service_role pour la création sécurisée du paiement
    const supabaseAdmin = supabaseServiceRoleKey 
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : supabaseUserClient;

    // 5. Récupération ou vérification de l'inscription
    let targetRegistrationId = registration_id;
    let targetCourseTitle = course_title || 'Formation';

    if (targetRegistrationId) {
      const { data: regData } = await supabaseAdmin
        .from('registrations')
        .select('id, course_id, participant_name, participant_email, courses(title)')
        .eq('id', targetRegistrationId)
        .maybeSingle();

      if (regData) {
        targetCourseTitle = (regData.courses as any)?.title || targetCourseTitle;
      }
    }

    // 6. Génération de l'identifiant externe unique pour Fapshi
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const externalId = `ecp_${Date.now()}_${uniqueSuffix}`;

    // 7. Détermination de l'URL de retour client
    const hostHeader = req.headers.host || 'excellerchezpierre.com';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const origin = (req.headers.origin as string) || `${protocol}://${hostHeader}`;
    const finalRedirectUrl = redirect_url || `${origin}/client/payment/result?externalId=${externalId}`;

    // 8. Création préalable d'une ligne de paiement "pending"
    const { data: paymentRecord, error: paymentInsertError } = await supabaseAdmin
      .from('payments')
      .insert([{
        user_id: user.id,
        registration_id: targetRegistrationId || null,
        course_id: course_id || null,
        amount: parsedAmount,
        status: 'pending',
        provider: 'fapshi',
        external_id: externalId,
        payment_type: payment_type || 'full',
        tranche_number: tranche_number || 1,
        due_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (paymentInsertError) {
      console.warn('[Fapshi Initiate] Avertissement insertion table payments:', paymentInsertError.message);
    }

    // 9. Appel API Fapshi /initiate-pay
    const fapshiPayload = {
      amount: parsedAmount,
      email: user.email || 'client@ecp.com',
      userId: user.id,
      externalId: externalId,
      redirectUrl: finalRedirectUrl,
      message: `Paiement ${targetCourseTitle.substring(0, 45)} - ECP`
    };

    const fapshiRes = await fetch(`${fapshiBaseUrl}/initiate-pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiuser': fapshiApiUser,
        'apikey': fapshiApiKey
      },
      body: JSON.stringify(fapshiPayload)
    });

    const fapshiData = await fapshiRes.json().catch(() => null);

    if (!fapshiRes.ok || !fapshiData || !fapshiData.link) {
      console.error('[Fapshi Initiate] Erreur réponse Fapshi:', fapshiRes.status, fapshiData);
      
      // Marquer le paiement comme échoué en base si l'appel a échoué
      if (paymentRecord?.id) {
        await supabaseAdmin
          .from('payments')
          .update({ 
            status: 'failed', 
            raw_payload: fapshiData || { error: 'Failed to reach Fapshi' },
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentRecord.id);
      }

      return res.status(502).json({
        success: false,
        error: 'FAPSHI_INITIATE_FAILED',
        message: fapshiData?.message || 'Impossible d\'initialiser le paiement avec Fapshi. Veuillez réessayer.',
        details: fapshiData
      });
    }

    // 10. Mettre à jour la transaction avec l'identifiant transId Fapshi
    if (fapshiData.transId && (paymentRecord?.id || externalId)) {
      const updateQuery = supabaseAdmin.from('payments').update({
        fapshi_trans_id: fapshiData.transId,
        raw_payload: fapshiData,
        updated_at: new Date().toISOString()
      });

      if (paymentRecord?.id) {
        await updateQuery.eq('id', paymentRecord.id);
      } else {
        await updateQuery.eq('external_id', externalId);
      }
    }

    // 11. Retourner le lien Fapshi au client React
    return res.status(200).json({
      success: true,
      link: fapshiData.link,
      transId: fapshiData.transId,
      externalId: externalId,
      message: 'Redirection vers la passerelle sécurisée Fapshi...'
    });

  } catch (err: any) {
    console.error('[Fapshi Initiate] Erreur interne:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Une erreur est survenue lors de l\'initialisation du paiement.'
    });
  }
}
