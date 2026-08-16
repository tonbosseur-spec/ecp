import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  BookOpen, 
  ShieldCheck,
  Home,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ClientPaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Paramètres pouvant être renvoyés par Fapshi ou notre redirectUrl
  const externalId = searchParams.get('externalId') || searchParams.get('external_id');
  const transId = searchParams.get('transId') || searchParams.get('trans_id');
  const queryStatus = searchParams.get('status');

  const [checking, setChecking] = useState<boolean>(true);
  const [paymentStatus, setPaymentStatus] = useState<'approved' | 'pending' | 'failed' | 'expired'>('pending');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [registrationDetails, setRegistrationDetails] = useState<any>(null);
  const [pollCount, setPollCount] = useState<number>(0);
  const [userSession, setUserSession] = useState<any>(null);

  // Déclencher les confettis lors du succès
  const triggerConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // Ignorer si indisponible
    }
  }, []);

  const checkPaymentStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUserSession(session);

      if (!session?.user) {
        setChecking(false);
        return;
      }

      // Recherche du paiement via externalId, transId ou le paiement le plus récent de l'utilisateur
      let paymentQuery = supabase.from('payments').select('*, registrations(*, courses(*))');

      if (transId) {
        paymentQuery = paymentQuery.eq('fapshi_trans_id', transId);
      } else if (externalId) {
        paymentQuery = paymentQuery.eq('external_id', externalId);
      } else {
        paymentQuery = paymentQuery
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      const { data: payData, error: payErr } = await paymentQuery.maybeSingle();

      if (payErr) {
        console.warn('Erreur vérification paiement:', payErr);
      }

      if (payData) {
        setPaymentDetails(payData);
        const reg = payData.registrations;
        if (reg) {
          setRegistrationDetails(reg);
          if (reg.payment_status === 'approved' || payData.status === 'paid') {
            setPaymentStatus('approved');
            setChecking(false);
            triggerConfetti();
            return;
          } else if (payData.status === 'failed' || reg.payment_status === 'rejected') {
            setPaymentStatus('failed');
            setChecking(false);
            return;
          } else if (payData.status === 'expired') {
            setPaymentStatus('expired');
            setChecking(false);
            return;
          }
        }
      }

      // Recherche directe dans les inscriptions si non trouvé via payments
      const { data: regList } = await supabase
        .from('registrations')
        .select('*, courses(*)')
        .eq('client_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (regList && regList.length > 0) {
        const latestReg = regList[0];
        setRegistrationDetails(latestReg);
        if (latestReg.payment_status === 'approved') {
          setPaymentStatus('approved');
          setChecking(false);
          triggerConfetti();
          return;
        }
      }

      // Si le paramètre d'URL indiquait un succès
      if (queryStatus && queryStatus.toUpperCase() === 'SUCCESSFUL') {
        setPaymentStatus('approved');
        triggerConfetti();
      } else if (queryStatus && ['FAILED', 'EXPIRED'].includes(queryStatus.toUpperCase())) {
        setPaymentStatus('failed');
      } else {
        setPaymentStatus('pending');
      }

    } catch (err) {
      console.error('Erreur globale checkPaymentStatus:', err);
    } finally {
      setChecking(false);
    }
  }, [externalId, transId, queryStatus, triggerConfetti]);

  // Polling doux pendant les premières 30 secondes pour capter la validation du webhook
  useEffect(() => {
    checkPaymentStatus();

    const interval = setInterval(() => {
      setPollCount((prev) => {
        if (prev < 6 && paymentStatus === 'pending') {
          checkPaymentStatus();
          return prev + 1;
        }
        return prev;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [checkPaymentStatus, paymentStatus]);

  const courseTitle = registrationDetails?.courses?.title || paymentDetails?.registrations?.courses?.title || 'Votre formation';
  const courseId = registrationDetails?.course_id || paymentDetails?.course_id;
  const amountPaid = paymentDetails?.amount;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans">
      <div className="max-w-xl mx-auto w-full pt-6 sm:pt-12">
        {/* Logo / Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
            ECP
          </div>
          <span className="font-bold text-lg text-white tracking-tight">Exceller chez Pierre</span>
        </div>

        {/* Card principale */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Badge statut */}
          <div className="flex justify-center mb-6">
            {paymentStatus === 'approved' ? (
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
            ) : paymentStatus === 'failed' || paymentStatus === 'expired' ? (
              <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
                <AlertCircle className="w-10 h-10" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Clock className="w-10 h-10 animate-spin" />
              </div>
            )}
          </div>

          {/* Titre & Message */}
          <div className="text-center space-y-2 mb-8">
            {paymentStatus === 'approved' ? (
              <>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider rounded-full">
                  Paiement Confirmé
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Félicitations ! Votre accès est débloqué
                </h1>
                <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  Votre règlement par Mobile Money / Orange Money a été validé avec succès. Vous avez désormais un accès complet à votre formation.
                </p>
              </>
            ) : paymentStatus === 'failed' || paymentStatus === 'expired' ? (
              <>
                <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-wider rounded-full">
                  {paymentStatus === 'expired' ? 'Délai expiré' : 'Paiement non abouti'}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  La transaction n'a pas pu aboutir
                </h1>
                <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  La demande de débit a été annulée, refusée ou le délai de confirmation est dépassé. Aucun montant n'a été prélevé sans validation.
                </p>
              </>
            ) : (
              <>
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider rounded-full">
                  En attente de confirmation
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Validation du paiement en cours...
                </h1>
                <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  Nous synchronisons avec Fapshi et votre opérateur mobile. Dès réception du webhook opérateur, votre inscription passera en accès approuvé.
                </p>
              </>
            )}
          </div>

          {/* Récapitulatif de la transaction */}
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 sm:p-5 mb-8 space-y-3">
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-400 font-medium">Formation :</span>
              <span className="text-white font-bold text-right truncate max-w-[240px]">{courseTitle}</span>
            </div>
            {amountPaid && (
              <div className="flex justify-between items-center text-xs sm:text-sm pt-2 border-t border-slate-800">
                <span className="text-slate-400 font-medium">Montant réglé :</span>
                <span className="text-emerald-400 font-black">{Number(amountPaid).toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs sm:text-sm pt-2 border-t border-slate-800">
              <span className="text-slate-400 font-medium">Passerelle :</span>
              <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Fapshi (MTN MoMo / Orange Money)
              </span>
            </div>
            {transId && (
              <div className="flex justify-between items-center text-[11px] sm:text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">Réf. transaction :</span>
                <span className="text-slate-400 font-mono">{transId}</span>
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="space-y-3">
            {paymentStatus === 'approved' ? (
              <>
                {courseId ? (
                  <Link
                    to={`/client/course/${courseId}`}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.99]"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>Accéder aux cours et modules</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                ) : (
                  <Link
                    to="/client/hub"
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.99]"
                  >
                    <Home className="w-5 h-5" />
                    <span>Accéder à mon espace étudiant</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                )}
                <Link
                  to="/client/hub"
                  className="w-full py-3 px-6 bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <Home className="w-4 h-4" />
                  <span>Mon tableau de bord client</span>
                </Link>
              </>
            ) : paymentStatus === 'failed' || paymentStatus === 'expired' ? (
              <>
                <Link
                  to="/catalogue"
                  className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Réessayer l'inscription / le paiement</span>
                </Link>
                <a
                  href="https://wa.me/237698389030?text=Bonjour%2C%20j%27ai%20rencontr%C3%A9%20un%20souci%20lors%20de%20mon%20paiement%20Mobile%20Money%20sur%20Exceller%20chez%20Pierre."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-6 bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>Besoin d'aide ? Contacter le support WhatsApp</span>
                </a>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setChecking(true);
                    checkPaymentStatus();
                  }}
                  disabled={checking}
                  className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
                  <span>Vérifier le statut du paiement</span>
                </button>
                <Link
                  to="/client/hub"
                  className="w-full py-3 px-6 bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <Home className="w-4 h-4" />
                  <span>Patienter dans mon espace client</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Footer sécurité */}
        <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            Paiement chiffré et sécurisé par Fapshi (Orange Money & MTN Mobile Money).
          </p>
          <p>© {new Date().getFullYear()} Exceller chez Pierre — Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
