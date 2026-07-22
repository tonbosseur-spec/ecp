/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateCourse from './pages/CreateCourse';
import ManageTrainers from './pages/ManageTrainers';
import PublicCoursePage from './pages/PublicCoursePage';
import PublicQuizChallenge from './pages/PublicQuizChallenge';
import AdminCourseDetails from './pages/AdminCourseDetails';
import EditCourse from './pages/EditCourse';
import ClientRegister from './pages/ClientRegister';
import ClientLogin from './pages/ClientLogin';
import ClientHub from './pages/ClientHub';
import ClientCourseView from './pages/ClientCourseView';
import ClientModuleView from './pages/ClientModuleView';
import Marketplace from './pages/Marketplace';
import LandingPage from './pages/LandingPage';
import ExpertisesPage from './pages/ExpertisesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import MentionsLegalesPage from './pages/MentionsLegalesPage';
import ConfidentialitePage from './pages/ConfidentialitePage';
import CGUPage from './pages/CGUPage';
import DownloadAppPage from './pages/DownloadAppPage';
import QuizDemo from './pages/QuizDemo';
import AdminHub from './pages/AdminHub';
import AdminLayout from './components/AdminLayout';
import { Loader2 } from 'lucide-react';

import { useNativeFeatures } from './hooks/useNativeFeatures';
import { Capacitor } from '@capacitor/core';

function RootRedirector() {
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/client/login" replace />;
  }
  return <LandingPage />;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Initialisation des fonctionnalités natives (Capacitor)
  const { registerPushNotifications } = useNativeFeatures();

  useEffect(() => {
    // Obtenir la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      
      // Auto-enregistrement des notifications si l'utilisateur est connecté
      if (session?.user?.id) {
        registerPushNotifications(session.user.id).catch(console.error);
      }
    });

    // Écouter les changements de session (connexion, déconnexion)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      // Re-vérifier lors du changement d'état (login)
      if (session?.user?.id) {
        registerPushNotifications(session.user.id).catch(console.error);
      }
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

  const isAdmin = session?.user?.email === 'pmbom@ecp.cm';

  return (
    <Routes>
      <Route path="/" element={<RootRedirector />} />
      <Route path="/expertises" element={<ExpertisesPage />} />
      <Route path="/methodology" element={<HowItWorksPage />} />
      <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
      <Route path="/confidentialite" element={<ConfidentialitePage />} />
      <Route path="/cgu" element={<CGUPage />} />
      <Route path="/download" element={<DownloadAppPage />} />
      <Route path="/quiz-demo" element={<QuizDemo />} />
      <Route path="/course/:id" element={<PublicCoursePage />} />
      <Route path="/challenge/:courseId" element={<PublicQuizChallenge />} />
      
      <Route path="/client/register" element={<ClientRegister />} />
      <Route 
        path="/client/login" 
        element={!session ? <ClientLogin /> : <Navigate to="/client/hub" replace />} 
      />
      <Route path="/client/hub" element={<ClientHub />} />
      <Route path="/client/course/:courseId" element={<ClientCourseView />} />
      <Route path="/client/course/:courseId/module/:moduleId" element={<ClientModuleView />} />
      <Route path="/client/marketplace" element={<Marketplace />} />
      
      <Route 
        path="/login" 
        element={!isAdmin ? <Login /> : <Navigate to="/dashboard" replace />} 
      />
      
      {isAdmin ? (
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
  );
}
