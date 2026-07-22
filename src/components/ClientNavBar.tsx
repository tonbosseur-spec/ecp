import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Menu, X, Sparkles } from 'lucide-react';

interface ClientNavBarProps {
  currentSession?: any;
}

export default function ClientNavBar({ currentSession }: ClientNavBarProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: '/', label: 'Accueil' },
    { path: '/expertises', label: 'Nos expertises' },
    { path: '/methodology', label: 'Comment ça marche' },
    { path: '/client/marketplace', label: 'Catalogue' },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="sticky top-3 sm:top-4 z-50 px-3 sm:px-6 flex flex-col items-center pointer-events-none mb-3 sm:mb-5 mt-2 sm:mt-3">
      {/* Floating iOS Glass Ribbon */}
      <nav className="w-full max-w-5xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl backdrop-saturate-150 border border-white/60 dark:border-slate-800/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] rounded-full px-3.5 sm:px-5 py-2 flex items-center justify-between pointer-events-auto transition-all duration-300">
        
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0 pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-black text-base sm:text-lg tracking-tight text-gray-900 dark:text-white">
            Exceller <span className="hidden xs:inline text-blue-600 font-extrabold">chez Pierre</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1 bg-gray-100/60 dark:bg-slate-800/50 p-1 rounded-full border border-gray-200/50 dark:border-slate-700/50">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to={currentSession ? "/client/hub" : "/client/login"}
            className="text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
            title="Mon Espace Personnel"
          >
            <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="hidden sm:inline">Mon Hub</span>
          </Link>

          {!currentSession && (
            <Link
              to="/client/register"
              className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 bg-gray-950 hover:bg-gray-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full font-bold text-xs transition-all shadow-sm hover:scale-105"
            >
              Créer un compte
            </Link>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 transition-colors focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown Card */}
      {mobileMenuOpen && (
        <div className="w-full max-w-5xl mt-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/60 dark:border-slate-800 rounded-3xl p-4 shadow-2xl pointer-events-auto md:hidden flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center justify-between ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{link.label}</span>
                {active && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
              </Link>
            );
          })}

          <div className="pt-2 mt-1 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-2">
            <Link
              to={currentSession ? "/client/hub" : "/client/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4 text-gray-500" />
              <span>Mon Hub</span>
            </Link>
            {!currentSession && (
              <Link
                to="/client/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 bg-gray-950 dark:bg-blue-600 text-white rounded-2xl text-sm font-bold"
              >
                Créer un compte
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
