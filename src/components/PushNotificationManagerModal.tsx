import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { broadcastPushNotification, sendPushNotificationToUser } from '../lib/pushNotificationService';
import { Bell, Send, Users, ShieldCheck, X, CheckCircle2, AlertCircle, Smartphone, Settings, Key, HelpCircle } from 'lucide-react';

interface PushNotificationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string;
  targetUserName?: string;
}

export function PushNotificationManagerModal({
  isOpen,
  onClose,
  targetUserId,
  targetUserName,
}: PushNotificationManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'send' | 'config'>('send');
  const [mode, setMode] = useState<'single' | 'broadcast'>(targetUserId ? 'single' : 'broadcast');
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>(targetUserId || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('/client/hub');
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // FCM HTTP v1 Config state
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [configSavedMessage, setConfigSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTokenizedUsers();
      if (targetUserId) {
        setSelectedUser(targetUserId);
        setMode('single');
      }

      // Load saved FCM HTTP v1 credentials from localStorage
      const savedSa = localStorage.getItem('fcm_service_account') || '';
      const savedToken = localStorage.getItem('fcm_bearer_token') || '';
      setServiceAccountJson(savedSa);
      setBearerToken(savedToken);
    }
  }, [isOpen, targetUserId]);

  const fetchTokenizedUsers = async () => {
    try {
      // 1. Fetch from client_profiles
      const { data: clientsData, error: clientErr } = await supabase
        .from('client_profiles')
        .select('id, first_name, last_name, phone, fcm_token')
        .order('created_at', { ascending: false });

      // 2. Fetch from registrations to catch any users without a full client_profile
      const { data: regsData } = await supabase
        .from('registrations')
        .select('client_id, participant_name, participant_phone, participant_email')
        .not('client_id', 'is', null);

      const clientMap = new Map<string, any>();

      if (clientsData) {
        clientsData.forEach((c) => {
          clientMap.set(c.id, {
            id: c.id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Client (sans nom)',
            phone: c.phone || '',
            fcm_token: c.fcm_token,
          });
        });
      }

      if (regsData) {
        regsData.forEach((r) => {
          if (r.client_id && !clientMap.has(r.client_id)) {
            clientMap.set(r.client_id, {
              id: r.client_id,
              name: r.participant_name || r.participant_email || 'Client',
              phone: r.participant_phone || '',
              fcm_token: null,
            });
          }
        });
      }

      setRegisteredUsers(Array.from(clientMap.values()));
    } catch (err) {
      console.warn('Failed to fetch clients list:', err);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (serviceAccountJson.trim()) {
      try {
        JSON.parse(serviceAccountJson.trim());
        localStorage.setItem('fcm_service_account', serviceAccountJson.trim());
      } catch (err) {
        setConfigSavedMessage('⚠️ Le JSON du Compte de Service (Service Account) semble invalide.');
        return;
      }
    } else {
      localStorage.removeItem('fcm_service_account');
    }

    if (bearerToken.trim()) {
      localStorage.setItem('fcm_bearer_token', bearerToken.trim());
    } else {
      localStorage.removeItem('fcm_bearer_token');
    }

    setConfigSavedMessage('✅ Configuration FCM HTTP v1 enregistrée avec succès !');
    setTimeout(() => setConfigSavedMessage(null), 3000);
  };

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir un titre et un contenu de notification.' });
      return;
    }

    setSending(true);
    setStatusMessage(null);

    try {
      const configOverride = {
        serviceAccountJson: serviceAccountJson.trim() || undefined,
        bearerToken: bearerToken.trim() || undefined,
      };

      if (mode === 'single') {
        if (!selectedUser) {
          throw new Error('Veuillez sélectionner un destinataire.');
        }

        const res = await sendPushNotificationToUser(
          selectedUser,
          {
            title: title.trim(),
            body: body.trim(),
            url: linkUrl.trim() || '/client/hub',
          },
          configOverride
        );

        if (res.success) {
          setStatusMessage({ type: 'success', text: 'Notification Push v1 envoyée avec succès sur le mobile Android !' });
          setTitle('');
          setBody('');
        } else {
          throw new Error(res.error || 'Échec d’envoi de la notification push.');
        }
      } else {
        // Broadcast mode
        const res = await broadcastPushNotification(
          {
            title: title.trim(),
            body: body.trim(),
            url: linkUrl.trim() || '/client/hub',
          },
          configOverride
        );

        if (res.successCount > 0) {
          setStatusMessage({
            type: 'success',
            text: `Diffusion FCM v1 réussie : ${res.successCount} appareil(s) notifié(s) avec succès !`,
          });
          setTitle('');
          setBody('');
        } else {
          throw new Error(
            `Aucune notification n'a pu être livrée (${res.failureCount} échec(s)). Vérifiez votre configuration FCM HTTP v1 dans l'onglet Configuration.`
          );
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Une erreur est survenue lors de l’envoi.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base flex flex-wrap items-center gap-1.5 leading-snug">
                <span>Notifications Push FCM</span>
                <span className="text-[10px] uppercase font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                  HTTP v1
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {registeredUsers.length} client(s) au total ({registeredUsers.filter(u => !!u.fcm_token).length} appareil(s) Android enregistrés)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer la fenêtre modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer shrink-0 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 pt-2 bg-slate-50/30 dark:bg-slate-800/30 gap-2">
          <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('send')}
              className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'send'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Envoyer une notification</span>
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'config'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configuration API HTTP v1</span>
            </button>
          </div>
          
          <div className="pb-2 sm:pb-3 text-[11px] font-semibold flex items-center gap-1.5 shrink-0 self-start sm:self-center">
            {serviceAccountJson.trim() ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> Clé sauvegardée
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-3 h-3" /> Clé API requise
              </span>
            )}
          </div>
        </div>

        {/* Content Tab 1: Send */}
        {activeTab === 'send' && (
          <form onSubmit={handleSend} className="p-6 space-y-4 overflow-y-auto">
            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode('broadcast')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  mode === 'broadcast'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Tous les clients ({registeredUsers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  mode === 'single'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>Client spécifique</span>
              </button>
            </div>

            {/* User selector if mode === 'single' */}
            {mode === 'single' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Destinataire
                </label>
                {targetUserName ? (
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {targetUserName}
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Sélectionner un utilisateur --</option>
                      {registeredUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fcm_token ? '📱 ' : '⚠️ '}
                          {u.name} {u.phone ? `(${u.phone})` : ''} 
                          {u.fcm_token ? ' [Android APK Ok]' : ' [Sans APK Android]'}
                        </option>
                      ))}
                    </select>
                    {selectedUser && (
                      <div className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {registeredUsers.find(u => u.id === selectedUser)?.fcm_token ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Appareil Android APK connecté pour ce client. Notification push instantanée.
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Pas encore connecté via l'APK Android. Notification In-App enregistrée.
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Titre de la notification *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 🔴 La séance Live va commencer !"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Message de la notification *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ex: Rejoignez immédiatement votre formateur en direct dans la salle virtuelle."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Target link */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Lien de redirection dans l’application
              </label>
              <input
                type="text"
                placeholder="/client/hub?section=messages"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status feedback */}
            {statusMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 font-semibold ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Fermer
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Envoi en cours...' : 'Envoyer la notification (FCM v1)'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Content Tab 2: Config */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig} className="p-6 space-y-4 overflow-y-auto">
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-2xl text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Comment obtenir vos identifiants FCM HTTP v1 ?</span>
              </div>
              <p>
                Sur la console Firebase (<strong>Console Firebase → Paramètres du projet → Comptes de service</strong>), cliquez sur <strong>"Générer une nouvelle clé privée"</strong>.
              </p>
              <p>
                Collez l’intégralité du contenu JSON téléchargé ci-dessous. L’application signera automatiquement les jetons OAuth2 JWT en temps réel pour l'API HTTP v1.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Clé du compte de service Firebase (Service Account JSON)</span>
              </label>
              <textarea
                rows={6}
                placeholder={`{\n  "type": "service_account",\n  "project_id": "ecpmanager",\n  "private_key_id": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",\n  "client_email": "...@ecpmanager.iam.gserviceaccount.com"\n}`}
                value={serviceAccountJson}
                onChange={(e) => setServiceAccountJson(e.target.value)}
                className="w-full p-3 font-mono text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase">Ou Jeton Bearer direct</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Jeton OAuth2 Bearer Google FCM v1 (Temporaire)
              </label>
              <input
                type="text"
                placeholder="ya29.a0ARW5m..."
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {configSavedMessage && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200">
                {configSavedMessage}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Enregistrer la configuration v1</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

