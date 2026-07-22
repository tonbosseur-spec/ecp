import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { 
  UserPlus, 
  Compass, 
  Layout, 
  MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HowItWorksPage() {
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

  const steps = [
    {
      num: "01",
      icon: <UserPlus className="w-8 h-8 text-blue-600" />,
      title: "Création de compte",
      desc: "Inscrivez-vous gratuitement sur la plateforme en quelques clics pour obtenir votre Espace Personnel sécurisé.",
      image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    },
    {
      num: "02",
      icon: <Compass className="w-8 h-8 text-indigo-600" />,
      title: "Catalogue de Formations",
      desc: "Choisissez parmi nos services et formations disponibles, ou proposez-nous directement votre idée sur-mesure depuis le catalogue.",
      image: "https://images.unsplash.com/photo-1607252654015-f84f1b578e58?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    },
    {
      num: "03",
      icon: <Layout className="w-8 h-8 text-emerald-600" />,
      title: "Suivi Personnel",
      desc: "Accédez à vos modules, vos ressources pédagogiques et suivez votre progression en temps réel depuis votre Hub privé interactif.",
      image: "https://images.unsplash.com/photo-1555421689-d68471e189f2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    },
    {
      num: "04",
      icon: <MessageSquare className="w-8 h-8 text-purple-600" />,
      title: "Messagerie & Interaction",
      desc: "Échangez directement avec nos experts et formateurs pour un suivi encore plus personnalisé de votre évolution.",
      image: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
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
              Comment ça <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">marche ?</span>
            </h1>
            <p className="text-gray-600 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Une méthodologie claire et transparente pour vous accompagner pas à pas vers la réussite de vos projets.
            </p>
          </div>
        </section>

        {/* Timeline Steps Section */}
        <section className="py-20 bg-gray-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            {/* Vertical Line for Desktop */}
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-100 via-indigo-100 to-transparent -translate-x-1/2" />

            <div className="space-y-20 lg:space-y-32">
              {steps.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7 }}
                  className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-24 relative ${idx % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
                >
                  {/* Step Number Badge Desktop */}
                  <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white border-4 border-gray-50 rounded-full items-center justify-center shadow-lg z-10">
                    <span className="font-black text-xl text-blue-600">{step.num}</span>
                  </div>

                  {/* Text Content */}
                  <div className={`w-full lg:w-1/2 ${idx % 2 !== 0 ? 'lg:text-left' : 'lg:text-right'}`}>
                    <div className={`flex flex-col ${idx % 2 !== 0 ? 'lg:items-start' : 'lg:items-end'}`}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="lg:hidden w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md font-black text-blue-600">
                          {step.num}
                        </div>
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md">
                          {step.icon}
                        </div>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 text-lg leading-relaxed max-w-md">
                        {step.desc}
                      </p>
                    </div>
                  </div>

                  {/* Mockup Image */}
                  <div className="w-full lg:w-1/2 flex justify-center">
                    <div className="relative w-full max-w-sm">
                      {/* Decorative Background Blob */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-indigo-100 rounded-[3rem] transform rotate-3 scale-105 -z-10 blur-sm" />
                      
                      {/* Phone Mockup Frame */}
                      <div className="bg-gray-900 p-3 sm:p-4 rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden relative">
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-gray-900 rounded-b-xl z-20" />
                        
                        {/* Screen Content */}
                        <img 
                          src={step.image} 
                          alt={step.title}
                          className="w-full h-[500px] sm:h-[600px] object-cover rounded-[1.5rem] sm:rounded-[2rem]"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-24 text-center">
              <Link
                to="/client/register"
                className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl shadow-lg hover:scale-105 transition-transform"
              >
                Commencer maintenant
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
