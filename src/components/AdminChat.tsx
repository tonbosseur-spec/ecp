import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, Loader2, MessageSquare, ChevronLeft, Phone, User, Clock, CheckCircle2, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  client_id: string;
  sender_id: string;
  content: string;
  course_id?: string;
  registration_id?: string;
  is_read: boolean;
  created_at: string;
  courses?: { title: string };
  client_profiles?: { first_name: string; last_name: string; phone: string };
}

interface Conversation {
  client_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  last_message: Message;
  unread_count: number;
}

export const AdminChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedClientId]);

  useEffect(() => {
    let channel: any;

    const setupChat = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setAdminId(user.id);

        await fetchAllMessages();

        // Realtime Subscription for ALL messages
        channel = supabase
          .channel(`admin_messages_channel_${Math.random()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
            },
            () => {
              // When any message changes, re-fetch all to keep it simple and consistent for admin
              // In a real huge app we'd incrementally update the state
              fetchAllMessages();
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Error setting up admin chat:', err);
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
  }, []);

  const fetchAllMessages = async () => {
    const { data: messagesData, error } = await supabase
      .from('messages')
      .select('*, client_profiles(first_name, last_name, phone), courses(title)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    if (messagesData) {
      // Group by client
      const convosMap = new Map<string, Conversation>();
      
      // Since it's ordered by created_at DESC, the first time we see a client_id, it's their latest message
      messagesData.forEach((msg: any) => {
        const cId = msg.client_id;
        
        if (!convosMap.has(cId)) {
          convosMap.set(cId, {
            client_id: cId,
            first_name: msg.client_profiles?.first_name || 'Client',
            last_name: msg.client_profiles?.last_name || 'Inconnu',
            phone: msg.client_profiles?.phone || '',
            last_message: msg,
            unread_count: 0
          });
        }
        
        // Count unread (sent by client, not read)
        if (msg.sender_id === cId && !msg.is_read) {
          const conv = convosMap.get(cId)!;
          conv.unread_count += 1;
        }
      });

      setConversations(Array.from(convosMap.values()));
      setMessages(messagesData.reverse()); // Reverse to have chronological order for the chat view
    }
  };

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (selectedClientId && adminId) {
      const markAsRead = async () => {
        try {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('client_id', selectedClientId)
            .neq('sender_id', adminId)
            .eq('is_read', false);
            
          // Local state update is handled by the realtime subscription triggering fetchAllMessages
        } catch (err) {
          console.error('Error marking as read:', err);
        }
      };
      markAsRead();
    }
  }, [selectedClientId, adminId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClientId || !adminId) return;

    setSending(true);
    try {
      const clientMessages = messages.filter(m => m.client_id === selectedClientId);
      const lastMsg = clientMessages[clientMessages.length - 1]; // Already chronologically sorted ascending

      const msgData = {
        client_id: selectedClientId,
        sender_id: adminId,
        content: newMessage.trim(),
        course_id: lastMsg?.course_id || null,
        registration_id: lastMsg?.registration_id || null,
        is_read: false
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
    if (new Date().toDateString() === date.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const selectedConversation = conversations.find(c => c.client_id === selectedClientId);
  const activeMessages = messages.filter(m => m.client_id === selectedClientId);

  const activeContext = activeMessages.length > 0 ? activeMessages[activeMessages.length - 1] : null;

  const getWhatsAppUrl = (phone: string | null) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 9 && cleanPhone.startsWith('6')) {
       cleanPhone = '237' + cleanPhone;
    }
    return `https://wa.me/${cleanPhone}`;
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] md:h-[700px] border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm">
      
      {/* Left Column: Conversations List */}
      <div className={`w-full md:w-1/3 border-r border-gray-100 flex flex-col bg-slate-50/50 ${selectedClientId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            Messagerie Client
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Aucune conversation pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <button
                  key={conv.client_id}
                  onClick={() => setSelectedClientId(conv.client_id)}
                  className={`w-full text-left p-4 hover:bg-indigo-50 transition-colors flex items-start gap-3 ${selectedClientId === conv.client_id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold">
                    {conv.first_name.charAt(0)}{conv.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-gray-900 truncate pr-2">
                        {conv.first_name} {conv.last_name}
                      </h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(conv.last_message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate pr-6">
                      {conv.last_message.sender_id === conv.client_id ? '' : 'Vous: '}{conv.last_message.content}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                      <span className="text-[10px] font-bold text-white">{conv.unread_count}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Active Chat */}
      <div className={`w-full md:w-2/3 flex flex-col bg-white ${!selectedClientId ? 'hidden md:flex' : 'flex'}`}>
        {!selectedClientId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 text-slate-300" />
            </div>
            <p className="font-medium text-gray-500">Sélectionnez une conversation</p>
            <p className="text-sm mt-1">Choisissez un client dans la liste pour commencer à discuter.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm z-10 relative">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedClientId(null)}
                  className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold hidden sm:flex">
                  {selectedConversation?.first_name.charAt(0)}{selectedConversation?.last_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedConversation?.first_name} {selectedConversation?.last_name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <User className="w-3 h-3" /> Client
                  </p>
                </div>
              </div>
              
              {selectedConversation?.phone && (
                <a 
                  href={getWhatsAppUrl(selectedConversation.phone)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-full text-sm font-medium transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
            </div>

            {/* Context Badge */}
            {activeContext && (activeContext.course_id || activeContext.registration_id) && (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-2 border-b border-indigo-100 flex items-center justify-center shadow-sm">
                <span className="text-xs font-semibold text-indigo-800 tracking-wide uppercase flex items-center gap-2">
                  {activeContext.course_id && activeContext.courses?.title ? (
                    <>🎓 Formation : {activeContext.courses.title}</>
                  ) : activeContext.registration_id ? (
                    <>💰 Sujet : Inscription / Paiement</>
                  ) : null}
                </span>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              <AnimatePresence initial={false}>
                {activeMessages.map((msg, index) => {
                  const isClient = msg.sender_id === msg.client_id;
                  const showAvatar = index === 0 || activeMessages[index - 1].sender_id !== msg.sender_id;
                  
                  return (
                    <motion.div
                      key={`${msg.id}-${index}`}
                      layout
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                      className={`flex ${isClient ? 'justify-start' : 'justify-end'} gap-2`}
                    >
                      {isClient && showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-xs mt-auto">
                          {selectedConversation?.first_name.charAt(0)}
                        </div>
                      )}
                      {!isClient && showAvatar && (
                        <div className="w-8 h-8 opacity-0 flex-shrink-0" /> /* Spacer if no avatar needed this side */
                      )}
                      
                      <div className={`flex flex-col max-w-[80%] ${isClient ? 'items-start' : 'items-end'}`}>
                        <div
                          className={`px-4 py-2.5 text-[15px] shadow-sm leading-relaxed ${
                            isClient
                              ? 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-sm'
                              : 'bg-indigo-600 text-white rounded-2xl rounded-br-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 px-1 ${isClient ? 'flex-row' : 'flex-row-reverse'}`}>
                          <span className="text-[10px] font-medium text-gray-400">
                            {formatTime(msg.created_at)}
                          </span>
                          {!isClient && (
                            <span className="text-indigo-400">
                              {msg.is_read ? <CheckCheck className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3 opacity-50" />}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-gray-200">
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
                  placeholder={`Répondre à ${selectedConversation?.first_name}...`}
                  className="flex-1 border border-gray-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none resize-none overflow-hidden min-h-[48px] max-h-[150px] shadow-sm"
                  rows={1}
                  disabled={sending || loading}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending || loading}
                  className="p-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm flex-shrink-0"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
