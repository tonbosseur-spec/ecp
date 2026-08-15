import React from 'react';
import { useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useLiveStore } from '../../stores/useLiveStore';
import { LiveParticipant, LiveMessage, sendLiveMessage, updateLiveSessionStatus } from '../../lib/liveService';

interface UseLiveRoomChannelProps {
  session: any;
  setSession: React.Dispatch<React.SetStateAction<any>>;
  currentUser: any;
  userProfile: any;
  isTrainer: boolean;
  handleQuitRoom: () => void;
  webrtc: {
    offeredPeersRef: React.MutableRefObject<Set<string>>;
    initiateOffer: (remoteUserId: string, channel: any, currentUserId: string) => Promise<void>;
    handleWebRTCOffer: (payload: any, channel: any, currentUserId: string) => Promise<void>;
    handleWebRTCAnswer: (payload: any, currentUserId: string) => Promise<void>;
    handleWebRTCCandidate: (payload: any, currentUserId: string) => Promise<void>;
  };
}

export function useLiveRoomChannel({
  session,
  setSession,
  currentUser,
  userProfile,
  isTrainer,
  handleQuitRoom,
  webrtc,
}: UseLiveRoomChannelProps) {
  const store = useLiveStore();
  const channelRef = useRef<any>(null);
  const meParticipantRef = useRef<LiveParticipant | null>(null);

  // Synchronize store.isHandRaised with presence
  useEffect(() => {
    broadcastStateUpdate({ hand_raised: store.isHandRaised });
    updateMyPresence({ hand_raised: store.isHandRaised });
  }, [store.isHandRaised]);

  const setupRealtimeChannel = (
    liveData: any,
    user: any,
    userName: string,
    isTrainerUser: boolean,
    avatarUrl?: string
  ) => {
    const channelName = `live-room-${liveData.room_code}`;

    // Clean up existing channel instance in Supabase JS client if present
    const existingChannels = supabase.getChannels();
    const existing = existingChannels.find((ch) => ch.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(channelName, {
      config: {
        private: true,
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    const meParticipant: LiveParticipant = {
      id: user.id,
      session_id: liveData.id,
      user_id: user.id,
      user_name: userName,
      user_avatar: avatarUrl,
      role: isTrainerUser ? 'trainer' : 'participant',
      status: liveData.is_private && !isTrainerUser ? 'waiting' : 'joined',
      is_muted: !store.isMicOn,
      is_camera_off: !store.isCamOn,
      is_screen_sharing: store.isScreenSharing,
      hand_raised: store.isHandRaised,
      joined_at: new Date().toISOString(),
    };

    meParticipantRef.current = meParticipant;

    // Presence tracking
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeList: LiveParticipant[] = [];
        const lobbyList: LiveParticipant[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1];
            if (p && p.status === 'joined') {
              activeList.push(p);
            } else if (p && p.status === 'waiting') {
              lobbyList.push(p);
            }
          }
        });

        // Ensure current user is always included
        if (!activeList.some((p) => p.user_id === user.id) && meParticipantRef.current?.status === 'joined') {
          activeList.unshift(meParticipantRef.current);
        }

        // Trainer always listed first
        activeList.sort((a, b) => (a.role === 'trainer' ? -1 : b.role === 'trainer' ? 1 : 0));

        store.setParticipants(activeList);
        if (lobbyList.length > 0 && lobbyList[0]) {
          store.addToLobby(lobbyList[0]);
        }

        // Establish WebRTC offer with peers
        activeList.forEach((p) => {
          if (
            p.user_id !== user.id &&
            user.id < p.user_id &&
            !webrtc.offeredPeersRef.current.has(p.user_id)
          ) {
            webrtc.offeredPeersRef.current.add(p.user_id);
            webrtc.initiateOffer(p.user_id, channel, user.id);
          }
        });
      })
      .on('broadcast', { event: 'chat' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'chat', payload);
        if (payload.payload) {
          store.addMessage(payload.payload as LiveMessage);
        }
      })
      .on('broadcast', { event: 'reaction' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'reaction', payload);
        if (payload.payload) {
          const { user_name, emoji } = payload.payload;
          store.showToast(`${user_name} a réagi avec ${emoji}`);
        }
      })
      .on('broadcast', { event: 'participant_update' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'participant_update', payload);
        if (payload.payload) {
          const { user_id, ...updates } = payload.payload;
          store.updateParticipant(user_id, updates);

          if (updates.hand_raised) {
            store.showToast(`${payload.payload.user_name || 'Un participant'} a levé la main ✋`);
          }
        }
      })
      .on('broadcast', { event: 'trainer_action' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'trainer_action', payload);
        const { action, target_user_id } = payload.payload;
        if (target_user_id === user.id || target_user_id === 'all') {
          if (action === 'mute') {
            if (store.isMicOn) store.toggleMic();
            store.showToast('Le formateur a coupé votre micro.');
          } else if (action === 'kick') {
            store.showToast('Vous avez été invité à quitter la réunion.');
            setTimeout(() => handleQuitRoom(), 1500);
          }
        }
        if (action === 'start_meeting') {
          setSession((prev: any) => (prev ? { ...prev, status: 'live' } : null));
          store.showToast('La réunion vient de démarrer ! 🚀');
        } else if (action === 'end_meeting') {
          setSession((prev: any) => (prev ? { ...prev, status: 'ended' } : null));
          store.showToast('La réunion s\'est terminée.');
        }
      })
      .on('broadcast', { event: 'webrtc_offer' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'webrtc_offer', payload);
        if (payload.payload) {
          webrtc.handleWebRTCOffer(payload.payload, channel, user.id);
        }
      })
      .on('broadcast', { event: 'webrtc_answer' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'webrtc_answer', payload);
        if (payload.payload) {
          webrtc.handleWebRTCAnswer(payload.payload, user.id);
        }
      })
      .on('broadcast', { event: 'webrtc_ice_candidate' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'webrtc_ice_candidate', payload);
        if (payload.payload) {
          webrtc.handleWebRTCCandidate(payload.payload, user.id);
        }
      })
      .on('broadcast', { event: 'webrtc_request_offer' }, (payload) => {
        console.log('[LiveRoom] Broadcast reçu:', 'webrtc_request_offer', payload);
        if (payload.payload && payload.payload.sender_id && payload.payload.sender_id !== user.id) {
          webrtc.initiateOffer(payload.payload.sender_id, channel, user.id);
        }
      })
      .subscribe(async (status) => {
        console.log('[LiveRoom] Statut abonnement canal:', status, 'pour', user.id);
        if (status === 'SUBSCRIBED') {
          await channel.track(meParticipant);
          channel.send({
            type: 'broadcast',
            event: 'webrtc_request_offer',
            payload: { sender_id: user.id },
          });
        } else {
          console.warn('[LiveRoom] ÉCHEC ABONNEMENT:', status);
          store.showToast('Connexion à la réunion instable, veuillez recharger la page.');
        }
      });
  };

  const updateMyPresence = (updates: Partial<LiveParticipant>) => {
    if (!meParticipantRef.current || !channelRef.current) return;
    meParticipantRef.current = { ...meParticipantRef.current, ...updates };
    channelRef.current.track(meParticipantRef.current);
  };

  const broadcastStateUpdate = (updates: Partial<LiveParticipant>) => {
    if (channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'participant_update',
        payload: {
          user_id: currentUser.id,
          user_name: userProfile?.fullName,
          ...updates,
        },
      });

      // Update presence state for late joiners
      const state = channelRef.current.presenceState();
      const myState = state[currentUser.id]?.[0];
      if (myState) {
        channelRef.current.track({
          ...myState,
          ...updates,
        });
      }
    }
  };

  const handleStartMeeting = async () => {
    if (!session || !isTrainer) return;
    await updateLiveSessionStatus(session.id, 'live');
    setSession((prev: any) => (prev ? { ...prev, status: 'live' } : null));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'trainer_action',
      payload: { action: 'start_meeting' },
    });
    store.showToast('Réunion démarrée avec succès !');
  };

  const handleEndMeeting = async () => {
    if (!session || !isTrainer) return;
    await updateLiveSessionStatus(session.id, 'ended');
    setSession((prev: any) => (prev ? { ...prev, status: 'ended' } : null));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'trainer_action',
      payload: { action: 'end_meeting' },
    });
  };

  const handleMuteAll = () => {
    if (!isTrainer) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'trainer_action',
      payload: { action: 'mute', target_user_id: 'all' },
    });
    store.showToast('Tous les micros ont été coupés.');
  };

  const handleTrainerMuteUser = (targetUserId: string) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'trainer_action',
      payload: { action: 'mute', target_user_id: targetUserId },
    });
  };

  const handleTrainerKickUser = (targetUserId: string) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'trainer_action',
      payload: { action: 'kick', target_user_id: targetUserId },
    });
  };

  const handleSendChatMessage = async (
    e: React.FormEvent,
    chatInput: string,
    setChatInput: (s: string) => void
  ) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser || !session) return;

    const newMessage: LiveMessage = {
      id: `msg-${Date.now()}`,
      session_id: session.id,
      user_id: currentUser.id,
      user_name: userProfile?.fullName || 'Utilisateur',
      user_avatar: userProfile?.avatarUrl,
      content: chatInput.trim(),
      created_at: new Date().toISOString(),
    };

    setChatInput('');
    store.addMessage(newMessage);

    // Persist to Supabase
    await sendLiveMessage(newMessage);

    // Broadcast message
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat',
      payload: newMessage,
    });
  };

  const handleSendReaction = (
    emoji: string,
    label: string,
    setShowReactions: (s: boolean) => void
  ) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        user_name: userProfile?.fullName || 'Vous',
        emoji,
        label,
      },
    });
    store.showToast(`Vous avez réagi avec ${emoji}`);
    setShowReactions(false);
  };

  const cleanupChannel = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  return {
    channelRef,
    meParticipantRef,
    setupRealtimeChannel,
    updateMyPresence,
    broadcastStateUpdate,
    handleStartMeeting,
    handleEndMeeting,
    handleMuteAll,
    handleTrainerMuteUser,
    handleTrainerKickUser,
    handleSendChatMessage,
    handleSendReaction,
    cleanupChannel,
  };
}
