import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClientChatProps {
  courseId?: string;
  registrationId?: string;
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

export const ClientChat: React.FC<ClientChatProps> = ({ courseId, registrationId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

        let query = supabase
          .from('messages')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', { ascending: true });
        
        if (courseId) query = query.eq('course_id', courseId);
        if (registrationId) query = query.eq('registration_id', registrationId);

        const { data: messagesData, error } = await query;

        if (error) throw error;
        setMessages(messagesData || []);

        // Realtime Subscription
        channel = supabase
          .channel(`messages_channel_${courseId || 'general'}_${registrationId || 'general'}_${Math.random()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `client_id=eq.${user.id}`,
            },
            (payload) => {
              const newMsg = payload.new as Message;
              // Only add if it matches current context
              if (courseId && newMsg.course_id !== courseId) return;
              if (registrationId && newMsg.registration_id !== registrationId) return;
              if (!courseId && !registrationId && (newMsg.course_id || newMsg.registration_id)) return;
              
              setMessages((prev) => [...prev, newMsg]);
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
  }, [courseId, registrationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !clientId) return;

    setSending(true);
    try {
      const msgData = {
        client_id: clientId,
        sender_id: clientId,
        content: newMessage.trim(),
        course_id: courseId || null,
        registration_id: registrationId || null,
      };

      const { error } = await supabase.from('messages').insert([msgData]);
      if (error) throw error;

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSubjectBanner = () => {
    if (courseId) {
      return `💬 Sujet : ${courseTitle || 'Chargement...'}`;
    }
    if (registrationId) {
      return `💰 Sujet : Question sur votre inscription/paiement`;
    }
    return `💬 Sujet : Question générale`;
  };

  return (
    <div className="flex flex-col h-full min-h-[400px] max-h-[600px] border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
      {/* Header Banner */}
      <div className="bg-indigo-50/50 px-4 py-3 border-b border-indigo-100 flex items-center justify-center">
        <span className="text-sm font-medium text-indigo-900">{getSubjectBanner()}</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="bg-indigo-50 p-4 rounded-full">
              <MessageSquare className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Aucun message pour le moment.</p>
            <p className="text-xs text-slate-400">Posez votre question, l'administrateur vous répondra ici.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isClient = msg.sender_id === clientId;
              return (
                <motion.div
                  key={`${msg.id}-${idx}`}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isClient ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-[15px] shadow-sm leading-relaxed ${
                      isClient
                        ? 'bg-indigo-100 text-indigo-950 rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[11px] font-medium text-gray-400 mt-1.5 px-1">
                    {formatTime(msg.created_at)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-100">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
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
            className="flex-1 border-0 bg-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none overflow-hidden min-h-[44px] max-h-[120px]"
            rows={1}
            disabled={sending || loading}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending || loading}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};
