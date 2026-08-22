import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, AlertCircle, ChevronRight, GraduationCap, Fingerprint } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { checkIsAdmin } from '../lib/adminAuthService';
import {
  checkBiometricStatus,
  saveBiometricCredentials,
  authenticateWithBiometrics,
  BiometricStatus,
} from '../lib/biometricAuthService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [biometricInfo, setBiometricInfo] = useState<BiometricStatus>({
    isAvailable: false,
    hasCredentialsSaved: false,
    type: 'none',
  });

  useEffect(() => {
    checkBiometricStatus().then((info) => {
      setBiometricInfo(info);
    }).catch(console.error);
  }, []);

  const handleBiometricLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!biometricInfo.hasCredentialsSaved) {
        setError("Veuillez vous connecter une première fois avec votre email et mot de passe pour enregistrer l'accès biométrique.");
        setLoading(false);
        return;
      }

      const creds = await authenticateWithBiometrics();

      const isAdminAuthorized = await checkIsAdmin(creds.email);
      if (!isAdminAuthorized) {
        setError("Accès refusé. Cet espace est strictement réservé aux administrateurs autorisés.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });

      if (error) throw error;
      navigate('/dashboard');
    } catch (err: any) {
       console.error("Biometric login error:", err);
       setError(err.message || "Échec de la connexion biométrique.");
    } finally {
       setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isAdminAuthorized = await checkIsAdmin(email);
      if (!isAdminAuthorized) {
        setError("Accès refusé. Cet espace est strictly réservé aux administrateurs autorisés.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        // Save biometric credentials if biometric sensor is available (Web or Native)
        try {
          await saveBiometricCredentials(email, password);
          setBiometricInfo({
            isAvailable: true,
            hasCredentialsSaved: true,
            type: biometricInfo.type,
          });
        } catch (bErr) {
          console.warn("Could not save biometric credentials:", bErr);
        }

        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans pt-safe pb-safe">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="px-6 py-8 sm:px-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">ecpmanager</h1>
            <p className="text-sm text-gray-500 mt-2">Connectez-vous à votre espace administrateur</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 flex items-start gap-3 border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              id="email"
              label="Adresse email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              icon={<Mail className="h-5 w-5" />}
            />

            <Input
              id="password"
              label="Mot de passe"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="h-5 w-5" />}
            />

            <div className="pt-2 flex gap-3">
              <Button
                type="submit"
                isLoading={loading}
                className="flex-1 mt-2"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
              
              {(biometricInfo.isAvailable || biometricInfo.hasCredentialsSaved) && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-12 h-12 mt-2 p-0 flex items-center justify-center shrink-0 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                  title={
                    biometricInfo.type === 'web'
                      ? 'Se connecter avec la biométrie (Touch ID / Face ID / Empreinte Web)'
                      : 'Se connecter avec l\'empreinte digitale'
                  }
                >
                  <Fingerprint className="w-5 h-5 text-indigo-600" />
                </Button>
              )}
            </div>
          </form>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center flex flex-col gap-2.5">
          <p className="text-xs text-gray-500">Accès restreint aux administrateurs autorisés.</p>
          <div className="border-t border-gray-200/60 pt-3 flex flex-col gap-2">
            <Link 
              to="/client/login"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              Retourner à l'Espace Apprenant (Client)
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link 
              to="/"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Visiter notre site web
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
