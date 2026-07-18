import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LayoutDashboard, PlusCircle, LogOut, Users, Store, Shield } from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
    { path: '/courses/new', icon: PlusCircle, label: 'Nouvelle formation' },
    { path: '/admin/hub', icon: Store, label: 'Espace Hub' },
    { path: '/trainers', icon: Users, label: 'Formateurs' },
  ];

  const isFullScreenForm = location.pathname === '/courses/new' || location.pathname.startsWith('/edit-course');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-gray-200 shrink-0 h-screen sticky top-0">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-gray-950 tracking-tight leading-none text-base">Espace Admin</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Exceller Chez Pierre</p>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100/50' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5 stroke-2" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className={`flex-1 overflow-y-auto ${isFullScreenForm ? '' : 'pb-20 md:pb-0'}`}>
        <Outlet />
      </main>

      {/* Bottom Nav for Mobile */}
      {!isFullScreenForm && (
        <nav 
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${
                    isActive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  <span className="text-[10px] font-medium">{item.label === 'Nouvelle formation' ? 'Nouveau' : item.label === 'Espace Hub' ? 'Hub' : item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center w-16 h-full gap-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-6 h-6 stroke-2" />
              <span className="text-[10px] font-medium">Quitter</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
