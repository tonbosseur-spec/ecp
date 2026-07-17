import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, Loader2, MessageSquare, ChevronLeft, Phone, User, Clock, CheckCircle2, CheckCheck, AlertCircle, Search } from 'lucide-react';
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

export const AdminChat = ({ onBack }: { onBack?: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset context when changing client
  useEffect(() => {
    setSelectedContextId(null);
  }, [selectedClientId]);

  const clientContexts = React.useMemo(() => {
    if (!selectedClientId) return [];
    const clientMsgs = messages.filter(m => m.client_id === selectedClientId);
    
    interface ChatContext {
      id: string;
      title: string;
      unread_count: number;
      last_message: Message | null;
    }
    
    const contextsMap = new Map<string, ChatContext>();
    
    // Always add general
    contextsMap.set('general', { id: 'general', title: 'Conversation Générale', unread_count: 0, last_message: null });

    clientMsgs.forEach(msg => {
      const ctxId = msg.course_id || 'general';
      if (!contextsMap.has(ctxId)) {
        contextsMap.set(ctxId, {
          id: ctxId,
          title: msg.courses?.title ? `Formation : ${msg.courses.title}` : (ctxId === 'general' ? 'Conversation Générale' : 'Autre sujet'),
          unread_count: 0,
          last_message: null
        });
      }
      const ctx = contextsMap.get(ctxId)!;
      if (!ctx.last_message || new Date(msg.created_at).getTime() > new Date(ctx.last_message.created_at).getTime()) {
        ctx.last_message = msg;
      }
      if (msg.sender_id === selectedClientId && !msg.is_read) {
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
  }, [messages, selectedClientId]);

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
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setAdminId(session.user.id);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) setAdminId(user.id);
        }

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
              // When any message changes, re-fetch all
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
    try {
      // Fetch all clients first
      const { data: clientsData, error: clientsError } = await supabase
        .from('client_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return;
      }

      const { data: messagesData, error: msgsError } = await supabase
        .from('messages')
        .select('*, courses(title)')
        .order('created_at', { ascending: false });

      if (msgsError) {
        console.error('Error fetching messages:', msgsError);
        return;
      }

      const convosMap = new Map<string, Conversation>();
      
      // Initialize conversations with all clients
      if (clientsData) {
        clientsData.forEach((client) => {
          convosMap.set(client.id, {
            client_id: client.id,
            first_name: client.first_name || 'Client',
            last_name: client.last_name || 'Inconnu',
            phone: client.phone || '',
            last_message: null as any,
            unread_count: 0
          });
        });
      }

      if (messagesData) {
        messagesData.forEach((msg: any) => {
          const cId = msg.client_id;
          
          if (convosMap.has(cId)) {
            const conv = convosMap.get(cId)!;
            
            // Set last message if not set yet (since messages are ordered by date DESC)
            if (!conv.last_message) {
              conv.last_message = msg;
            }
            
            // Count unread
            if (msg.sender_id === cId && !msg.is_read) {
              conv.unread_count += 1;
            }
          }
        });
      }

      // Sort conversations: those with messages first (by latest message date), then by name
      const sortedConvos = Array.from(convosMap.values()).sort((a, b) => {
        if (a.last_message && b.last_message) {
          return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
        }
        if (a.last_message) return -1;
        if (b.last_message) return 1;
        return a.first_name.localeCompare(b.first_name);
      });

      setConversations(sortedConvos);
      setMessages(messagesData ? [...messagesData].reverse() : []);
    } catch (err) {
      console.error('Error in fetchAllMessages:', err);
    }
  };

  // Mark messages as read when opening a conversation context
  useEffect(() => {
    if (selectedClientId && selectedContextId && adminId) {
      const unreadMessages = messages.filter(
        (m) =>
          m.client_id === selectedClientId &&
          m.sender_id !== adminId &&
          !m.is_read &&
          (selectedContextId === 'general' ? m.course_id === null : m.course_id === selectedContextId)
      );

      if (unreadMessages.length > 0) {
        const markAsRead = async () => {
          try {
            const idsToUpdate = unreadMessages.map(m => m.id);
            await supabase
              .from('messages')
              .update({ is_read: true })
              .in('id', idsToUpdate);
          } catch (err) {
            console.error('Error marking as read:', err);
          }
        };
        markAsRead();
      }
    }
  }, [selectedClientId, selectedContextId, adminId, messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedClientId) return;

    setSending(true);
    setSendError(null);
    
    try {
      let currentAdminId = adminId;
      
      // Fallback if adminId is not yet set
      if (!currentAdminId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentAdminId = user.id;
          setAdminId(user.id);
        } else {
          throw new Error("Impossible d'identifier l'administrateur. Veuillez vous reconnecter.");
        }
      }

      const msgData: any = {
        client_id: selectedClientId,
        sender_id: currentAdminId,
        content: content,
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
      let errorMsg = err.message || "Erreur lors de l'envoi du message.";
      if (err.code === '42501') {
        errorMsg = "Accès refusé par les politiques de sécurité (RLS). Assurez-vous d'utiliser l'email administrateur défini dans la base de données.";
      }
      setSendError(errorMsg);
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
  
  const activeMessages = selectedClientId && selectedContextId
    ? messages
        .filter((m) => m.client_id === selectedClientId && (selectedContextId === 'general' ? m.course_id === null : m.course_id === selectedContextId))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [];

  const activeContext = activeMessages.length > 0 ? activeMessages[activeMessages.length - 1] : null;

  const getWhatsAppUrl = (phone: string | null) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 9 && cleanPhone.startsWith('6')) {
       cleanPhone = '237' + cleanPhone;
    }
    return `https://wa.me/${cleanPhone}`;
  };

  const filteredConversations = conversations.filter(c => 
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col md:flex-row overflow-hidden">
      
      {/* Left Column: Conversations List */}
      <div className={`w-full md:w-1/3 xl:w-1/4 border-r border-gray-200 flex-col flex-1 min-h-0 bg-slate-50 ${selectedClientId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="Retour au tableau de bord"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Messages
            </h2>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent rounded-xl text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Aucun client inscrit pour le moment.
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Aucun résultat pour "{searchQuery}".
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.client_id}
                  onClick={() => setSelectedClientId(conv.client_id)}
                  className={`w-full text-left p-4 hover:bg-indigo-50/50 transition-colors flex items-center gap-3 ${selectedClientId === conv.client_id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg ${selectedClientId === conv.client_id ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                    {conv.first_name.charAt(0)}{conv.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className={`font-semibold truncate pr-2 ${selectedClientId === conv.client_id ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {conv.first_name} {conv.last_name}
                      </h3>
                      {conv.last_message && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    {conv.last_message ? (
                      <p className="text-sm text-gray-500 truncate pr-6">
                        {conv.last_message.sender_id === conv.client_id ? '' : 'Vous: '}{conv.last_message.content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Nouvelle conversation</p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
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
      <div className={`w-full md:w-2/3 xl:w-3/4 flex-col flex-1 min-h-0 bg-white ${!selectedClientId ? 'hidden md:flex' : 'flex'}`}>
        {!selectedClientId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center bg-slate-50/50">
            <div className="w-24 h-24 bg-white shadow-sm rounded-full flex items-center justify-center mb-6">
              <MessageSquare className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="font-bold text-gray-700 text-xl mb-2">Vos conversations</h3>
            <p className="text-gray-500 max-w-sm">Sélectionnez un client dans le panneau latéral pour lire les messages ou démarrer une discussion.</p>
          </div>
        ) : !selectedContextId ? (
          <div className="flex-1 flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
            <div className="flex items-center gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 max-w-4xl mx-auto w-full">
                <button 
                  onClick={() => setSelectedClientId(null)}
                  className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full md:hidden"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
                  {selectedConversation?.first_name.charAt(0)}{selectedConversation?.last_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedConversation?.first_name} {selectedConversation?.last_name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    Sélectionnez un contexte de discussion
                  </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
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
                         {ctx.last_message.sender_id === selectedClientId ? '' : 'Vous: '}{ctx.last_message.content}
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
                    <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm z-10 relative">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedContextId(null)}
                  className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
                  {selectedConversation?.first_name.charAt(0)}{selectedConversation?.last_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedConversation?.first_name} {selectedConversation?.last_name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <User className="w-3.5 h-3.5" /> Profil Client
                  </p>
                </div>
              </div>
              
              {selectedConversation?.phone && (
                <a 
                  href={getWhatsAppUrl(selectedConversation.phone)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span className="hidden sm:inline">Contacter sur WhatsApp</span>
                </a>
              )}
            </div>

            {/* Context Badge */}
            {activeContext && (activeContext.course_id || activeContext.registration_id) && (
              <div className="bg-indigo-50/80 px-6 py-2.5 border-b border-indigo-100 flex items-center shadow-sm">
                <span className="text-xs font-semibold text-indigo-700 tracking-wide uppercase flex items-center gap-2">
                  {activeContext.course_id && activeContext.courses?.title ? (
                    <>🎓 Contexte : {activeContext.courses.title}</>
                  ) : activeContext.registration_id ? (
                    <>💰 Contexte : Inscription / Paiement</>
                  ) : null}
                </span>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50 min-h-0">
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <p className="mb-2">Aucun message pour le moment.</p>
                  <p className="text-sm">Envoyez le premier message pour démarrer la conversation !</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {activeMessages.map((msg, index) => {
                    const isClient = msg.sender_id !== adminId;
                    const showAvatar = index === 0 || activeMessages[index - 1].sender_id !== msg.sender_id;
                    
                    return (
                      <motion.div
                        key={`${msg.id}-${index}`}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                        className={`flex ${isClient ? 'justify-start' : 'justify-end'} gap-3 max-w-4xl mx-auto w-full`}
                      >
                        {isClient && showAvatar && (
                          <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600 font-bold mt-auto shadow-sm">
                            {selectedConversation?.first_name.charAt(0)}
                          </div>
                        )}
                        {!isClient && showAvatar && (
                          <div className="w-10 h-10 opacity-0 flex-shrink-0" />
                        )}
                        
                        <div className={`flex flex-col max-w-[75%] ${isClient ? 'items-start' : 'items-end'}`}>
                          <div
                            className={`px-5 py-3 text-[15px] shadow-sm leading-relaxed whitespace-pre-wrap break-words ${
                              isClient
                                ? 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-sm'
                                : 'bg-gray-900 text-white rounded-2xl rounded-br-sm'
                            }`}
                          >
                            {renderTextWithLinks(msg.content)}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isClient ? 'flex-row' : 'flex-row-reverse'}`}>
                            <span className="text-[11px] font-medium text-gray-400">
                              {formatTime(msg.created_at)}
                            </span>
                            {!isClient && (
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
                  placeholder={`Écrire un message à ${selectedConversation?.first_name}...`}
                  className="flex-1 bg-slate-50 border border-gray-200 hover:border-gray-300 rounded-2xl px-5 py-3.5 text-[15px] focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 focus:outline-none resize-none overflow-hidden min-h-[52px] max-h-[150px] transition-colors"
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
          </>
        )}
      </div>
    </div>
  );
};
