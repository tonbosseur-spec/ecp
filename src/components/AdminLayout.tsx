import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans w-full">
      <main className="w-full">
        <Outlet />
      </main>
    </div>
  );
}

