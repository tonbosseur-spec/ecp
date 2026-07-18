import React, { useEffect } from 'react';
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
  Zap,
  WifiOff,
  PlayCircle,
  MessageCircle,
  Lock
} from 'lucide-react';

export default function DownloadAppPage() {
  const apkUrl = "https://titncxnaixghtoerkfiu.supabase.co/storage/v1/object/public/APK/Exceller%20chez%20Pierre.apk";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500/30 selection:text-purple-200 overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-800/20 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-900/20 group-hover:scale-105 group-hover:rotate-3 transition-all">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">
            Exceller <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">chez Pierre</span>
          </span>
        </Link>
        <Link to="/" className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800 backdrop-blur-sm">
          Retour au site
          <ChevronRight className="w-4 h-4" />
        </Link>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center mb-32">
          
          {/* Left Column: Pitch */}
          <div className="space-y-8 max-w-xl relative">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-xs uppercase tracking-wider backdrop-blur-sm shadow-inner shadow-purple-500/10">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Nouveau : Application Android Officielle</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05]">
              L'excellence <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400">
                dans votre poche.
              </span>
            </h1>
            
            <p className="text-slate-400 text-lg sm:text-xl leading-relaxed font-medium">
              Formez-vous aux statistiques sans contrainte. Suivez vos cours en vidéo, validez vos quiz et téléchargez vos ressources pour apprendre même sans connexion internet.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a 
                href={apkUrl}
                className="flex-1 flex items-center justify-center gap-4 px-8 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-purple-900/30 hover:shadow-purple-900/50 transition-all hover:-translate-y-1 active:translate-y-0 group border border-purple-500/30"
              >
                <div className="bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                  <Download className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-purple-200 uppercase font-bold tracking-widest leading-none mb-1">Téléchargement sécurisé</div>
                  <div className="text-lg leading-none">Android (.apk)</div>
                </div>
              </a>
            </div>

            <div className="flex items-center gap-6 pt-8">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center overflow-hidden">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i + 20}`} 
                      alt="Avatar" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm font-bold text-slate-400">
                Rejoignez <span className="text-white">400+ apprenants</span> sur mobile.
              </p>
            </div>
          </div>

          {/* Right Column: Immersive Phone Mockup */}
          <div className="relative flex justify-center items-center py-12 lg:py-0">
            {/* Glow behind phone */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 blur-[80px] rounded-full pointer-events-none" />
            
            {/* Floating Badges */}
            <div className="absolute -left-6 top-1/4 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-3.5 rounded-2xl shadow-2xl animate-bounce" style={{ animationDuration: '4s' }}>
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Mode Hors-ligne</p>
                  <p className="text-[10px] text-slate-400 font-medium">Cours téléchargés</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-8 bottom-1/3 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-3.5 rounded-2xl shadow-2xl animate-bounce" style={{ animationDuration: '5s', animationDelay: '1s' }}>
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/20 p-2 rounded-xl text-purple-400">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Vidéos HD</p>
                  <p className="text-[10px] text-slate-400 font-medium">Lecteur optimisé</p>
                </div>
              </div>
            </div>
            
            {/* Phone Frame */}
            <div className="relative w-[320px] h-[640px] bg-slate-950 rounded-[3rem] p-3 shadow-2xl shadow-purple-900/20 border border-slate-800 rotate-[-5deg] hover:rotate-0 transition-transform duration-700 ease-out group z-10">
              {/* Inner Screen */}
              <div className="w-full h-full bg-slate-900 rounded-[2.2rem] overflow-hidden relative flex flex-col border border-slate-800/50">
                {/* Status Bar */}
                <div className="h-7 w-full flex items-center justify-between px-6 pt-2 z-20 absolute top-0 text-white">
                  <span className="text-[10px] font-medium">9:41</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-white"></div>
                    <div className="w-3 h-3 rounded-full bg-white"></div>
                    <div className="w-4 h-3 rounded-sm bg-white"></div>
                  </div>
                </div>

                {/* Mock UI Header */}
                <div className="bg-slate-950 p-6 pt-12 border-b border-slate-800 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/20 blur-[30px] rounded-full" />
                  <div className="flex justify-between items-center relative z-10">
                    <div className="space-y-1">
                      <div className="text-[10px] text-purple-400 font-black uppercase tracking-widest">Client Hub</div>
                      <div className="text-xl font-black text-white">Bonjour, Pierre 👋</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-purple-400" />
                    </div>
                  </div>
                </div>

                {/* Mock UI Content */}
                <div className="flex-1 p-5 space-y-5 overflow-hidden">
                  {/* Progress Card */}
                  <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 p-4 rounded-2xl border border-purple-500/20 backdrop-blur-sm">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mb-1">En cours</div>
                        <div className="text-sm font-bold text-white">Statistiques Appliquées</div>
                      </div>
                      <div className="text-2xl font-black text-white">68%</div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="w-[68%] h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full" />
                    </div>
                  </div>

                  {/* Features Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quizzes</div>
                      <div className="text-sm font-bold text-white">12 Validés</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ressources</div>
                      <div className="text-sm font-bold text-white">42 Fichiers</div>
                    </div>
                  </div>

                  {/* Modules List */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prochains Modules</div>
                    
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <span className="text-xs font-black">M3</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">Régression Linéaire</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Vidéo • 45 min</div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 flex items-center gap-3 opacity-60">
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400">Analyse de Variance</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">Quiz requis</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Nav Mock */}
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-around items-center">
                  <div className="flex flex-col items-center gap-1 text-purple-400">
                    <GraduationCap className="w-5 h-5" />
                    <span className="text-[8px] font-bold">Apprendre</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-slate-500">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-[8px] font-bold">Messages</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-slate-500">
                    <Monitor className="w-5 h-5" />
                    <span className="text-[8px] font-bold">Catalogue</span>
                  </div>
                </div>
              </div>

              {/* Hardware Details */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-slate-950 rounded-b-3xl" />
              <div className="absolute top-[120px] -left-1 w-1 h-12 bg-slate-800 rounded-l-md" />
              <div className="absolute top-[180px] -left-1 w-1 h-24 bg-slate-800 rounded-l-md" />
              <div className="absolute top-[140px] -right-1 w-1 h-16 bg-slate-800 rounded-r-md" />
              
              {/* Screen Reflection */}
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Bento Grid Features */}
        <section className="mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Conçue pour votre réussite.</h2>
            <p className="text-slate-400">Toutes les fonctionnalités du site web, optimisées pour le format mobile.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] hover:border-slate-700 transition-colors">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-6">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Téléchargements</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Téléchargez vos fiches de cours et datasets Excel/SPSS pour travailler hors-connexion, dans les transports ou en déplacement.</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] hover:border-slate-700 transition-colors">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 mb-6">
                <PlayCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Lecteur Immersif</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Profitez d'un lecteur vidéo HD natif, et passez en mode plein écran immersif pour lire vos leçons sans distraction.</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] hover:border-slate-700 transition-colors">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Quiz & Progression</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Validez vos acquis directement sur votre téléphone. Votre progression est synchronisée en temps réel avec le portail web.</p>
            </div>
          </div>
        </section>

        {/* Installation Guide */}
        <section className="max-w-4xl mx-auto">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[60px] rounded-full" />
            
            <div className="flex items-center gap-4 mb-10 relative z-10">
              <div className="p-3 bg-indigo-500/20 rounded-2xl">
                <ShieldCheck className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Installation Sécurisée</h2>
                <p className="text-sm font-medium text-slate-400">En 3 étapes simples, sans passer par le Play Store.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-8 relative z-10">
              {/* Connector line on desktop */}
              <div className="hidden sm:block absolute top-6 left-12 right-12 h-0.5 bg-slate-800 -z-10" />
              
              {[
                { title: "1. Téléchargement", desc: "Cliquez sur le bouton pour récupérer le fichier .apk sur votre appareil." },
                { title: "2. Ouverture", desc: "Ouvrez le fichier depuis les notifications ou votre dossier de téléchargements." },
                { title: "3. Autorisation", desc: "Si demandé, autorisez l'installation 'depuis cette source' (procédure Android standard)." }
              ].map((step, idx) => (
                <div key={idx} className="space-y-4 bg-slate-950/50 sm:bg-transparent p-6 sm:p-0 rounded-2xl border border-slate-800 sm:border-none">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center shadow-lg shadow-indigo-900/50 text-xl border border-indigo-400/30">
                    {idx + 1}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-white text-base">{step.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex sm:items-center gap-4 relative z-10">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-1 sm:mt-0" />
              <p className="text-sm text-emerald-200 font-medium">
                L'application est certifiée sans malware. Elle ne nécessite aucune permission abusive et respecte la confidentialité de vos données académiques.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-950 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-slate-400">
              <GraduationCap className="w-5 h-5" />
              <span className="text-sm font-bold">© 2026 Exceller chez Pierre.</span>
            </div>
            <div className="flex items-center gap-6 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <span className="hover:text-white transition-colors cursor-pointer">Confidentialité</span>
              <span className="hover:text-white transition-colors cursor-pointer">Support Client</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
