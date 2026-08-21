import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Terminal, 
  FileSpreadsheet, 
  ArrowRight,
  Sparkles,
  Code2
} from 'lucide-react';
import { motion } from 'motion/react';

export default function ClientTrainingHub() {
  const environments = [
    {
      id: 'r',
      title: 'R',
      subtitle: 'Écrire et exécuter du code R',
      description: 'Expérimentez librement avec R',
      path: '/client/training/r',
      badge: 'WebR Actif',
      icon: Terminal,
      color: {
        bg: 'bg-gradient-to-br from-indigo-500 to-purple-700',
        lightBg: 'bg-indigo-50/70',
        border: 'border-indigo-100',
        text: 'text-indigo-700',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        hoverBorder: 'hover:border-indigo-300 group-hover:shadow-indigo-500/10'
      }
    },
    {
      id: 'excel',
      title: 'Excel',
      subtitle: 'Cellules et formules',
      description: 'Expérimentez librement avec Excel',
      path: '/client/training/excel',
      badge: 'Excel Lab',
      icon: FileSpreadsheet,
      color: {
        bg: 'bg-gradient-to-br from-emerald-500 to-teal-700',
        lightBg: 'bg-emerald-50/70',
        border: 'border-emerald-100',
        text: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        hoverBorder: 'hover:border-emerald-300 group-hover:shadow-emerald-500/10'
      }
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Header with discreet back navigation */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/70 py-3.5 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            to="/client/hub"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Espace client</span>
          </Link>

          <span className="text-xs font-bold text-slate-400">
            Laboratoires interactifs
          </span>
        </div>
      </header>

      {/* Main Hub Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-14 flex flex-col justify-center">
        {/* Title Section */}
        <div className="text-center space-y-2.5 mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-800 text-xs font-black uppercase tracking-wider shadow-2xs">
            <span className="text-base leading-none">🧪</span>
            <span>S'entraîner</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Choisissez votre environnement
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Accédez à vos consoles et espaces de pratique autonome pour développer vos compétences.
          </p>
        </div>

        {/* Visual Environment Cards (2 columns on mobile, clean responsive grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3.5 sm:gap-6 max-w-2xl mx-auto w-full">
          {environments.map((env, idx) => {
            const IconComp = env.icon;
            return (
              <motion.div
                key={env.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.1 }}
                className="h-full"
              >
                <Link
                  to={env.path}
                  className={`group h-full bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-7 flex flex-col justify-between text-left shadow-xs hover:shadow-xl active:scale-[0.97] transition-all duration-300 cursor-pointer min-h-[190px] sm:min-h-[240px] relative overflow-hidden ${env.color.hoverBorder}`}
                >
                  {/* Background subtle watermark icon */}
                  <IconComp className="w-24 h-24 text-slate-900 opacity-[0.03] absolute -bottom-4 -right-4 pointer-events-none group-hover:scale-110 transition-transform duration-500" />

                  {/* Card Top: Icon & Badge */}
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${env.color.bg} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300 shrink-0`}>
                      <IconComp className="w-5 h-5 sm:w-7 sm:h-7" />
                    </div>

                    <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black border ${env.color.badgeBg}`}>
                      {env.badge}
                    </span>
                  </div>

                  {/* Card Content: Title, Subtitle, Description */}
                  <div className="mt-4 sm:mt-6 space-y-1 sm:space-y-1.5 flex-1">
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                      {env.title}
                    </h2>
                    
                    <p className="text-xs sm:text-sm font-bold text-slate-700 leading-snug line-clamp-1">
                      {env.subtitle}
                    </p>

                    <p className="text-[11px] sm:text-xs font-medium text-slate-500 leading-relaxed line-clamp-2 pt-0.5">
                      {env.description}
                    </p>
                  </div>

                  {/* Card Bottom CTA hint */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-slate-700 transition-colors">
                    <span className="text-[11px] sm:text-xs font-bold">Ouvrir</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="py-4 text-center text-xs text-slate-400">
        Exceller chez Pierre • Espace d'entraînement
      </footer>
    </div>
  );
}
