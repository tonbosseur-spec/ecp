import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

interface FooterProps {
  adminWhatsAppPhone?: string;
}

export default function Footer({ adminWhatsAppPhone = "237698389030" }: FooterProps) {
  return (
    <footer className="bg-gray-950 text-gray-400 py-16 border-t border-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Une question spécifique ? Discutons-en !
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Notre équipe d'administration est disponible pour répondre à vos demandes personnalisées, besoins en statistiques ou encadrements particuliers.
          </p>
        </div>

        {/* WhatsApp Direct CTA */}
        <div>
          <a
            href={`https://wa.me/${adminWhatsAppPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-900/30 hover:scale-105 active:scale-95 transition-all text-base gap-2.5"
          >
            <MessageSquare className="w-5 h-5 fill-white text-white" />
            <span>Contactez-nous sur WhatsApp</span>
          </a>
        </div>

        <div className="border-t border-gray-900 pt-8 flex flex-col items-center gap-6 text-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
            <div className="flex items-center gap-2 text-white">
              <span className="font-black text-2xl tracking-tighter">Exceller chez Pierre</span>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-gray-300">
              <Link to="/expertises" className="hover:text-white transition-colors">Expertises</Link>
              <span className="text-gray-800">|</span>
              <Link to="/methodology" className="hover:text-white transition-colors">Méthodologie</Link>
              <span className="text-gray-800">|</span>
              <Link to="/client/login" className="hover:text-white transition-colors">Espace Client</Link>
              <span className="text-gray-800">|</span>
              <Link to="/login" className="hover:text-white transition-colors">Portail Admin</Link>
            </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-5 text-gray-500 pt-2 border-t border-gray-900/60 w-full">
            <Link to="/mentions-legales" className="hover:text-gray-300 transition-colors">Mentions Légales</Link>
            <span className="text-gray-800">•</span>
            <Link to="/confidentialite" className="hover:text-gray-300 transition-colors">Confidentialité & Données</Link>
            <span className="text-gray-800">•</span>
            <Link to="/cgu" className="hover:text-gray-300 transition-colors">Conditions Générales (CGU/CGV)</Link>
          </div>

          <p className="text-gray-600 text-[11px]">
            © {new Date().getFullYear()} Exceller chez Pierre. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
