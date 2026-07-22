import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { BookOpen, Key, Award, Smartphone, Scale } from 'lucide-react';

export default function CGUPage() {
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
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100 mb-4">
            <BookOpen className="w-3.5 h-3.5 text-purple-600" />
            <span>Conditions d'Utilisation & de Vente</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3">
            CGU / CGV
          </h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">
            Règles régissant l'accès aux services, la souscription aux formations et l'utilisation de l'application.
          </p>
        </div>

        {/* Content sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">1. Objet et Accès aux Services</h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Les présentes CGU/CGV régissent l'accès et l'utilisation de la plateforme <strong>Exceller chez Pierre</strong>, accessible via le Web ou via l'application Android native (.apk).
              L'inscription sur la plateforme implique l'acceptation sans réserve des présentes conditions.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Key className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">2. Modalités d'Inscriptions et Accès Paywall</h2>
            </div>

            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p>La création de compte permet d'accéder au catalogue, aux quiz d'évaluation et aux informations générales des formations.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p>L'accès aux contenus d'apprentissage dits "Premium" (résumés détaillés, replays vidéo, fichiers d'exercices Excel/SPSS) est conditionné par le règlement complet de la formation ou la validation de l'inscription par l'administration ("Statut Validé").</p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">3. Politique de Réduction et Challenge Public</h2>
            </div>

            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>Les codes de réduction générés à l'issue des tests de niveau interactifs (Quiz Lead Magnet) sont personnels, non transmissibles et soumis à une durée de validité limitée.</p>
              <p>L'attribution d'une réduction (ex: 20% ou 50%) ne constitue pas un engagement contractuel permanent et peut être modifiée selon les campagnes promotionnelles en cours.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">4. Téléchargement et Utilisation de l'Application Android (.apk)</h2>
            </div>

            <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <li>L'application Android est mise à disposition sous forme de fichier <code>.apk</code> hébergé sur nos serveurs sécurisés.</li>
              <li>L'utilisateur est autorisé à installer l'application sur ses appareils personnels.</li>
              <li>Il est strictement interdit d'extraire, de décompiler, de modifier le code source ou de redistribuer le fichier <code>.apk</code> sur des plateformes de téléchargement tierces non autorisées.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                <Scale className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">5. Droit Applicable et Juridiction Compétente</h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Les présentes conditions sont régies par le <strong>droit camerounais</strong> (notamment la <em>Loi n° 2010/013 du 21 décembre 2010 régissant le commerce électronique au Cameroun</em>). En cas de litige relatif à l'interprétation ou à l'exécution des présentes, et à défaut d'accord à l'amiable, les tribunaux compétents de <strong>Yaoundé, Cameroun</strong> seront seuls habilités à trancher.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
