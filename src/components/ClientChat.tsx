import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, Loader2, MessageSquare, AlertCircle, CheckCircle2, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
          <h3 className="font-bold text-gray-900 text-lg leading-tight">Astral (Administrateur)</h3>
          <p className="text-sm text-indigo-600 font-medium">{getSubjectBanner()}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 max-w-md mx-auto">
            <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Besoin d'aide ?</h3>
            <p className="text-gray-500">Posez votre question ci-dessous, notre équipe vous répondra dans les plus brefs délais.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {activeMessages.map((msg, idx) => {
              const isClient = msg.sender_id === clientId;
              const showAvatar = idx === 0 || activeMessages[idx - 1].sender_id !== msg.sender_id;
              
              return (
                <motion.div
                  key={`${msg.id}-${idx}`}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                  className={`flex ${isClient ? 'justify-end' : 'justify-start'} gap-3 max-w-4xl mx-auto w-full`}
                >
                  {!isClient && showAvatar && (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold mt-auto shadow-sm">
                      A
                    </div>
                  )}
                  {isClient && showAvatar && (
                    <div className="w-10 h-10 opacity-0 flex-shrink-0" />
                  )}
                  
                  <div className={`flex flex-col max-w-[75%] ${isClient ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-5 py-3 text-[15px] shadow-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isClient
                          ? 'bg-gray-900 text-white rounded-2xl rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-sm'
                      }`}
                    >
                      {renderTextWithLinks(msg.content)}
                    </div>
                    <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isClient ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[11px] font-medium text-gray-400">
                        {formatTime(msg.created_at)}
                      </span>
                      {isClient && (
                        <span className={msg.is_read ? "text-blue-500" : "text-gray-300"}>
                          {msg.is_read ? <CheckCheck className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
        {sendError && (
          <div className="mb-3 p-3 text-sm bg-red-50 text-red-600 rounded-xl flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {sendError}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Écrivez votre message à l'administrateur..."
            className="flex-1 bg-slate-50 border border-gray-200 hover:border-gray-300 rounded-2xl px-5 py-3.5 text-[15px] focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 focus:outline-none resize-none overflow-hidden min-h-[52px] max-h-[150px] transition-colors placeholder:text-xs sm:placeholder:text-sm md:placeholder:text-[15px]"
            rows={1}
            disabled={sending || loading}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending || loading}
            className="p-4 bg-gray-900 text-white rounded-2xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0 shadow-sm"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};
