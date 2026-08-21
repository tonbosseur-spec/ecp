import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import AdminKeyboardShortcuts from './AdminKeyboardShortcuts';
import PageTransition from './PageTransition';
import AdminHeader from './AdminHeader';
import AdminManagementModal from './AdminManagementModal';

export default function AdminLayout() {
  const location = useLocation();
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Derive title from location (optional, for the header)
  const getPageTitle = (path: string) => {
    if (path.startsWith('/admin/dashboard')) return 'Tableau de bord';
    if (path.startsWith('/admin/formations')) return 'Formations';
    if (path.startsWith('/admin/interactive-courses')) return 'Cours Interactifs';
    if (path.startsWith('/admin/ebooks')) return 'E-books';
    if (path.startsWith('/admin/training/stats')) return 'Statistiques';
    if (path.startsWith('/admin/training')) return 'Centre d\'entraînement';
    if (path.startsWith('/admin/clients')) return 'Clients & Ventes';
    if (path.startsWith('/admin/hub')) return 'Analyses & Quiz publics';
    if (path.startsWith('/admin/trainers')) return 'Formateurs';
    return 'Administration';
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans w-full flex flex-col">
      <AdminKeyboardShortcuts />

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <AdminHeader 
          title={getPageTitle(location.pathname)} 
        />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      {showAdminModal && (
        <AdminManagementModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
        />
      )}
    </div>
  );
}

