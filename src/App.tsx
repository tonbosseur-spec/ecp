/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { checkIsAdmin } from './lib/adminAuthService';
import PageTransition from './components/PageTransition';
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
import ClientTrainingHub from './pages/ClientTrainingHub';
import ClientTrainingSession from './pages/ClientTrainingSession';
import MobileLandingPage from './pages/MobileLandingPage';
import ClientCourseView from './pages/ClientCourseView';
import ClientModuleView from './pages/ClientModuleView';
import Marketplace from './pages/Marketplace';
import LandingPage from './pages/LandingPage';
import ExpertisesPage from './pages/ExpertisesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import PublicTrainers from './pages/PublicTrainers';
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
import AdminTrainingList from './pages/AdminTrainingList';
import AdminTrainingEditor from './pages/AdminTrainingEditor';
import LiveDashboard from './pages/LiveDashboard';
import LiveRoom from './pages/LiveRoom';
import PublicLiveSessionPage from './pages/PublicLiveSessionPage';
import AdminLayout from './components/AdminLayout';
import SplashScreen from './components/SplashScreen';
import { Loader2 } from 'lucide-react';

import { useNativeFeatures } from './hooks/useNativeFeatures';
import { Capacitor } from '@capacitor/core';

function RootRedirector({ session }: { session: any }) {
  const target = import.meta.env.VITE_APP_TARGET;
  
  if (target === 'admin') {
    return <Navigate to="/login" replace />;
  }
  
  const isAndroidApp = Capacitor.isNativePlatform() || target === 'client';
  
  if (isAndroidApp) {
    if (session) {
      return <Navigate to="/client/hub" replace />;
    }
    const onboardingSeen = localStorage.getItem('ecp_mobile_onboarding_seen') === 'true';
    if (onboardingSeen) {
      return <Navigate to="/client/login" replace />;
    }
    return <Navigate to="/mobile-landing" replace />;
  }
  
  return <LandingPage />;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Initialisation des fonctionnalités natives (Capacitor)
  useNativeFeatures();

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 2500)
        );

        const { data } = await Promise.race([
          supabase.auth.getSession().catch(() => ({ data: { session: null } })),
          timeoutPromise,
        ]);

        if (!isMounted) return;

        const currentSession = data?.session || null;
        setSession(currentSession);

        if (currentSession?.user?.email) {
          const adminCheckPromise = checkIsAdmin(currentSession.user.email);
          const adminTimeoutPromise = new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 2000)
          );
          const authorized = await Promise.race([adminCheckPromise, adminTimeoutPromise]);
          if (isMounted) setIsAdmin(authorized);
        } else {
          if (isMounted) setIsAdmin(false);
        }
      } catch (err) {
        console.warn('Auth init warning:', err);
        if (isMounted) {
          setSession(null);
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Écouter les changements de session (connexion, déconnexion)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      try {
        setSession(newSession);
        if (newSession?.user?.email) {
          const authorized = await checkIsAdmin(newSession.user.email);
          setIsAdmin(authorized);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.warn('Auth state change error:', err);
      }
    });

    const handleAdminsChanged = async () => {
      if (session?.user?.email) {
        const authorized = await checkIsAdmin(session.user.email);
        setIsAdmin(authorized);
      }
    };
    window.addEventListener('admin_users_changed', handleAdminsChanged);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('admin_users_changed', handleAdminsChanged);
    };
  }, [session?.user?.email]);

  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-gray-500">Chargement d'Exceller chez Pierre...</p>
      </div>
    );
  }

  return (
    <Routes location={location}>
      <Route path="/" element={<PageTransition><RootRedirector session={session} /></PageTransition>} />
      <Route 
        path="/mobile-landing" 
        element={<PageTransition><MobileLandingPage session={session} /></PageTransition>} 
      />
      <Route path="/expertises" element={<PageTransition><ExpertisesPage /></PageTransition>} />
      <Route path="/formateurs" element={<PageTransition><PublicTrainers /></PageTransition>} />
      <Route path="/methodology" element={<PageTransition><HowItWorksPage /></PageTransition>} />
      <Route path="/ressources" element={<PageTransition><HowItWorksPage /></PageTransition>} />
      <Route path="/mentions-legales" element={<PageTransition><MentionsLegalesPage /></PageTransition>} />
      <Route path="/confidentialite" element={<PageTransition><ConfidentialitePage /></PageTransition>} />
      <Route path="/cgu" element={<PageTransition><CGUPage /></PageTransition>} />
      <Route path="/download" element={<PageTransition><DownloadAppPage /></PageTransition>} />
      <Route path="/quiz-demo" element={<PageTransition><QuizDemo /></PageTransition>} />
      <Route path="/course/:id" element={<PageTransition><PublicCoursePage /></PageTransition>} />
      <Route path="/challenge/:courseId" element={<PageTransition><PublicQuizChallenge /></PageTransition>} />
      
      <Route path="/client/register" element={<PageTransition><ClientRegister /></PageTransition>} />
      <Route 
        path="/client/login" 
        element={!session ? <PageTransition><ClientLogin /></PageTransition> : <Navigate to="/client/hub" replace />} 
      />
      <Route path="/client/hub" element={<PageTransition><ClientHub /></PageTransition>} />
      <Route path="/client/training" element={<PageTransition><ClientTrainingHub /></PageTransition>} />
      <Route path="/client/training/:id" element={<PageTransition><ClientTrainingSession /></PageTransition>} />
      <Route path="/client/course/:courseId" element={<PageTransition><ClientCourseView /></PageTransition>} />
      <Route path="/client/course/:courseId/module/:moduleId" element={<PageTransition><ClientModuleView /></PageTransition>} />
      <Route path="/catalogue" element={<PageTransition><Marketplace /></PageTransition>} />
      
      {/* Live Visioconference Module Routes */}
      <Route path="/live" element={<PageTransition><LiveDashboard /></PageTransition>} />
      <Route path="/live/session/:roomCode" element={<PageTransition><PublicLiveSessionPage /></PageTransition>} />
      <Route path="/live/public/:roomCode" element={<PageTransition><PublicLiveSessionPage /></PageTransition>} />
      <Route path="/live/:roomCode" element={<PageTransition><LiveRoom /></PageTransition>} />
      
      <Route 
        path="/login" 
        element={!isAdmin ? <PageTransition><Login /></PageTransition> : <Navigate to="/dashboard" replace />} 
      />
      
      {isAdmin ? (
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/formations" element={<AdminFormations />} />
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/admin/training" element={<AdminTrainingList />} />
          <Route path="/admin/training/new" element={<AdminTrainingEditor />} />
          <Route path="/admin/training/:id" element={<AdminTrainingEditor />} />
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
