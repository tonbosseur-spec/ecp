import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import AdminKeyboardShortcuts from './AdminKeyboardShortcuts';
import PageTransition from './PageTransition';

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 font-sans w-full">
      <AdminKeyboardShortcuts />
      <main className="w-full">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}


