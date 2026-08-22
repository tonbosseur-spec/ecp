import React, { useState } from 'react';
import { LogOut, ExternalLink, LayoutDashboard, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface AdminHeaderProps {
  title?: string;
}

const GREETING_EMOJIS = ['👋', '😊', '😎', '🚀', '🎯', '🌟', '✨', '💪', '🔥', '📊', '🎓'];

export default function AdminHeader({ title }: AdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/admin/dashboard';

  const [randomEmoji] = useState(() => {
    const randomIndex = Math.floor(Math.random() * GREETING_EMOJIS.length);
    return GREETING_EMOJIS[randomIndex];
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-2xs h-16 flex items-center justify-between px-3 sm:px-6 relative">
      {/* Left Section: Logo Avatar & Optional Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 z-10 min-w-0">
        <Link 
          to="/admin/dashboard"
          className="flex items-center gap-2 text-gray-900 hover:text-indigo-600 font-bold transition-colors shrink-0"
          title="Tableau de bord"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xs">
            P
          </div>
        </Link>

        {!isDashboard && (
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-400 font-medium truncate">
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 shrink-0" />
            <Link 
              to="/admin/dashboard" 
              className="text-gray-500 hover:text-gray-900 hidden md:inline transition-colors shrink-0"
            >
              Tableau de bord
            </Link>
            {title && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 hidden md:inline shrink-0" />
                <span className="font-bold text-gray-900 truncate max-w-[90px] xs:max-w-[120px] sm:max-w-[200px]">{title}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Centered Welcome Message */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-center px-1 z-0 max-w-[50%] xs:max-w-[60%] sm:max-w-md">
        <span className="font-extrabold text-[11px] xs:text-xs sm:text-sm md:text-base tracking-tight text-gray-900 whitespace-nowrap">
          Bonjour <span className="text-indigo-600">Pierre Valdeze</span> <span className="inline-block animate-pulse">{randomEmoji}</span>
        </span>
      </div>

      {/* Right Section: Action links */}
      <div className="flex items-center gap-1 sm:gap-3 z-10 shrink-0">
        {!isDashboard && (
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tableau de bord</span>
          </Link>
        )}

        <Link 
          to="/"
          target="_blank"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Voir le site</span>
        </Link>

        <div className="h-5 w-px bg-gray-200 hidden xs:block"></div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
          title="Se déconnecter"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}

