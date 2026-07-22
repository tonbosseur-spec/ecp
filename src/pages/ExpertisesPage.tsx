import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { 
  GraduationCap, 
  Flame, 
  BookOpen, 
  FileText, 
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ExpertisesPage() {
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

  const expertises = [
    {
      icon: <GraduationCap className="w-6 h-6 text-blue-600" />,
      title: "Formations",
      subtitle: "Apprentissage structuré",
      desc: "Des programmes complets, étape par étape, animés par des formateurs experts pour acquérir de solides compétences professionnelles.",
      color: "from-blue-50 to-blue-100/50 border-blue-150 text-blue-700",
      iconBg: "bg-blue-100",
      image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    },
    {
      icon: <Flame className="w-6 h-6 text-orange-600" />,
      title: "Cours intensifs",
      subtitle: "Mise à niveau rapide",
      desc: "Sessions accélérées conçues pour assimiler rapidement des concepts clés et opérationnaliser vos connaissances en un temps record.",
      color: "from-orange-50 to-orange-100/50 border-orange-150 text-orange-700",
      iconBg: "bg-orange-100",
      image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    },
    {
      icon: <BookOpen className="w-6 h-6 text-purple-600" />,
      title: "Ressources & Vidéos",
      subtitle: "Autonomie complète",
      desc: "Bibliothèques d'e-books, de guides méthodologiques et de supports de cours à télécharger pour apprendre à votre propre rythme.",
      color: "from-purple-50 to-purple-100/50 border-purple-150 text-purple-700",
      iconBg: "bg-purple-100",
      image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    },
    {
      icon: <FileText className="w-6 h-6 text-emerald-600" />,
      title: "Suivi de mémoires",
      subtitle: "Méthodologie de recherche",
      desc: "Accompagnement académique rigoureux pour la rédaction, la structuration et la préparation de vos soutenances de mémoire.",
      color: "from-emerald-50 to-emerald-100/50 border-emerald-150 text-emerald-700",
      iconBg: "bg-emerald-100",
      image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-pink-600" />,
      title: "Analyses statistiques",
      subtitle: "Traitement de données",
      desc: "Analyses descriptives et inférentielles rigoureuses de vos données d'enquêtes ou d'entreprises pour particuliers et professionnels.",
      color: "from-pink-50 to-pink-100/50 border-pink-150 text-pink-700",
      iconBg: "bg-pink-100",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-blue-200">
      <ClientNavBar currentSession={currentSession} />
      
      <main className="flex-1">
        {/* Header Section */}
        <section className="bg-white py-16 sm:py-24 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-6">
              Nos <span className="text-blue-600">Expertises</span>
            </h1>
            <p className="text-gray-600 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Découvrez des prestations structurées et adaptées pour maximiser vos compétences et valoriser vos travaux de recherche.
            </p>
          </div>
        </section>

        {/* Expertises List Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-16 lg:space-y-24">
              {expertises.map((exp, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6 }}
                  className={`flex flex-col lg:flex-row items-center gap-10 lg:gap-16 ${idx % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
                >
                  <div className="w-full lg:w-1/2 rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-200 bg-white">
                    <img 
                      src={exp.image} 
                      alt={exp.title}
                      className="w-full h-[300px] sm:h-[400px] object-cover hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                  </div>
                  <div className="w-full lg:w-1/2 space-y-6">
                    <div className={`w-16 h-16 ${exp.iconBg} rounded-2xl flex items-center justify-center shadow-md mb-6`}>
                      {exp.icon}
                    </div>
                    <div>
                      <span className="text-sm font-extrabold uppercase tracking-widest text-gray-400 block mb-2">
                        {exp.subtitle}
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
                        {exp.title}
                      </h2>
                    </div>
                    <p className="text-gray-600 text-lg leading-relaxed">
                      {exp.desc}
                    </p>
                    <div className="pt-4">
                      <Link
                        to="/client/marketplace"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 hover:border-blue-600 hover:text-blue-600 text-gray-800 rounded-xl font-bold transition-all shadow-sm group"
                      >
                        En savoir plus
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
