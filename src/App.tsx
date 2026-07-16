/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateCourse from './pages/CreateCourse';
import ManageTrainers from './pages/ManageTrainers';
import PublicCoursePage from './pages/PublicCoursePage';
import AdminCourseDetails from './pages/AdminCourseDetails';
import EditCourse from './pages/EditCourse';
import ClientRegister from './pages/ClientRegister';
import ClientLogin from './pages/ClientLogin';
import ClientHub from './pages/ClientHub';
import Marketplace from './pages/Marketplace';
import LandingPage from './pages/LandingPage';
import AdminHub from './pages/AdminHub';
import AdminLayout from './components/AdminLayout';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtenir la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Écouter les changements de session (connexion, déconnexion)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/course/:id" element={<PublicCoursePage />} />
        
        <Route path="/client/register" element={<ClientRegister />} />
        <Route 
          path="/client/login" 
          element={!session ? <ClientLogin /> : <Navigate to="/client/hub" replace />} 
        />
        <Route path="/client/hub" element={<ClientHub />} />
        <Route path="/client/marketplace" element={<Marketplace />} />
        
        <Route 
          path="/login" 
          element={!session ? <Login /> : <Navigate to="/dashboard" replace />} 
        />
        
        {session ? (
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses/new" element={<CreateCourse />} />
            <Route path="/edit-course/:id" element={<EditCourse />} />
            <Route path="/courses/:id" element={<AdminCourseDetails />} />
            <Route path="/trainers" element={<ManageTrainers />} />
            <Route path="/admin/hub" element={<AdminHub />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/" replace />} />
        )}
      </Routes>
    </Router>
  );
}
