import React from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  Download, 
  Globe, 
  Smartphone, 
  CheckCircle2, 
  ShieldCheck, 
  Monitor, 
  ChevronRight,
  BookOpen,
  TrendingUp,
  Award,
  Zap
} from 'lucide-react';

export default function DownloadAppPage() {
  const apkUrl = "https://ton-id.supabase.co/storage/v1/object/public/apk/ecp-app.apk";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* 1. Header Minimaliste */}
      <header className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">
            Exceller <span className="text-indigo-600">chez Pierre</span>
          </span>
        </Link>
        <Link to="/" className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
          Retour à l'accueil
          <ChevronRight className="w-4 h-4" />
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* 2. Colonne de Gauche (Pitch et Actions) */}
          <div className="space-y-8 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[10px] uppercase tracking-wider">
              <Zap className="w-3 h-3 fill-indigo-500" />
              <span>Application Mobile Officielle</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Emportez votre académie de <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">statistiques</span> partout avec vous.
            </h1>
            
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
              Suivez vos formations en ligne, accédez aux résumés de vos séances de cours, téléchargez vos ressources pédagogiques (PDF, Excel, SPSS) et dialoguez en temps réel avec votre expert directement depuis votre smartphone Android, même hors connexion.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href={apkUrl}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-98"
              >
                <Download className="w-6 h-6" />
                <div className="text-left">
                  <div className="text-[10px] opacity-80 uppercase font-bold tracking-widest leading-none mb-1">Disponible pour</div>
                  <div className="text-base leading-none">Android (.apk)</div>
                </div>
              </a>
              
              <Link 
                to="/client/marketplace"
                className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-800 font-black rounded-2xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-98"
              >
                <Monitor className="w-6 h-6 text-indigo-600" />
                <div className="text-left">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-none mb-1">Accès direct</div>
                  <div className="text-base leading-none text-slate-700">Version Web</div>
                </div>
              </Link>
            </div>

            {/* Social Proof / Trust */}
            <div className="flex items-center gap-6 pt-4 border-t border-slate-200">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i + 10}`} 
                      alt="Avatar" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold text-slate-400">
                Plus de <span className="text-slate-700">250 apprenants</span> utilisent déjà l'application.
              </p>
            </div>
          </div>

          {/* 3. Colonne de Droite (Visuel Mobile Premium) */}
          <div className="relative flex justify-center lg:justify-end items-center py-12">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-200/20 blur-[100px] rounded-full pointer-events-none"></div>
            
            {/* Phone Frame */}
            <div className="relative w-[300px] h-[600px] bg-slate-900 rounded-[3rem] p-3 shadow-2xl border-4 border-slate-800 hover:rotate-2 transition-transform duration-500 group">
              {/* Internal Screen */}
              <div className="w-full h-full bg-white rounded-[2.2rem] overflow-hidden relative flex flex-col">
                {/* Mock UI Header */}
                <div className="bg-indigo-600 p-6 pt-10 text-white space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <div className="text-[10px] opacity-70 font-bold uppercase tracking-wider">Tableau de bord</div>
                      <div className="text-lg font-black leading-none">Bonjour, Pierre 👋</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Mock UI Content */}
                <div className="flex-1 p-5 space-y-5 bg-slate-50">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-1">
                      <Award className="w-5 h-5 text-indigo-500" />
                      <div className="text-[10px] font-bold text-slate-400">Quiz réussis</div>
                      <div className="text-lg font-black">12</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-1">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      <div className="text-[10px] font-bold text-slate-400">Progression</div>
                      <div className="text-lg font-black">84%</div>
                    </div>
                  </div>

                  {/* Course Card */}
                  <div className="space-y-3">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Mes Cours</div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs font-black text-slate-800 leading-tight">Statistiques Appliquées</div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="w-3/4 h-full bg-indigo-600 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 opacity-50">
                      <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                        <Monitor className="w-6 h-6" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs font-black text-slate-800 leading-tight">Maîtrise de SPSS v29</div>
                        <div className="h-1 bg-slate-100 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Nav Mock */}
                <div className="p-4 bg-white border-t border-slate-100 flex justify-around">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  <BookOpen className="w-5 h-5 text-slate-300" />
                  <Smartphone className="w-5 h-5 text-slate-300" />
                </div>
              </div>

              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-900 rounded-b-2xl"></div>
              
              {/* Reflection Shine */}
              <div className="absolute top-0 left-0 w-full h-full rounded-[3rem] bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>

        {/* 4. Guide d'Installation Rapide */}
        <section className="mt-20 max-w-4xl mx-auto">
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 sm:p-12 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-black text-slate-900">
                Comment installer l'application en 1 minute ?
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-8 relative">
              {/* Connector line on desktop */}
              <div className="hidden sm:block absolute top-6 left-12 right-12 h-0.5 bg-slate-100 -z-10"></div>
              
              {[
                { title: "Téléchargement", desc: "Cliquez sur le bouton violet ci-dessus pour récupérer le fichier sécurisé .apk." },
                { title: "Ouverture", desc: "Ouvrez le fichier depuis les notifications ou le dossier de téléchargements de votre téléphone." },
                { title: "Autorisation", desc: "Si Android affiche un message, autorisez \"l'installation depuis cette source\". C'est 100% sécurisé." }
              ].map((step, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center shadow-lg shadow-indigo-100">
                    {idx + 1}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 text-sm">{step.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-[11px] text-emerald-800 font-bold">
                L'application est certifiée sans malware et respecte strictement la confidentialité de vos données académiques.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 5. Footer Minimaliste */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs font-bold text-slate-400">
            © 2026 Exceller chez Pierre. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <a href="#" className="hover:text-indigo-600 transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Mentions Légales</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
