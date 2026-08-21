import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  PlaySquare,
  BookText,
  Brain,
  Users,
  MessageSquare,
  
  Settings,
  X,
  Target
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminModal: () => void;
}

export default function AdminSidebar({ isOpen, onClose, onOpenAdminModal }: AdminSidebarProps) {
  const location = useLocation();
  const path = location.pathname + location.search;

  const isActive = (matchPath: string, exact: boolean = false) => {
    if (exact) {
      return path === matchPath;
    }
    if (matchPath.includes('?')) {
      return path.includes(matchPath);
    }
    return path.startsWith(matchPath);
  };

  const navItems = [
    { name: "Tableau de bord", path: "/admin/dashboard", icon: LayoutDashboard, match: "/admin/dashboard", exact: true },
    { name: "Formations", path: "/admin/formations", icon: BookOpen, match: "/admin/formations", exact: false },
    { name: "Cours interactifs", path: "/admin/interactive-courses", icon: PlaySquare, match: "/admin/interactive-courses", exact: false },
    { name: "E-books", path: "/admin/ebooks", icon: BookText, match: "/admin/ebooks", exact: false },
    { name: "Centre d'entraînement", path: "/admin/training", icon: Brain, match: "/admin/training", exact: false },
    { name: "Clients & Ventes", path: "/admin/clients?tab=all_clients", icon: Users, match: "/admin/clients", exact: false },
    { name: "Messagerie", path: "/admin/clients?tab=messages", icon: MessageSquare, match: "?tab=messages", exact: false },
    { name: "Leads & Quiz", path: "/admin/hub", icon: Target, match: "/admin/hub", exact: false },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-gray-900 text-white z-50 
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 flex flex-col shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <span className="font-bold text-lg leading-none">A</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Admin<span className="text-indigo-400">Panel</span></span>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden p-2 -mr-2 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 custom-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.match, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${active 
                    ? 'bg-indigo-500/10 text-indigo-400' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${active ? 'text-indigo-400' : 'text-gray-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Footer Settings */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <button
            onClick={() => {
              if (window.innerWidth < 1024) onClose();
              onOpenAdminModal();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-200"
          >
            <Settings className="w-5 h-5 shrink-0 text-gray-500" />
            Paramètres
          </button>
        </div>
      </aside>
    </>
  );
}
