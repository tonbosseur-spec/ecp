import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface FeatureTile {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface MobileLandingPageProps {
  session?: any;
}

const FEATURES: FeatureTile[] = [
  {
    id: 'formations',
    icon: '📚',
    title: 'Formations',
    description: 'Des formations pratiques pour développer vos compétences.',
  },
  {
    id: 'data-tools',
    icon: '📊',
    title: 'Data & outils',
    description: 'Excel, Power BI, R et analyse de données.',
  },
  {
    id: 'quiz',
    icon: '🎯',
    title: 'Quiz & exercices',
    description: 'Apprenez en pratiquant et testez vos connaissances.',
  },
  {
    id: 'live',
    icon: '🎥',
    title: 'Sessions en direct',
    description: 'Participez à vos formations et sessions live.',
  },
];

export default function MobileLandingPage({ session }: MobileLandingPageProps) {
  const navigate = useNavigate();

  const handleConnect = async () => {
    try {
      localStorage.setItem('ecp_mobile_onboarding_seen', 'true');
    } catch (e) {
      console.warn('Unable to write to localStorage:', e);
    }

    if (session) {
      navigate('/client/hub');
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        navigate('/client/hub');
        return;
      }
    } catch (err) {
      console.error('Error checking auth session:', err);
    }

    navigate('/client/login');
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    visible: (customDelay: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.45,
        delay: customDelay,
        ease: [0.215, 0.61, 0.355, 1],
      },
    }),
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-w-md mx-auto overflow-x-hidden font-sans">
      
      {/* Top Header Section */}
      <div className="flex flex-col items-center text-center mt-2 sm:mt-4">
        {/* 1. Logo */}
        <motion.div
          custom={0.1}
          initial="hidden"
          animate="visible"
          variants={itemVariants}
          className="mb-4"
        >
          <div className="relative inline-flex items-center justify-center p-1.5 rounded-2xl bg-white shadow-xs border border-emerald-100">
            <img
              src="/icon.png"
              alt="ECP Logo"
              className="w-16 h-16 rounded-xl object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) (fallback as HTMLElement).style.display = 'flex';
              }}
            />
            <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 hidden items-center justify-center text-white font-black text-xl shadow-inner">
              ECP
            </div>
          </div>
        </motion.div>

        {/* 2. Nom "Exceller chez Pierre" */}
        <motion.h1
          custom={0.3}
          initial="hidden"
          animate="visible"
          variants={itemVariants}
          className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1"
        >
          Exceller chez Pierre
        </motion.h1>

        {/* 3. Sous-titre */}
        <motion.p
          custom={0.5}
          initial="hidden"
          animate="visible"
          variants={itemVariants}
          className="text-xs sm:text-sm font-extrabold text-emerald-600 tracking-wider uppercase"
        >
          Apprenez. Pratiquez. Progressez.
        </motion.p>
      </div>

      {/* Center Tiles Section */}
      <div className="my-6 space-y-3">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.id}
            custom={0.8 + index * 0.2}
            initial="hidden"
            animate="visible"
            variants={itemVariants}
            className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs hover:border-emerald-200 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl shrink-0 shadow-2xs">
              {feature.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-slate-900 leading-snug">
                {feature.title}
              </h2>
              <p className="text-xs text-slate-500 leading-normal mt-0.5 line-clamp-2">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom CTA Button Section */}
      <motion.div
        custom={1.8}
        initial="hidden"
        animate="visible"
        variants={itemVariants}
        className="w-full pt-2 pb-2"
      >
        <button
          onClick={handleConnect}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span>Se connecter</span>
          <ChevronRight className="w-5 h-5 text-emerald-100" />
        </button>
      </motion.div>

    </div>
  );
}
