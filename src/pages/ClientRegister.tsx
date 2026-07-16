import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { User, Phone, Mail, Lock, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Sparkles, BookOpen, GraduationCap } from 'lucide-react';

export default function ClientRegister() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect');
  const reason = searchParams.get('reason');

  // Validation
  const isValidEmail = email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const isValidPhone = phone.replace(/[^0-9+]/g, '').length >= 8;
  const isValidPassword = password.length >= 6;
  const passwordsMatch = password === confirmPassword;

  const canSubmit = 
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isValidPhone &&
    isValidEmail &&
    isValidPassword &&
    passwordsMatch;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone,
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      setSuccess(true);
      
      // Clear form
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l\'inscription.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans selection:bg-blue-100 selection:text-blue-900">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100 text-center p-12 relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-50"></div>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 relative z-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Félicitations !</h2>
          <p className="text-gray-600 text-base mb-10 leading-relaxed">
            Votre compte a été créé avec succès. Veuillez vérifier votre boîte mail pour confirmer votre inscription.
          </p>
          <Link
            to={`/client/login${redirectPath ? `?redirect=${redirectPath}` : ''}`}
            className="inline-flex items-center justify-center w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl active:scale-[0.98]"
          >
            Se connecter maintenant
          </Link>
        </div>
      </div>
    );
  }

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
              <span>Nouveau Membre</span>
            </div>

            <h2 className="text-3xl xl:text-4xl font-bold text-white mb-6 leading-tight">
              Prenez votre avenir en main dès aujourd'hui.
            </h2>
            <p className="text-gray-300 text-lg mb-12 max-w-md leading-relaxed">
              La création d'un compte est gratuite, rapide et vous donne un accès illimité à votre environnement d'apprentissage.
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative overflow-y-auto">
        {/* Mobile back button */}
        <Link to="/" className="lg:hidden absolute top-6 left-6 inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Accueil</span>
        </Link>

        <div className="w-full max-w-md py-8">
          <div className="text-center mb-10 mt-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Rejoignez-nous</h1>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              Créez votre compte <strong>gratuitement</strong> pour structurer vos compétences, suivre vos formations et accéder à votre bibliothèque de ressources privées.
            </p>
          </div>
          
          {reason && (
            <div className="mb-6 p-4 rounded-2xl bg-indigo-50 flex items-start gap-3 border border-indigo-100 animate-in fade-in slide-in-from-top-2">
              <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-800 leading-relaxed">
                {reason === 'interest' ? (
                  <>Pour manifester votre intérêt pour cette formation, <strong>un compte est requis</strong>. L'inscription est rapide et gratuite !</>
                ) : reason === 'propose' ? (
                  <>Pour proposer une nouvelle idée de formation, <strong>un compte est requis</strong>. Rejoignez-nous gratuitement !</>
                ) : (
                  <>Pour accéder à cette fonctionnalité, <strong>un compte est requis</strong>. L'inscription est gratuite !</>
                )}
              </div>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 flex items-start gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleRegister} className="space-y-4 bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wider" htmlFor="firstName">
                  Prénom
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white text-sm"
                    placeholder="Jean"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wider" htmlFor="lastName">
                  Nom
                </label>
                <div className="relative">
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block w-full px-4 py-3 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white text-sm"
                    placeholder="Dupont"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wider" htmlFor="phone">
                Téléphone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white text-sm ${
                    phone && !isValidPhone ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder="+225 00 00 00 00"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wider" htmlFor="email">
                Adresse email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white text-sm ${
                    email && !isValidEmail ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder="jean.dupont@example.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wider" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white text-sm ${
                    password && !isValidPassword ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder="•••••••• (min. 6 caractères)"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wider" htmlFor="confirmPassword">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 focus:bg-white text-sm ${
                    confirmPassword && !passwordsMatch ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="w-full flex justify-center items-center py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/30 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Création en cours...
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-8 text-center bg-gray-100/50 py-4 px-6 rounded-2xl border border-gray-200/50">
            <p className="text-sm text-gray-600">
              Vous avez déjà un compte ?{' '}
              <Link to={`/client/login${redirectPath ? `?redirect=${redirectPath}` : ''}`} className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                Connectez-vous
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
