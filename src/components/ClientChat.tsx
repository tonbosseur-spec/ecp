import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, Loader2, MessageSquare, AlertCircle, CheckCircle2, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VerifiedBadge from './VerifiedBadge';

interface ClientChatProps {
  courseId?: string;
  registrationId?: string;
  onClose?: () => void;
}

interface Message {
  id: string;
  client_id: string;
  sender_id: string;
  content: string;
  course_id?: string;
  registration_id?: string;
  courses?: { title: string } | null;
  is_read: boolean;
  created_at: string;
}

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-blue-400 transition-colors">
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export const ClientChat: React.FC<ClientChatProps> = ({ courseId, registrationId, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedContextId, setSelectedContextId] = useState<string | null>(courseId || null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedContextId]);

  useEffect(() => {
    let channel: any;

    const setupChat = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setClientId(user.id);

        if (courseId) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('title')
            .eq('id', courseId)
            .single();
          if (courseData) {
            setCourseTitle(courseData.title);
          }
        }

        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*, courses(title)')
          .eq('client_id', user.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(messagesData || []);

        // Realtime Subscription
        channel = supabase
          .channel(`messages_channel_client_${user.id}_${Math.random()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `client_id=eq.${user.id}`,
            },
            async (payload) => {
              if (payload.eventType === 'INSERT') {
                let newMsg = payload.new as Message;
                
                // Fetch course title if it has a course_id
                if (newMsg.course_id) {
                  const { data: courseData } = await supabase
                    .from('courses')
                    .select('title')
                    .eq('id', newMsg.course_id)
                    .single();
                  if (courseData) {
                    newMsg = { ...newMsg, courses: courseData } as any;
                  }
                }
                setMessages((prev) => [...prev, newMsg]);
              } else if (payload.eventType === 'UPDATE') {
                const updatedMsg = payload.new as Message;
                setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    setupChat();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [courseId]);

  useEffect(() => {
    if (!selectedContextId || !clientId || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) =>
        m.sender_id !== clientId &&
        !m.is_read &&
        (selectedContextId === 'general' ? m.course_id === null : m.course_id === selectedContextId)
    );

    if (unreadMessages.length > 0) {
      const updateReadStatus = async () => {
        try {
          const idsToUpdate = unreadMessages.map(m => m.id);
          const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', idsToUpdate);
            
          if (error) console.error('Error updating read status:', error);
        } catch (err) {
          console.error(err);
        }
      };
      updateReadStatus();
    }
  }, [selectedContextId, messages, clientId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !clientId) return;

    setSending(true);
    setSendError(null);
    try {
      const msgData: any = {
        client_id: clientId,
        sender_id: clientId,
        content: newMessage.trim(),
        is_read: false
      };
      
      if (selectedContextId && selectedContextId !== 'general') {
        msgData.course_id = selectedContextId;
      }

      const { error } = await supabase.from('messages').insert([msgData]);
      if (error) throw error;

      setNewMessage('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      let errorMsg = err.message || "Une erreur est survenue lors de l'envoi du message.";
      if (err.code === '23503') {
        errorMsg = "Impossible d'envoyer le message : votre profil client est incomplet. Veuillez vous déconnecter et créer un nouveau compte.";
      }
      setSendError(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const clientContexts = React.useMemo(() => {
    interface ChatContext {
      id: string;
      title: string;
      last_message: Message | null;
      unread_count: number;
    }
    
    const contextsMap = new Map<string, ChatContext>();
    contextsMap.set('general', { id: 'general', title: 'Conversation Générale', unread_count: 0, last_message: null });

    messages.forEach(msg => {
      const ctxId = msg.course_id || 'general';
      if (!contextsMap.has(ctxId)) {
        contextsMap.set(ctxId, {
          id: ctxId,
          title: msg.courses?.title ? `Formation : ${msg.courses.title}` : (ctxId === 'general' ? 'Conversation Générale' : 'Sujet inconnu'),
          unread_count: 0,
          last_message: null
        });
      }
      const ctx = contextsMap.get(ctxId)!;
      if (!ctx.last_message || new Date(msg.created_at).getTime() > new Date(ctx.last_message.created_at).getTime()) {
        ctx.last_message = msg;
      }
      if (msg.sender_id !== clientId && !msg.is_read) {
        ctx.unread_count += 1;
      }
    });

    return Array.from(contextsMap.values()).sort((a, b) => {
      if (a.id === 'general') return -1;
      if (b.id === 'general') return 1;
      if (a.last_message && b.last_message) {
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
      }
      return 0;
    });
  }, [messages, clientId]);

  const activeMessages = selectedContextId
    ? messages
        .filter((m) => (selectedContextId === 'general' ? m.course_id === null : m.course_id === selectedContextId))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [];

  const activeContext = clientContexts.find(c => c.id === selectedContextId);

  const getSubjectBanner = () => {
    if (activeContext) {
      return `💬 Sujet : ${activeContext.title}`;
    }
    return `💬 Sujet : Sélectionner une conversation`;
  };

  if (!selectedContextId) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50 shadow-sm border border-gray-200 rounded-2xl overflow-hidden overflow-y-auto p-6">
        <div className="flex items-center gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 max-w-4xl mx-auto w-full">
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
              M
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">Messagerie</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                Sélectionnez le contexte de votre demande
              </p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
          {clientContexts.map(ctx => (
            <button
              key={ctx.id}
              onClick={() => setSelectedContextId(ctx.id)}
              className="flex items-center justify-between p-6 bg-white border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all text-left group"
            >
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">{ctx.title}</h4>
                {ctx.last_message ? (
                  <p className="text-sm text-gray-500 mt-1 truncate">
                     {ctx.last_message.sender_id === clientId ? 'Vous: ' : ''}{ctx.last_message.content}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 mt-1 italic">
                     Démarrer une conversation
                  </p>
                )}
              </div>
              {ctx.unread_count > 0 ? (
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-[11px] font-bold text-white">{ctx.unread_count}</span>
                </div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header Banner */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center shadow-sm z-10 relative">
        {(onClose || (!courseId && selectedContextId)) && (
          <button 
            onClick={() => {
               if (!courseId && selectedContextId) {
                 setSelectedContextId(null);
               } else if (onClose) {
                 onClose();
               }
            }}
            className="p-2 -ml-2 mr-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-lg mr-4">
          A
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-lg leading-tight flex items-center gap-1.5">
            <span>Astral (Administrateur)</span>
            <VerifiedBadge size="sm" />
          </h3>
          <p className="text-sm text-indigo-600 font-medium">{getSubjectBanner()}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 relative group">
        {/* Watermark Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-[0.05] dark:opacity-[0.08]">
          <MessageSquare className="absolute top-10 -left-10 w-64 h-64 rotate-12 text-indigo-500" />
          <Send className="absolute bottom-20 -right-20 w-80 h-80 -rotate-12 text-purple-500" />
          <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-indigo-400 rounded-full blur-[100px] opacity-20" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-400 rounded-full blur-[120px] opacity-20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[40px] border-indigo-500 rounded-full opacity-10" />
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-full relative z-10">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-md mx-auto relative z-10">
            <div className="w-24 h-24 bg-white shadow-xl shadow-indigo-100 rounded-[2rem] flex items-center justify-center mb-4 transform hover:rotate-6 transition-transform">
              <MessageSquare className="w-12 h-12 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Besoin d'aide ?</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Posez votre question ci-dessous, notre équipe vous répondra dans les plus brefs délais.
            </p>
          </div>
        ) : (
          <div className="relative z-10 max-w-4xl mx-auto w-full">
            <AnimatePresence initial={false}>
              {activeMessages.map((msg, idx) => {
                const isClient = msg.sender_id === clientId;
                const showAvatar = idx === 0 || activeMessages[idx - 1].sender_id !== msg.sender_id;
                
                return (
                  <motion.div
                    key={`${msg.id}-${idx}`}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${isClient ? 'justify-end' : 'justify-start'} gap-3 mb-4`}
                  >
                    {!isClient && (
                      <div className="w-10 flex-shrink-0 flex items-end">
                        {showAvatar ? (
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-200">
                            P
                          </div>
                        ) : <div className="w-9" />}
                      </div>
                    )}
                    
                    <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isClient ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-3 text-[14px] md:text-[15px] shadow-sm leading-relaxed whitespace-pre-wrap break-words transition-all duration-300 ${
                          isClient
                            ? 'bg-slate-900 text-white rounded-2xl rounded-tr-none'
                            : 'bg-white border border-slate-100 text-slate-800 rounded-2xl rounded-tl-none'
                        }`}
                      >
                        {renderTextWithLinks(msg.content)}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isClient ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {formatTime(msg.created_at)}
                        </span>
                        {isClient && (
                          <span className={msg.is_read ? "text-sky-500" : "text-slate-300"}>
                            {msg.is_read ? <CheckCheck className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        {sendError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 p-3 text-sm bg-rose-50 text-rose-600 rounded-xl flex items-center gap-2 border border-rose-100 font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {sendError}
          </motion.div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative group">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Écrivez votre message..."
              className="w-full bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-2xl px-5 py-3.5 text-[15px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none resize-none overflow-hidden min-h-[56px] max-h-[150px] transition-all placeholder:text-slate-400 placeholder:font-medium"
              rows={1}
              disabled={sending || loading}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending || loading}
            className="w-14 h-14 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 flex-shrink-0 shadow-lg shadow-slate-200 flex items-center justify-center group"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
          </button>
        </form>
      </div>

    </div>
  );
};
