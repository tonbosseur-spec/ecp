import React from 'react';
import { LogOut, ExternalLink, LayoutDashboard, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface AdminHeaderProps {
  title?: string;
}

export default function AdminHeader({ title }: AdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/admin/dashboard';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-2xs h-16 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Link 
          to="/admin/dashboard"
          className="flex items-center gap-2 text-gray-900 hover:text-indigo-600 font-bold transition-colors shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
            P
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-tight hidden xs:inline">
            Bonjour <span className="text-indigo-600">Pierre Valdeze</span>
          </span>
        </Link>

        {!isDashboard && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 font-medium ml-1">
            <ChevronRight className="w-4 h-4 text-gray-300" />
            <Link 
              to="/admin/dashboard" 
              className="text-gray-500 hover:text-gray-900 hidden md:inline transition-colors"
            >
              Tableau de bord
            </Link>
            {title && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 hidden md:inline" />
                <span className="font-bold text-gray-900 truncate max-w-[160px] sm:max-w-xs">{title}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {!isDashboard && (
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tableau de bord</span>
          </Link>
        )}

        <Link 
          to="/"
          target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Voir le site</span>
        </Link>

        <div className="h-5 w-px bg-gray-200"></div>

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

