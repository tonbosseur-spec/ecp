import { create } from 'zustand';
import { LiveSession, LiveParticipant, LiveMessage } from '../lib/liveService';

interface LiveStoreState {
  // Session info
  currentSession: LiveSession | null;
  roomCode: string | null;
  connectionState: 'idle' | 'connecting' | 'connected' | 'ended' | 'denied';
  
  // Local user state
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  activeSpeakerId: string | null;

  // Remote state
  participants: LiveParticipant[];
  waitingLobby: LiveParticipant[];
  messages: LiveMessage[];
  unreadChatCount: number;

  // UI state
  activeTab: 'participants' | 'chat' | null;
  toastMessage: string | null;

  // Actions
  setSession: (session: LiveSession | null) => void;
  setConnectionState: (state: LiveStoreState['connectionState']) => void;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleScreenShare: (val?: boolean) => void;
  toggleHandRaise: () => void;
  setActiveSpeaker: (userId: string | null) => void;

  setParticipants: (participants: LiveParticipant[]) => void;
  addParticipant: (participant: LiveParticipant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, update: Partial<LiveParticipant>) => void;

  addToLobby: (participant: LiveParticipant) => void;
  removeFromLobby: (userId: string) => void;

  setMessages: (messages: LiveMessage[]) => void;
  addMessage: (message: LiveMessage) => void;

  setActiveTab: (tab: 'participants' | 'chat' | null) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  resetRoom: () => void;
}

export const useLiveStore = create<LiveStoreState>((set, get) => ({
  currentSession: null,
  roomCode: null,
  connectionState: 'idle',

  isMicOn: true,
  isCamOn: true,
  isScreenSharing: false,
  isHandRaised: false,
  activeSpeakerId: null,

  participants: [],
  waitingLobby: [],
  messages: [],
  unreadChatCount: 0,

  activeTab: null,
  toastMessage: null,

  setSession: (session) => set({ currentSession: session, roomCode: session?.room_code || null }),
  setConnectionState: (state) => set({ connectionState: state }),

  toggleMic: () => set((s) => ({ isMicOn: !s.isMicOn })),
  toggleCam: () => set((s) => ({ isCamOn: !s.isCamOn })),
  toggleScreenShare: (val) => set((s) => ({ isScreenSharing: val !== undefined ? val : !s.isScreenSharing })),
  toggleHandRaise: () => set((s) => {
    const nextHand = !s.isHandRaised;
    if (nextHand) {
      get().showToast('Vous avez levé la main ✋');
    }
    return { isHandRaised: nextHand };
  }),

  setActiveSpeaker: (userId) => set({ activeSpeakerId: userId }),

  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) => set((s) => {
    if (s.participants.some(p => p.user_id === participant.user_id)) {
      return {
        participants: s.participants.map(p => p.user_id === participant.user_id ? participant : p)
      };
    }
    return { participants: [...s.participants, participant] };
  }),
  removeParticipant: (userId) => set((s) => ({
    participants: s.participants.filter(p => p.user_id !== userId)
  })),
  updateParticipant: (userId, update) => set((s) => ({
    participants: s.participants.map(p => p.user_id === userId ? { ...p, ...update } : p)
  })),

  addToLobby: (participant) => set((s) => {
    if (!participant || !participant.user_id) return s;
    return {
      waitingLobby: s.waitingLobby.some(p => p && p.user_id === participant.user_id)
        ? s.waitingLobby
        : [...s.waitingLobby, participant]
    };
  }),
  removeFromLobby: (userId) => set((s) => ({
    waitingLobby: s.waitingLobby.filter(p => p.user_id !== userId)
  })),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({
    messages: [...s.messages, message],
    unreadChatCount: s.activeTab === 'chat' ? 0 : s.unreadChatCount + 1
  })),

  setActiveTab: (tab) => set({ activeTab: tab, unreadChatCount: tab === 'chat' ? 0 : get().unreadChatCount }),
  showToast: (msg) => set({ toastMessage: msg }),
  clearToast: () => set({ toastMessage: null }),

  resetRoom: () => set({
    currentSession: null,
    roomCode: null,
    connectionState: 'idle',
    isMicOn: true,
    isCamOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    activeSpeakerId: null,
    participants: [],
    waitingLobby: [],
    messages: [],
    unreadChatCount: 0,
    activeTab: null,
    toastMessage: null,
  })
}));
