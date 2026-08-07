import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  User,
  ShieldAlert,
} from 'lucide-react';
import {
  AdminUser,
  getAllAdminUsers,
  createAdminAccount,
  deleteAdminAccount,
  extractErrorMessage,
  SUPERADMIN_EMAIL,
} from '../lib/adminAuthService';
import { useToast } from './Toast';

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminManagementModal({ isOpen, onClose }: AdminManagementModalProps) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [fetchingList, setFetchingList] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAdmins = async () => {
    setFetchingList(true);
    const list = await getAllAdminUsers();
    setAdminList(list);
    setFetchingList(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadAdmins();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await createAdminAccount({ fullName, email, password });
      setLoading(false);

      const msg = extractErrorMessage(result?.message) || 'Résultat de la création';

      if (result && result.success) {
        setSuccessMsg(msg);
        toast.success(msg);
        setFullName('');
        setEmail('');
        setPassword('');
        await loadAdmins();
      } else {
        setErrorMsg(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      setLoading(false);
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  const handleDelete = async (targetEmail: string, name: string) => {
    if (
      !window.confirm(
        `Voulez-vous vraiment retirer les privilèges d'administration à ${name} (${targetEmail}) ?`
      )
    ) {
      return;
    }

    const res = await deleteAdminAccount(targetEmail);
    if (res.success) {
      toast.success(res.message);
      await loadAdmins();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Espace Administration</h2>
              <p className="text-xs text-slate-400">Gestion des administrateurs autorisés (Superadmin)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-medium animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-3 text-sm font-medium animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              Créer un nouvel administrateur
            </h3>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nom & Prénom
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Jean Dupont"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Adresse Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="admin@ecp.cm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Création du compte...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Créer le compte administrateur</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Admin List */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              Administrateurs enregistrés ({adminList.length})
            </h3>

            {fetchingList ? (
              <div className="py-8 text-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <span className="text-xs">Chargement de la liste...</span>
              </div>
            ) : adminList.length === 0 ? (
              <p className="text-xs text-gray-500 italic text-center py-4">Aucun administrateur enregistré.</p>
            ) : (
              <div className="space-y-2">
                {adminList.map((adm) => {
                  const isMainSuper = adm.email.toLowerCase().trim() === SUPERADMIN_EMAIL.toLowerCase();
                  return (
                    <div
                      key={adm.email}
                      className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                            isMainSuper ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {adm.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900 text-sm truncate">{adm.full_name}</h4>
                            {isMainSuper && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                                Superadmin
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{adm.email}</p>
                        </div>
                      </div>

                      {!isMainSuper && (
                        <button
                          onClick={() => handleDelete(adm.email, adm.full_name)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shrink-0"
                          title="Supprimer les droits administrateur"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-100 text-right shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
