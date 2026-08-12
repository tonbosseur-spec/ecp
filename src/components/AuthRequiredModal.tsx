import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, LogIn, X, Sparkles } from 'lucide-react';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  redirectPath?: string;
}

export default function AuthRequiredModal({
  isOpen,
  onClose,
  title = "Connexion requise",
  description = "Pour soumettre une proposition de formation ou demander un accompagnement personnalisé, vous devez créer un compte ou vous connecter.",
  redirectPath = '/catalogue'
}: AuthRequiredModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const encodedRedirect = encodeURIComponent(redirectPath);

  const handleLogin = () => {
    onClose();
    navigate(`/client/login?redirect=${encodedRedirect}`);
  };

  const handleRegister = () => {
    onClose();
    navigate(`/client/register?redirect=${encodedRedirect}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center relative animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Badge / Icône d'en-tête */}
        <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20">
          <Sparkles className="w-8 h-8" />
        </div>

        {/* Titre */}
        <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2 tracking-tight">
          {title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-6">
          {description}
        </p>

        {/* Boutons d'action */}
        <div className="space-y-3">
          <button
            onClick={handleRegister}
            className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 group active:scale-98"
          >
            <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Créer un compte</span>
          </button>

          <button
            onClick={handleLogin}
            className="w-full py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-gray-800 font-extrabold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <LogIn className="w-4 h-4 text-gray-600" />
            <span>Se connecter</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors pt-1"
          >
            Continuer la navigation
          </button>
        </div>

      </div>
    </div>
  );
}
