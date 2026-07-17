import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LayoutDashboard, PlusCircle, LogOut, Users, Store } from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
    { path: '/courses/new', icon: PlusCircle, label: 'Nouveau' },
    { path: '/admin/hub', icon: Store, label: 'Hub' },
    { path: '/trainers', icon: Users, label: 'Formateurs' },
  ];

  const isFullScreenForm = location.pathname === '/courses/new' || location.pathname.startsWith('/edit-course');

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col font-sans ${isFullScreenForm ? '' : 'pb-16'}`}>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {!isFullScreenForm && (
        <nav 
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
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
                  <span className="text-[10px] font-medium">{item.label}</span>
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
