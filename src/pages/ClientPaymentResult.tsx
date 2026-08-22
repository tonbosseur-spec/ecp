import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Clock, 
  ArrowRight, 
  BookOpen, 
  ShieldCheck,
  Home,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';

export default function ClientPaymentResult() {
  const [searchParams] = useSearchParams();
  const regId = searchParams.get('registration_id') || searchParams.get('reg_id');

  const [registrationDetails, setRegistrationDetails] = useState<any>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegistration = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      let query = supabase
        .from('registrations')
        .select('*, courses(*)')
        .eq('client_id', session.user.id)
        .order('created_at', { ascending: false });

      if (regId) {
        query = query.eq('id', regId);
      }

      const { data } = await query.limit(1);
      if (data && data.length > 0) {
        setRegistrationDetails(data[0]);
      }
    };

    fetchRegistration();
  }, [regId]);

  const courseTitle = registrationDetails?.courses?.title || 'Votre formation';
  const price = registrationDetails?.courses?.price;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const whatsappMessage = encodeURIComponent(
    `Bonjour M. Pierre,\n\nJe viens de m'inscrire à la formation "${courseTitle}".\n\nMon inscription est enregistrée. Je souhaite valider mon paiement Mobile Money.\n\nMerci !`
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans">
      <div className="max-w-xl mx-auto w-full pt-6 sm:pt-12">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
            ECP
          </div>
          <span className="font-bold text-lg text-white tracking-tight">Exceller chez Pierre</span>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Badge icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>
          </div>

          {/* Title & Message */}
          <div className="text-center space-y-2 mb-8">
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider rounded-full">
              Demande d'inscription enregistrée
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Instructions de paiement Mobile Money
            </h1>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Votre demande d'inscription à <strong className="text-white">{courseTitle}</strong> est enregistrée. Effectuez votre transfert manuel pour activer immédiatement votre accès.
            </p>
          </div>

          {/* Payment instructions */}
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-5 mb-8 space-y-4">
            <h2 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">Numéros de dépôt direct :</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Orange Money / MTN Mobile Money (Pierre Ymele)</p>
                  <p className="text-base font-black text-emerald-400 font-mono">+237 650 989 019</p>
                </div>
                <button
                  onClick={() => copyToClipboard('650989019')}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
                  title="Copier le numéro"
                >
                  {copiedNumber === '650989019' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                <div>
                  <p className="text-xs text-slate-400 font-medium">WhatsApp Direct Administration</p>
                  <p className="text-base font-black text-emerald-400 font-mono">+237 698 389 030</p>
                </div>
                <button
                  onClick={() => copyToClipboard('698389030')}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
                  title="Copier le numéro"
                >
                  {copiedNumber === '698389030' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {price && (
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Montant à régler :</span>
                <span className="text-emerald-400 font-black text-lg">{Number(price).toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <a
              href={`https://wa.me/237698389030?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.99]"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Envoyer le reçu / Preuve sur WhatsApp</span>
              <ArrowRight className="w-5 h-5" />
            </a>

            <Link
              to="/client/hub"
              className="w-full py-3 px-6 bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Aller sur mon tableau de bord</span>
            </Link>
          </div>
        </div>

        {/* Security Footer */}
        <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            Service de validation manuelle rapide — Exceller chez Pierre.
          </p>
          <p>© {new Date().getFullYear()} Exceller chez Pierre — Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
