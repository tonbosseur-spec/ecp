import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { Building2, Server, ShieldCheck, Mail, Phone, MapPin, Globe, FileText } from 'lucide-react';

export default function MentionsLegalesPage() {
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
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 mb-4">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Informations Légales Officielle</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3">
            Mentions Légales
          </h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">
            Conformément aux lois camerounaises relatives au commerce électronique et à la cybersécurité.
          </p>
        </div>

        {/* Content sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">1. Éditeur du Site et de l'Application</h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Le site web et l'application mobile <strong className="text-gray-900">Exceller chez Pierre</strong> sont édités par l'entreprise <strong className="text-gray-900">ASTRAL</strong> (Nuru Lab).
            </p>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Nom Commercial</span>
                <p className="font-bold text-gray-800">ASTRAL — Exceller chez Pierre</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Direction de Publication</span>
                <p className="font-bold text-gray-800">Pierre MBOM</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Siège Social</span>
                  <p className="font-semibold text-gray-800">Yaoundé, Cameroun</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1 flex items-start gap-2">
                <Globe className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Identifiant Unique (NIU) / RCCM</span>
                  <p className="font-semibold text-gray-800">Enregistré au Registre du Commerce</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1 flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Contact E-mail</span>
                  <a href="mailto:contact@excellerchezpierre.com" className="font-semibold text-blue-600 hover:underline">contact@excellerchezpierre.com</a>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1 flex items-start gap-2">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Téléphone / WhatsApp</span>
                  <p className="font-semibold text-gray-800">+237 698 38 90 30</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Server className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">2. Hébergement et Infrastructures Techniques</h2>
            </div>

            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1">Hébergement Web & Client-side</h3>
                <p><strong>Vercel Inc.</strong> — 340 S Lemon Ave #4133 Walnut, CA 91789, USA</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1">Base de Données & Authentification (Backend)</h3>
                <p><strong>Supabase Inc.</strong> — 970 Toa Payoh North #07-04, Singapore</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1">Stockage des Fichiers et APK</h3>
                <p>Supabase Storage / CDN officiel avec chiffrement au repos.</p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-150 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">3. Propriété Intellectuelle</h2>
            </div>

            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>
                L'ensemble des contenus présents sur la plateforme <strong>Exceller chez Pierre</strong> (notamment les cours, vidéos, résumés de séances, bases de données, quiz, logos, visuels et le fichier d'installation APK) sont protégés par le droit d'auteur et les dispositions relatives à la propriété intellectuelle en vigueur au Cameroun (<em>Loi n° 2000/011 du 19 décembre 2000 relative au droit d'auteur et aux droits voisins</em>).
              </p>
              <div className="p-4 bg-amber-50/60 border border-amber-200/60 text-amber-900 rounded-2xl font-medium text-xs sm:text-sm">
                ⚠️ Toute reproduction, distribution, modification ou revente non autorisée de ces supports, sous quelque forme que ce soit, est strictement interdite et fera l'objet de poursuites judiciaires.
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
