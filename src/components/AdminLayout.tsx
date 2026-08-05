import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminKeyboardShortcuts from './AdminKeyboardShortcuts';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans w-full">
      <AdminKeyboardShortcuts />
      <main className="w-full">
        <Outlet />
      </main>
    </div>
  );
}


