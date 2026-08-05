import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Bell, 
  Video, 
  MessageSquare, 
  CreditCard, 
  Sparkles, 
  CheckCircle2, 
  X, 
  Trash2, 
  Check, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'live' | 'message' | 'payment' | 'system';
  timestamp: string;
  read: boolean;
  link?: string;
  actionLabel?: string;
  dbMessageId?: string;
}

// Play a subtle notification chime using Web Audio API
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio context prevented or blocked by browser policy
  }
}

// Browser Web Push Notification trigger
export function triggerWebPushNotification(title: string, body: string, link?: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'astral-notification',
      });
      if (link) {
        notif.onclick = () => {
          window.focus();
          window.location.href = link;
        };
      }
    } catch (err) {
      console.warn('Push Notification Error:', err);
    }
  }
}

interface NotificationBellProps {
  userId?: string;
  userRole?: 'admin' | 'client';
  className?: string;
}

export default function NotificationBell({ userId, userRole = 'client', className = '' }: NotificationBellProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const STORAGE_KEY = `astral_notifications_${userId || 'guest'}`;
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // 1. Load initial notifications from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setNotifications(JSON.parse(saved));
      } else {
        // Initial welcome sample notification
        const initial: NotificationItem[] = [
          {
            id: 'welcome-1',
            title: 'Bienvenue sur la plateforme !',
            message: 'Votre espace est opérationnel. Vous recevrez ici vos rappels de Live, validations de paiements et messages.',
            type: 'system',
            timestamp: new Date().toISOString(),
            read: false,
          }
        ];
        setNotifications(initial);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      }
    } catch {
      // Fallback
    }
  }, [STORAGE_KEY]);

  // Save to local storage on change
  const updateNotificationsState = (newList: NotificationItem[]) => {
    setNotifications(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // Ignore storage quota error
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Request Push Permission
  const requestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') {
        triggerWebPushNotification(
          "Notifications Push Activées",
          "Vous recevrez désormais les rappels de cours en direct et les messages directement sur votre appareil !"
        );
      }
    }
  };

  // Helper to append a new notification cleanly
  const addNotification = (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: string; dbMessageId?: string }) => {
    const newItem: NotificationItem = {
      ...notif,
      id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: notif.timestamp || new Date().toISOString(),
      read: false,
      dbMessageId: notif.dbMessageId,
    };

    setNotifications((prev) => {
      // Prevent duplicates with same id, dbMessageId, or identical title & message
      const exists = prev.some(
        (item) =>
          (newItem.id && item.id === newItem.id) ||
          (newItem.dbMessageId && item.dbMessageId && item.dbMessageId === newItem.dbMessageId) ||
          (item.title === newItem.title && item.message === newItem.message)
      );
      if (exists) return prev;

      const updated = [newItem, ...prev].slice(0, 40); // Keep last 40
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }

      // Sound & Push
      if (soundEnabled) {
        playNotificationSound();
      }
      triggerWebPushNotification(newItem.title, newItem.message, newItem.link);

      return updated;
    });
  };

  // 2. Realtime Subscriptions & Automated Checks
  useEffect(() => {
    // A. Check for Live Sessions (Upcoming or Currently Live)
    const checkLiveSessions = async () => {
      try {
        const { data: lives } = await supabase
          .from('live_sessions')
          .select('id, title, room_code, status, scheduled_at, trainer_name')
          .or('status.eq.live,status.eq.scheduled')
          .order('scheduled_at', { ascending: true });

        if (lives && lives.length > 0) {
          lives.forEach((session) => {
            if (session.status === 'live') {
              addNotification({
                id: `live_session_${session.id}_live`,
                title: '🔴 Séance Live en direct !',
                message: `La session "${session.title}" a démarré avec ${session.trainer_name || 'votre formateur'}. Rejoignez le direct !`,
                type: 'live',
                link: `/live/${session.room_code}`,
                actionLabel: 'Rejoindre le Live',
              });
            } else if (session.scheduled_at) {
              const scheduledTime = new Date(session.scheduled_at).getTime();
              const now = Date.now();
              const diffMinutes = Math.round((scheduledTime - now) / 60000);

              if (diffMinutes > 0 && diffMinutes <= 30) {
                addNotification({
                  id: `live_reminder_${session.id}`,
                  title: '⏰ Rappel Live imminant',
                  message: `La séance "${session.title}" commence dans ${diffMinutes} min. Préparez-vous !`,
                  type: 'live',
                  link: `/live/${session.room_code}`,
                  actionLabel: 'Accéder au direct',
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn('Error checking live sessions:', err);
      }
    };

    // B. Check for Payments Validation
    const checkPayments = async () => {
      if (!userId && userRole === 'client') return;
      try {
        const { data: regs } = await supabase
          .from('registrations')
          .select('id, payment_status, courses(title), client_id')
          .eq(userRole === 'client' ? 'client_id' : 'id', userId)
          .order('registered_at', { ascending: false })
          .limit(5);

        if (regs && regs.length > 0) {
          regs.forEach((reg) => {
            if (reg.payment_status === 'approved') {
              addNotification({
                id: `payment_reg_${reg.id}_approved`,
                title: '✅ Paiement Validé !',
                message: `Votre accès à la formation "${(reg.courses as any)?.title || 'Formation'}" a été validé par l'administration.`,
                type: 'payment',
                link: '/client/hub?section=formations',
                actionLabel: 'Voir ma formation',
              });
            }
          });
        }
      } catch (err) {
        console.warn('Error checking payments:', err);
      }
    };

    // C. Check Unread In-App Messages
    const checkUnreadMessages = async () => {
      try {
        if (userRole === 'client') {
          if (!userId) return;
          const { data: unread } = await supabase
            .from('messages')
            .select('id, content, created_at, sender_type')
            .eq('client_id', userId)
            .eq('sender_type', 'admin')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(10);

          if (unread && unread.length > 0) {
            unread.forEach((msg) => {
              addNotification({
                id: `msg_${msg.id}`,
                title: '💬 Nouveau message de l\'administrateur',
                message: msg.content || 'Vous avez un nouveau message de l\'administrateur.',
                type: 'message',
                link: '/client/hub?section=messages',
                actionLabel: 'Répondre',
                dbMessageId: msg.id,
                timestamp: msg.created_at,
              });
            });
          }
        } else if (userRole === 'admin') {
          const { data: unread } = await supabase
            .from('messages')
            .select('id, content, created_at, sender_type, client_id')
            .eq('sender_type', 'client')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(10);

          if (unread && unread.length > 0) {
            unread.forEach((msg) => {
              addNotification({
                id: `msg_${msg.id}`,
                title: '💬 Nouveau message client',
                message: msg.content || 'Un client vous a envoyé un message.',
                type: 'message',
                link: `/admin/clients?tab=messages&client=${msg.client_id}`,
                actionLabel: 'Voir le message',
                dbMessageId: msg.id,
                timestamp: msg.created_at,
              });
            });
          }
        }
      } catch (err) {
        console.warn('Error checking unread messages:', err);
      }
    };

    // Initial check
    checkLiveSessions();
    checkPayments();
    checkUnreadMessages();

    // Periodic check every 2 minutes
    const interval = setInterval(() => {
      checkLiveSessions();
      checkPayments();
      checkUnreadMessages();
    }, 120000);

    // Supabase Realtime Channel for Live Sessions & Messages
    const channelName = `notif_channel_${userId || 'guest'}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          if (userRole === 'client' && msg.sender_type === 'admin' && msg.client_id === userId) {
            addNotification({
              id: `msg_${msg.id}`,
              title: '💬 Nouveau message de l\'administrateur',
              message: msg.content || 'Vous avez reçu un nouveau message.',
              type: 'message',
              link: '/client/hub?section=messages',
              actionLabel: 'Répondre',
              dbMessageId: msg.id,
              timestamp: msg.created_at || new Date().toISOString(),
            });
          } else if (userRole === 'admin' && msg.sender_type === 'client') {
            addNotification({
              id: `msg_${msg.id}`,
              title: '💬 Nouveau message client',
              message: msg.content || 'Un client vous a envoyé un message.',
              type: 'message',
              link: `/admin/clients?tab=messages&client=${msg.client_id}`,
              actionLabel: 'Voir le message',
              dbMessageId: msg.id,
              timestamp: msg.created_at || new Date().toISOString(),
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          if (msg.is_read) {
            setNotifications((prev) => {
              const updated = prev.map((item) =>
                item.dbMessageId === msg.id ? { ...item, read: true } : item
              );
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registrations' },
        (payload) => {
          const updated = payload.new;
          if (userRole === 'client' && updated.client_id === userId) {
            if (updated.payment_status === 'approved') {
              addNotification({
                title: '🎉 Inscription Approuvée !',
                message: `Votre inscription a été validée. Vous avez maintenant accès à l'ensemble du contenu.`,
                type: 'payment',
                link: '/client/hub',
                actionLabel: 'Accéder aux contenus',
              });
            } else if (updated.payment_status === 'rejected') {
              addNotification({
                title: '⚠️ Mise à jour sur votre inscription',
                message: `Votre demande d'accès nécessite une vérification de paiement. Contactez le support via le Chat.`,
                type: 'payment',
                link: '/client/hub?section=messages',
                actionLabel: 'Ouvrir la messagerie',
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions' },
        (payload) => {
          const session = payload.new;
          if (session.status === 'live') {
            addNotification({
              title: '🔴 Le Live vient de démarrer !',
              message: `Rejoignez la session en direct: ${session.title}`,
              type: 'live',
              link: `/live/${session.room_code}`,
              actionLabel: 'Rejoindre immédiatement',
            });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId, userRole]);

  // Derived states
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const markAsRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (target?.dbMessageId) {
      supabase.from('messages').update({ is_read: true }).eq('id', target.dbMessageId).then();
    }
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    updateNotificationsState(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    updateNotificationsState(updated);
  };

  const clearAll = () => {
    updateNotificationsState([]);
  };

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    markAsRead(id);
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleNotificationClick = (item: NotificationItem, e?: React.MouseEvent) => {
    markAsRead(item.id);
    setExpandedIds((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
    );
  };

  const handleActionClick = (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(item.id);
    setIsOpen(false);
    if (item.link) {
      if (item.link.startsWith('http')) {
        window.open(item.link, '_blank');
      } else {
        navigate(item.link);
      }
    }
  };

  const getTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'live':
        return <Video className="w-4 h-4 text-red-500" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
    }
  };

  const getTypeBadge = (type: NotificationItem['type']) => {
    switch (type) {
      case 'live':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'message':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'payment':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "À l'instant";
    if (diffSec < 3600) return `Il y a ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Il y a ${Math.floor(diffSec / 3600)} h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-2xs transition-all duration-200 focus:outline-hidden"
        title="Centre de notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 transition-transform group-hover:rotate-12" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-slate-900 shadow-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Notification Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay (Mobile & Desktop) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/30 sm:bg-slate-950/20 backdrop-blur-xs z-[9998]"
            />

            {/* Main Panel Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -16 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 sm:top-16 sm:right-6 lg:right-10 sm:left-auto sm:translate-x-0 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl z-[9999] overflow-hidden max-h-[calc(100vh-6.5rem)] sm:max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-full">
                      {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ${
                      soundEnabled ? 'text-indigo-600' : ''
                    }`}
                    title={soundEnabled ? 'Son activé' : 'Son désactivé'}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Browser Push Permission Banner if Default */}
              {pushPermission === 'default' && (
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="font-medium">Activer les rappels push sur cet appareil ?</span>
                  </div>
                  <button
                    onClick={requestPushPermission}
                    className="px-2.5 py-1 bg-white text-indigo-700 font-extrabold text-[10px] rounded-lg shadow-2xs hover:bg-indigo-50 transition-all shrink-0"
                  >
                    Activer
                  </button>
                </div>
              )}

              {/* Filter Tabs & Quick Actions */}
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      filter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Toutes ({notifications.length})
                  </button>
                  <button
                    onClick={() => setFilter('unread')}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      filter === 'unread'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Non lues ({unreadCount})
                  </button>
                </div>

                {notifications.length > 0 && (
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        title="Tout marquer comme lu"
                      >
                        <Check className="w-3 h-3" /> Marquer lu
                      </button>
                    )}
                    <button
                      onClick={clearAll}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="Effacer tout"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Notifications List - vertically scrollable and expandable */}
              <div className="flex-1 overflow-y-auto max-h-[55vh] sm:max-h-80 divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
                {filteredNotifications.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 mx-auto mb-3">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Aucune notification
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {filter === 'unread'
                        ? 'Toutes vos notifications sont lues !'
                        : 'Vous recevrez vos rappels ici.'}
                    </p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {filteredNotifications.map((item) => {
                      const isExpanded = expandedIds.includes(item.id);
                      const isLongText = item.message.length > 55;

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          onClick={(e) => handleNotificationClick(item, e)}
                          className={`p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-all cursor-pointer flex items-start gap-3 relative ${
                            !item.read ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          {!item.read && (
                            <span className="absolute top-4 left-2 w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                          )}

                          <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-2xs shrink-0 mt-0.5">
                            {getTypeIcon(item.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${getTypeBadge(item.type)}`}>
                                {item.type}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug break-words">
                              {item.title}
                            </h4>
                            
                            <p className={`text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed transition-all break-words ${
                              isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'
                            }`}>
                              {item.message}
                            </p>

                            {/* Unfold / fold toggle button */}
                            {isLongText && (
                              <button
                                onClick={(e) => toggleExpand(item.id, e)}
                                className="mt-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                              >
                                <span>{isExpanded ? 'Replier' : 'Dérouler la notification'}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            )}

                            {item.actionLabel && (
                              <button
                                onClick={(e) => handleActionClick(item, e)}
                                className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 transition-colors"
                              >
                                <span>{item.actionLabel}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-center shrink-0">
                <p className="text-[10px] text-slate-400 font-medium">
                  Système de rappel en temps réel • Astral
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
