import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Linkedin, 
  Facebook, 
  Send, 
  Youtube, 
  Globe, 
  Smartphone, 
  BookOpen, 
  Briefcase, 
  FileText, 
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';

interface FooterProps {
  adminWhatsAppPhone?: string;
}

export default function Footer({ adminWhatsAppPhone = "237698389030" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* En-tête CTA Contact WhatsApp Direct */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800/80 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assistance & Sur Mesure</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Une question spécifique ? Discutons-en !
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Notre équipe est disponible pour répondre à vos demandes d'accompagnement sur mesure, besoins en formations spécifiques ou renseignements.
            </p>
          </div>

          <div className="relative z-10 pt-2">
            <a
              href={`https://wa.me/${adminWhatsAppPhone}?text=${encodeURIComponent("Bonjour ! Je vous contacte depuis la plateforme Exceller chez Pierre. J'aurais une question concernant vos formations et prestations.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-950/50 hover:scale-105 active:scale-95 transition-all text-base gap-2.5"
            >
              <MessageSquare className="w-5 h-5 fill-white text-white" />
              <span>Contactez-nous sur WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Grille de navigation des vraies pages de l'application */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-6">
          {/* Colonne 1: Marque & Description */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2 text-white">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Exceller chez Pierre
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plateforme d'excellence pour l'apprentissage, les formations professionnelles et le suivi personnalisé des compétences.
            </p>
            {/* Réseaux sociaux */}
            <div className="flex items-center gap-3 pt-2">
              <a 
                href="https://www.linkedin.com/in/pierre-valdeze-mbom-mbom-75a660217" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-9 h-9 bg-slate-900 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-slate-800" 
                title="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a 
                href="https://facebook.com/pierrembom" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-9 h-9 bg-slate-900 hover:bg-blue-500 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-slate-800" 
                title="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a 
                href="https://t.me/pierrembom" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-9 h-9 bg-slate-900 hover:bg-sky-500 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-slate-800" 
                title="Telegram"
              >
                <Send className="w-4 h-4" />
              </a>
              <a 
                href="https://youtube.com/@excellerchezpierre" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-9 h-9 bg-slate-900 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-slate-800" 
                title="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Colonne 2: Navigation Principale */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Navigation
            </h3>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link to="/" className="hover:text-white transition-colors flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>Accueil</span>
                </Link>
              </li>
              <li>
                <Link to="/catalogue" className="hover:text-white transition-colors flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span>Catalogue des Formations</span>
                </Link>
              </li>
              <li>
                <Link to="/formateurs" className="hover:text-white transition-colors flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nos formateurs</span>
                </Link>
              </li>
              <li>
                <Link to="/expertises" className="hover:text-white transition-colors flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  <span>Services</span>
                </Link>
              </li>
              <li>
                <Link to="/methodology" className="hover:text-white transition-colors flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ressources</span>
                </Link>
              </li>
              <li>
                <Link to="/download" className="hover:text-white transition-colors flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Application Mobile</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Colonne 3: Espaces Utilisateurs */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Espaces & Accès
            </h3>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link to="/client/login" className="hover:text-white transition-colors">
                  Connexion Espace Client
                </Link>
              </li>
              <li>
                <Link to="/client/register" className="hover:text-white transition-colors">
                  Créer un compte Apprenant
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors text-slate-500 hover:text-slate-300">
                  Portail Administration
                </Link>
              </li>
            </ul>
          </div>

          {/* Colonne 4: Juridique & Conformité */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Informations Légales
            </h3>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link to="/mentions-legales" className="hover:text-white transition-colors flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mentions Légales</span>
                </Link>
              </li>
              <li>
                <Link to="/confidentialite" className="hover:text-white transition-colors">
                  Politique de Confidentialité
                </Link>
              </li>
              <li>
                <Link to="/cgu" className="hover:text-white transition-colors">
                  Conditions Générales (CGU / CGV)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Barre inférieure Droit d'auteur */}
        <div className="border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {currentYear} Exceller chez Pierre. Tous droits réservés.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/mentions-legales" className="hover:text-slate-300 transition-colors">Mentions Légales</Link>
            <span>•</span>
            <Link to="/confidentialite" className="hover:text-slate-300 transition-colors">Confidentialité</Link>
            <span>•</span>
            <Link to="/cgu" className="hover:text-slate-300 transition-colors">CGU / CGV</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
