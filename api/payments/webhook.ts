import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const fapshiWebhookSecret = process.env.FAPSHI_WEBHOOK_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Uniquement requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    // 2. Vérification de la signature / header secret Webhook Fapshi
    const incomingSecret = (req.headers['x-wh-secret'] || req.headers['x-webhook-secret'] || req.headers['x-fapshi-secret']) as string | undefined;

    if (!fapshiWebhookSecret) {
      console.error('[Fapshi Webhook] FAPSHI_WEBHOOK_SECRET non configuré sur le serveur !');
      return res.status(500).json({ 
        success: false, 
        error: 'WEBHOOK_SECRET_NOT_CONFIGURED',
        message: 'Le secret de webhook n\'est pas configuré sur le serveur.' 
      });
    }

    if (!incomingSecret || incomingSecret !== fapshiWebhookSecret) {
      console.warn('[Fapshi Webhook] Rejet: Secret de webhook invalide ou manquant.');
      return res.status(401).json({ 
        success: false, 
        error: 'UNAUTHORIZED_WEBHOOK', 
        message: 'En-tête x-wh-secret invalide.' 
      });
    }

    // 3. Extraction du payload Fapshi
    const payload = req.body || {};
    const { transId, status, amount, externalId, userId } = payload;

    if (!transId && !externalId) {
      return res.status(400).json({ 
        success: false, 
        error: 'INVALID_PAYLOAD', 
        message: 'transId ou externalId manquant.' 
      });
    }

    console.log(`[Fapshi Webhook] Réception notification: transId=${transId}, externalId=${externalId}, status=${status}, amount=${amount}`);

    // 4. Initialisation du client Supabase Service Role (contourne RLS pour mettre à jour de manière fiable)
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[Fapshi Webhook] Configuration Supabase manquante côté serveur.');
      return res.status(500).json({ success: false, error: 'DATABASE_CONFIG_ERROR' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });

    // 5. Recherche de l'enregistrement de paiement existant
    let payment: any = null;

    if (transId) {
      const { data } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('fapshi_trans_id', transId)
        .maybeSingle();
      payment = data;
    }

    if (!payment && externalId) {
      const { data } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('external_id', externalId)
        .maybeSingle();
      payment = data;
    }

    const upperStatus = String(status || '').toUpperCase();

    // 6. Traitement selon le statut Fapshi (SUCCESSFUL | FAILED | EXPIRED | PENDING | CREATED)
    if (upperStatus === 'SUCCESSFUL') {
      // Idempotence : si déjà marqué comme payé, répondre 200 immédiatement
      if (payment && payment.status === 'paid') {
        console.log(`[Fapshi Webhook] Transaction ${transId || externalId} déjà traitée (statut paid).`);
        return res.status(200).json({ 
          success: true, 
          message: 'Paiement déjà validé précédemment (idempotent).' 
        });
      }

      // Mettre à jour la ligne de paiement
      const nowIso = new Date().toISOString();
      const updatedPaymentData = {
        status: 'paid',
        paid_at: nowIso,
        raw_payload: payload,
        fapshi_trans_id: transId || payment?.fapshi_trans_id,
        updated_at: nowIso
      };

      if (payment?.id) {
        await supabaseAdmin
          .from('payments')
          .update(updatedPaymentData)
          .eq('id', payment.id);
      } else {
        // Si le paiement n'avait pas été inséré avant (cas rare), on le crée
        const { data: newPay } = await supabaseAdmin
          .from('payments')
          .insert([{
            user_id: userId || null,
            amount: Number(amount) || 0,
            status: 'paid',
            provider: 'fapshi',
            fapshi_trans_id: transId,
            external_id: externalId,
            paid_at: nowIso,
            raw_payload: payload,
            created_at: nowIso,
            updated_at: nowIso
          }])
          .select()
          .single();
        payment = newPay;
      }

      // 7. Débloquer l'inscription liée (passer payment_status en 'approved')
      const targetRegistrationId = payment?.registration_id;

      if (targetRegistrationId) {
        const { error: regUpdateError } = await supabaseAdmin
          .from('registrations')
          .update({
            payment_status: 'approved',
            transaction_id: transId || `FAPSHI_${externalId}`,
            updated_at: nowIso
          })
          .eq('id', targetRegistrationId);

        if (regUpdateError) {
          console.error('[Fapshi Webhook] Erreur mise à jour inscription:', regUpdateError.message);
        } else {
          console.log(`[Fapshi Webhook] Inscription #${targetRegistrationId} validée et accès débloqué avec succès !`);
        }

        // Si le système de parrainage existe, valider aussi la vente parrainée
        try {
          await supabaseAdmin
            .from('referral_sales')
            .update({ status: 'approved', updated_at: nowIso })
            .eq('registration_id', targetRegistrationId);
        } catch (refErr) {
          // Table referral_sales facultative
        }
      } else if (userId) {
        // Si pas de registration_id explicite mais un user_id, approuver l'inscription en attente la plus récente
        const { data: pendingReg } = await supabaseAdmin
          .from('registrations')
          .select('id')
          .eq('client_id', userId)
          .eq('payment_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingReg?.id) {
          await supabaseAdmin
            .from('registrations')
            .update({
              payment_status: 'approved',
              transaction_id: transId || `FAPSHI_${externalId}`
            })
            .eq('id', pendingReg.id);
          
          console.log(`[Fapshi Webhook] Inscription client #${pendingReg.id} approuvée automatiquement.`);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Paiement confirmé avec succès et accès débloqué.'
      });

    } else if (upperStatus === 'FAILED' || upperStatus === 'EXPIRED') {
      const nowIso = new Date().toISOString();
      const failStatus = upperStatus.toLowerCase(); // 'failed' | 'expired'

      if (payment?.id) {
        await supabaseAdmin
          .from('payments')
          .update({
            status: failStatus,
            raw_payload: payload,
            updated_at: nowIso
          })
          .eq('id', payment.id);
      }

      console.log(`[Fapshi Webhook] Paiement marqué comme ${failStatus} pour transId=${transId}`);

      return res.status(200).json({
        success: true,
        message: `Statut ${failStatus} enregistré.`
      });

    } else {
      // Statuts intermédiaires (CREATED, PENDING...)
      return res.status(200).json({
        success: true,
        message: `Notification de statut ${status} reçue.`
      });
    }

  } catch (err: any) {
    console.error('[Fapshi Webhook] Erreur traitement webhook:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors du traitement du webhook Fapshi.'
    });
  }
}
