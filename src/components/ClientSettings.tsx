import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Settings, Lock, User, Gift, ExternalLink, ShieldCheck, Mail, Phone, Heart, Save } from 'lucide-react';
import { ReferralCodeInfo } from '../lib/referralService';

export default function ClientSettings({ profile, referralCode, onUpdateProfile }: { profile: any, referralCode: ReferralCodeInfo | null, onUpdateProfile: (updated: any) => void }) {
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsLoading(true);
    setStatus(null);

    try {
      const { error } = await supabase
        .from('client_profiles')
        .update({ first_name: firstName, last_name: lastName })
        .eq('id', profile.id);

      if (error) throw error;

      setStatus({ type: 'success', message: 'Profil mis à jour avec succès.' });
      onUpdateProfile({ ...profile, first_name: firstName, last_name: lastName });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: "Erreur lors de la mise à jour du profil." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !profile.email) return;
    setIsLoading(true);
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Les nouveaux mots de passe ne correspondent pas.' });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Verify old password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: oldPassword,
      });

      if (signInError) {
        throw new Error("L'ancien mot de passe est incorrect.");
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setStatus({ type: 'success', message: 'Mot de passe mis à jour avec succès.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || "Erreur lors de la mise à jour du mot de passe." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-slate-100 p-3 rounded-2xl text-slate-700">
          <Settings className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Paramètres de votre compte</h2>
      </div>

      {status && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {status.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : null}
          {status.message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Modifier le profil */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
            <User className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Informations personnelles</h3>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 p-3"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 p-3"
                required
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 px-4 font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Mettre à jour le profil
              </button>
            </div>
          </form>
        </div>

        {/* Modifier le mot de passe */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
            <Lock className="w-5 h-5 text-rose-600" />
            <h3 className="text-lg font-bold text-gray-900">Mot de passe</h3>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Ancien mot de passe</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm bg-gray-50 p-3"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm bg-gray-50 p-3"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm bg-gray-50 p-3"
                minLength={6}
                required
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-rose-600 text-white rounded-xl py-3 px-4 font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                Mettre à jour le mot de passe
              </button>
            </div>
          </form>
        </div>

        {/* Code PROMO */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm md:col-span-2">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
            <Gift className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-gray-900">Vos Codes PROMO</h3>
          </div>
          
          <div className="bg-amber-50 rounded-2xl p-6 text-amber-900">
            {referralCode ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-lg mb-1">Vous disposez d'un code PROMO</h4>
                  <p className="text-sm opacity-90">Utilisez ce code lors de vos achats ou partagez-le pour parrainer d'autres personnes.</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-xl border-2 border-amber-200 font-mono text-2xl font-black text-amber-600 shadow-sm">
                  {referralCode.code}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h4 className="font-bold text-lg mb-2">Aucun code PROMO actif</h4>
                  <p className="text-sm opacity-90 leading-relaxed max-w-xl">
                    Vous n'avez pas encore de code PROMO pour nos formations. Cliquez sur le bouton pour contacter l'administration via WhatsApp et demander les modalités pour en obtenir un.
                  </p>
                </div>
                <a
                  href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour, je suis ${profile?.first_name || ''} ${profile?.last_name || ''}. J'aimerais connaître les modalités pour avoir un code PROMO pour vos formations. Merci !`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-2 bg-amber-600 text-white rounded-xl py-3 px-5 font-bold hover:bg-amber-700 transition-colors shadow-sm"
                >
                  Demander sur WhatsApp
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Text */}
      <div className="mt-12 text-center text-sm text-gray-500 bg-white border border-gray-100 p-8 rounded-3xl shadow-sm">
        <p className="flex items-center justify-center gap-1 mb-2 font-medium">
          Fait avec <Heart className="w-4 h-4 text-rose-500 fill-rose-500" /> par Pierre Valdeze MBOM MBOM, Promoteur de ©ECP
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-gray-400">
          <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> pierrembom@outlook.com</span>
          <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> +237 698389030 / 650989019</span>
        </div>
        <p className="mt-6 text-xs font-bold text-gray-400">
          Tous droits reservés Exceller Chez Pierre {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
