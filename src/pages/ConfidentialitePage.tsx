import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { Shield, Lock, Database, Trash2, CheckCircle2, FileCheck } from 'lucide-react';

export default function ConfidentialitePage() {
  const [currentSession, setCurrentSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-blue-200">
      <ClientNavBar currentSession={currentSession} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Header */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-150 shadow-xs mb-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-4">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>Protection des Données Personnelles</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3">
            Politique de Confidentialité
          </h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">
            Comment nous collectons, utilisons et protégeons vos données conformément aux lois camerounaises.
          </p>
        </div>

        {/* Content sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">1. Collecte des Données Personnelles</h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Dans le cadre de l'utilisation du site web et de l'application Android, nous collectons les données strictement nécessaires :
            </p>

            <div className="space-y-3 text-sm">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Informations de compte
                </h3>
                <p className="text-gray-600">Adresse email, nom/prénom, mot de passe (stocké de manière hautement sécurisée et hachée via Supabase Auth).</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Données de progression
                </h3>
                <p className="text-gray-600">Modules complétés, scores obtenus aux quiz et challenges interactifs.</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Données de transaction
                </h3>
                <p className="text-gray-600">
                  Historique des inscriptions et identifiants de paiement Mobile Money (MTN / Orange Money). 
                  <span className="block mt-1 font-semibold text-emerald-700">🔒 Aucune donnée bancaire ni code secret PIN n'est stocké sur nos serveurs.</span>
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">2. Cadre Légal et Finalité des Traitements</h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Conformément à la <strong>Loi n° 2010/012 du 21 décembre 2010 relative à la cybersécurité et à la cybercriminalité au Cameroun</strong>, la collecte de vos données a pour seules finalités :
            </p>

            <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <li>Vous fournir l'accès à vos formations, replays et ressources pédagogiques.</li>
              <li>Suivre votre progression pédagogique et vous attribuer vos réductions/certificats.</li>
              <li>Assurer la sécurité de votre compte et prévenir les tentatives de fraude.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">3. Cookies et Stockage Local (Local Storage)</h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              L'application web et mobile n'utilise pas de cookies publicitaires tiers traçants. Nous utilisons uniquement le <strong>Stockage Local (`localStorage`)</strong> et des jetons d'authentification sécurisés (JWT) pour :
            </p>

            <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <li>Maintenir votre session connectée sans que vous ayez à ressaisir votre mot de passe à chaque ouverture de l'application Android ou du navigateur.</li>
              <li>Adapter l'interface utilisateur selon que vous utilisez la version Web ou l'application Android native (.apk).</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">4. Suppression de Compte et Droit d'Accès</h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Conformément aux réglementations sur la protection des données personnelles et aux exigences de Google Play :
            </p>

            <div className="space-y-3 text-sm">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1">Droit d'accès et de rectification</h3>
                <p className="text-gray-600">Vous pouvez à tout moment consulter et modifier vos informations personnelles depuis votre espace client.</p>
              </div>

              <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 text-rose-900 space-y-2">
                <h3 className="font-bold text-rose-950">Demande de suppression définitive de compte</h3>
                <p className="text-xs sm:text-sm">Vous avez le droit d'exiger la suppression totale de votre compte et de toutes les données associées (progression, résultats de quiz, historique).</p>
                <p className="text-xs font-semibold">
                  📩 Procédure : Vous pouvez en faire la demande directe par email à <a href="mailto:contact@excellerchezpierre.com" className="underline font-bold">contact@excellerchezpierre.com</a> ou via les paramètres de votre compte client. Vos données seront définitivement effacées sous <strong>72 heures</strong>.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
