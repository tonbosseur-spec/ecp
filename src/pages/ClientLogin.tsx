import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Loader2, AlertCircle, ArrowLeft, CheckCircle2, BookOpen, GraduationCap, Sparkles } from 'lucide-react';

export default function ClientLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      // On success, go to redirect path or hub
      if (redirectPath && !redirectPath.startsWith('http')) {
        navigate(`/${redirectPath.replace(/^\/+/, '')}`);
      } else {
        navigate('/client/hub');
      }
      
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Identifiants incorrects.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Left panel - Benefits */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative flex-col justify-between overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 opacity-90"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] -ml-48 -mb-48"></div>

        <div className="relative z-10 p-12 xl:p-16 flex flex-col h-full justify-between max-w-2xl mx-auto w-full">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-16">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-semibold">Retour à l'accueil</span>
            </Link>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-extrabold text-xs uppercase tracking-wider mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Espace Personnel</span>
            </div>

            <h2 className="text-3xl xl:text-4xl font-bold text-white mb-6 leading-tight">
              Accédez à un Hub d'apprentissage exclusif.
            </h2>
            <p className="text-gray-300 text-lg mb-12 max-w-md leading-relaxed">
              Votre compte client est votre passeport pour structurer vos compétences, suivre vos formations et interagir avec nos experts.
            </p>

            <div className="space-y-6">
              {[
                {
                  icon: <BookOpen className="w-5 h-5 text-blue-400" />,
                  title: "Bibliothèque de ressources",
                  desc: "Consultez et téléchargez tous vos e-books et supports de cours au même endroit."
                },
                {
                  icon: <GraduationCap className="w-5 h-5 text-purple-400" />,
                  title: "Suivi de progression",
                  desc: "Gardez un œil sur l'état de vos inscriptions et l'avancement de vos formations en direct."
                },
                {
                  icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
                  title: "Accès directs & simplicité",
                  desc: "Retrouvez vos liens Google Meet et groupes WhatsApp sans chercher dans vos emails."
                }
              ].map((benefit, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {benefit.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-base mb-1">{benefit.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-12 flex items-center gap-3 border-t border-white/10 pt-6">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-sm">
              E
            </div>
            <span className="text-gray-400 text-sm font-medium">Exceller chez Pierre © {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative">
        {/* Mobile back button */}
        <Link to="/" className="lg:hidden absolute top-6 left-6 inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Accueil</span>
        </Link>

        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Bienvenue dans votre Hub</h1>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              Connectez-vous pour accéder à tous vos <strong>cours, e-books et coachings</strong>, suivre votre progression et discuter avec vos mentors.
            </p>
          </div>
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 flex items-start gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-5 bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider text-[11px]" htmlFor="email">
                Adresse email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white"
                  placeholder="jean.dupont@example.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider text-[11px]" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/30 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Connexion en cours...
                  </>
                ) : (
                  'Se connecter à mon compte'
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-8 text-center bg-gray-100/50 py-4 px-6 rounded-2xl border border-gray-200/50">
            <p className="text-sm text-gray-600">
              Pas encore de compte ?{' '}
              <Link to={`/client/register${redirectPath ? `?redirect=${redirectPath}` : ''}`} className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                Inscrivez-vous gratuitement
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
