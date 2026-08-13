/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
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
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session || null;
        setSession(session);
        if (session?.user?.email) {
          const authorized = await checkIsAdmin(session.user.email);
          setIsAdmin(authorized);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.warn('Auth init error:', err);
        setSession(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Écouter les changements de session (connexion, déconnexion)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setSession(session);
        if (session?.user?.email) {
          const authorized = await checkIsAdmin(session.user.email);
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
      subscription.unsubscribe();
      window.removeEventListener('admin_users_changed', handleAdminsChanged);
    };
  }, [session?.user?.email]);

  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
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
    </AnimatePresence>
  );
}
