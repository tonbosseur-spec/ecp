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
import AdminFormations from './pages/AdminFormations';
import AdminClients from './pages/AdminClients';
import AdminSessionsDashboard from './pages/AdminSessionsDashboard';
import AdminActivityFeed from './pages/AdminActivityFeed';
import LiveDashboard from './pages/LiveDashboard';
import LiveRoom from './pages/LiveRoom';
import PublicLiveSessionPage from './pages/PublicLiveSessionPage';
import AdminLayout from './components/AdminLayout';
import SplashScreen from './components/SplashScreen';
import { Loader2 } from 'lucide-react';

import { useNativeFeatures } from './hooks/useNativeFeatures';
import { Capacitor } from '@capacitor/core';

function RootRedirector() {
  const target = import.meta.env.VITE_APP_TARGET;
  
  if (target === 'admin') {
    return <Navigate to="/login" replace />;
  }
  
  if (target === 'client') {
    return <Navigate to="/client/login" replace />;
  }
  
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/client/login" replace />;
  }
  
  return <LandingPage />;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Initialisation des fonctionnalités natives (Capacitor)
  useNativeFeatures();

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

  // Intercept external links for admin app target
  useEffect(() => {
    if (import.meta.env.VITE_APP_TARGET === 'admin' && Capacitor.isNativePlatform()) {
      const handleLinkClick = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor && anchor.href && anchor.href.startsWith('http')) {
          const url = new URL(anchor.href);
          if (url.origin !== window.location.origin) {
            e.preventDefault();
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url: anchor.href });
          }
        }
      };

      document.addEventListener('click', handleLinkClick);
      return () => {
        document.removeEventListener('click', handleLinkClick);
      };
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
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
      
      {/* Live Visioconference Module Routes */}
      <Route path="/live" element={<LiveDashboard />} />
      <Route path="/live/session/:roomCode" element={<PublicLiveSessionPage />} />
      <Route path="/live/public/:roomCode" element={<PublicLiveSessionPage />} />
      <Route path="/live/:roomCode" element={<LiveRoom />} />
      
      <Route 
        path="/login" 
        element={!isAdmin ? <Login /> : <Navigate to="/dashboard" replace />} 
      />
      
      {isAdmin ? (
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/formations" element={<AdminFormations />} />
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/courses/new" element={<CreateCourse />} />
          <Route path="/edit-course/:id" element={<EditCourse />} />
          <Route path="/courses/:id" element={<AdminCourseDetails />} />
          <Route path="/trainers" element={<ManageTrainers />} />
          <Route path="/admin/hub" element={<AdminHub />} />
          <Route path="/admin/sessions" element={<AdminSessionsDashboard />} />
          <Route path="/admin/activity" element={<AdminActivityFeed />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/" replace />} />
      )}
    </Routes>
  );
}
