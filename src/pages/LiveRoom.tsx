import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  Monitor, 
  Hand, 
  MessageSquare, 
  Users, 
  PhoneOff, 
  Shield, 
  Copy, 
  Check, 
  Clock, 
  Send, 
  X, 
  VolumeX, 
  UserX, 
  UserCheck, 
  Play, 
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronRight,
  Smile,
  Disc
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import VerifiedBadge from '../components/VerifiedBadge';
import { 
  fetchLiveSessionByCode, 
  updateLiveSessionStatus, 
  recordPresenceEntry, 
  recordPresenceExit,
  fetchLiveMessages,
  sendLiveMessage,
  uploadSessionRecording,
  saveSessionRecordingMetadata,
  LiveSession, 
  LiveParticipant, 
  LiveMessage 
} from '../lib/liveService';
import { useLiveStore } from '../stores/useLiveStore';
import { useWebRTCConnection } from './live-room/useWebRTCConnection';
import { useLiveRoomChannel } from './live-room/useLiveRoomChannel';
import { useMediaControls } from './live-room/useMediaControls';


const VideoPlayer = ({ stream, isLocal, isScreenSharing, muted, ...props }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTrack = stream?.getVideoTracks()[0];
  const videoTrackId = videoTrack?.id;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream && videoTrack) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play().catch((err) => console.warn('Video play error:', err));

      const handlePlay = () => {
        if (video.paused) {
          video.play().catch(() => {});
        }
      };

      video.addEventListener('loadedmetadata', handlePlay);
      video.addEventListener('resize', handlePlay);
      video.addEventListener('canplay', handlePlay);

      videoTrack.addEventListener('unmute', handlePlay);

      return () => {
        video.removeEventListener('loadedmetadata', handlePlay);
        video.removeEventListener('resize', handlePlay);
        video.removeEventListener('canplay', handlePlay);
        videoTrack.removeEventListener('unmute', handlePlay);
      };
    } else {
      video.srcObject = null;
    }
  }, [stream, videoTrackId, videoTrack]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full ${
        isScreenSharing ? 'object-contain bg-slate-950' : 'object-cover'
      } ${!isScreenSharing && isLocal ? 'transform -scale-x-100' : ''}`}
      {...props}
    />
  );
};

const AudioPlayer = ({ stream, onNeedsUnlock }: any) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    if (audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => {
          if (onNeedsUnlock) onNeedsUnlock();
        });
      }
    }
  }, [stream, onNeedsUnlock]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

export default function LiveRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();


  const store = useLiveStore();
  
  const [session, setSession] = useState<LiveSession | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showReactions, setShowReactions] = useState(false);

  const reactions = [
    { emoji: '👏', label: 'Applaudir' },
    { emoji: '🎉', label: 'Félicitations' },
    { emoji: '👍', label: 'Pouce en l\'air' },
    { emoji: '❤️', label: 'Cœur' },
    { emoji: '😂', label: 'Rire' },
  ];

  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [showDeviceTestModal, setShowDeviceTestModal] = useState(false);

  // Local media stream references
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const webrtc = useWebRTCConnection(localStreamRef, screenStreamRef);

  const handleQuitRoom = () => {
    cleanupRoom();
    navigate('/live');
  };

  const channel = useLiveRoomChannel({
    session,
    setSession,
    currentUser,
    userProfile,
    isTrainer,
    handleQuitRoom,
    webrtc
  });

  const media = useMediaControls({
    localStreamRef,
    screenStreamRef,
    peerConnectionsRef: webrtc.peerConnectionsRef,
    broadcastStateUpdate: channel.broadcastStateUpdate,
    updateMyPresence: channel.updateMyPresence,
    session
  });

  useEffect(() => {
    initRoom();

    return () => {
      cleanupRoom();
    };
  }, [roomCode]);

  // Timer tick for chronomètre
  useEffect(() => {
    let interval: any;
    if (session?.status === 'live') {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session?.status]);

  const initRoom = async () => {
    if (!roomCode) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Check user session
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        // Save target redirect URL and send to login
        navigate(`/client/login?redirect=live/${roomCode}`);
        return;
      }

      const user = authSession.user;
      setCurrentUser(user);

      // Check if admin / trainer
      const isAdminUser = user.email === 'pmbom@ecp.cm';

      // 2. Fetch Live Session Details
      const liveData = await fetchLiveSessionByCode(roomCode);
      if (!liveData) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setSession(liveData);
      store.setSession(liveData);

      // Check trainer ownership
      const trainerCheck = isAdminUser || liveData.trainer_id === user.email;
      setIsTrainer(trainerCheck);

      // Fetch client profile for display name
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      const fullName = profile?.first_name 
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : user.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
        : user.email?.split('@')[0] || 'Apprenant';

      setUserProfile({ fullName, avatarUrl: profile?.avatar_url });

      // 3. Authorization Check
      let authorized = false;
      if (trainerCheck) {
        authorized = true;
      } else if (liveData.course_id) {
        // Check if user has an approved registration for this course
        const { data: reg } = await supabase
          .from('registrations')
          .select('id, payment_status')
          .eq('client_id', user.id)
          .eq('course_id', liveData.course_id)
          .single();

        if (reg && reg.payment_status === 'approved') {
          authorized = true;
        } else {
          authorized = false;
        }
      } else {
        authorized = true;
      }

      // Check max capacity for non-trainers
      const maxPlaces = liveData.max_participants || 6;
      if (!trainerCheck && (liveData.participant_count || 0) >= maxPlaces) {
        authorized = false;
      }

      setIsAuthorized(authorized);

      if (!authorized) {
        setLoading(false);
        return;
      }

      // Fetch existing stored chat messages
      const existingMsgs = await fetchLiveMessages(liveData.id);
      if (existingMsgs && existingMsgs.length > 0) {
        store.setMessages(existingMsgs);
      }

      // 4. Request Camera & Mic Permissions
      await media.acquireMediaStream();

      // 5. Record Presence Entry
      await recordPresenceEntry(liveData.id, user.id, fullName);

      // 6. Connect Supabase Realtime Signaling & Presence
      channel.setupRealtimeChannel(liveData, user, fullName, trainerCheck, profile?.avatar_url);

      store.setConnectionState('connected');
    } catch (err) {
      console.error('Error initializing live room:', err);
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  const cleanupRoom = async () => {
    media.cleanupMedia();
    webrtc.cleanupWebRTC();
    channel.cleanupChannel();
    
    if (session && currentUser) {
      await recordPresenceExit(session.id, currentUser.id);
    }
    store.resetRoom();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatChronometer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // LOADING STATE
  // ----------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-base font-bold text-slate-300">Connexion à la session Live en cours...</p>
        <p className="text-xs text-slate-500 mt-1">Vérification de la caméra, du micro et des droits d'accès</p>
      </div>
    );
  }

  // ----------------------------------------------------
  // UNAUTHORIZED STATE
  // ----------------------------------------------------
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Accès Non Autorisé</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Vous n'êtes pas inscrit à cette session de cours ou vous ne disposez pas des autorisations nécessaires pour y accéder.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={() => navigate('/live')}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/30"
            >
              Retourner aux sessions Live
            </button>
            <button
              onClick={() => navigate('/client/hub')}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-all"
            >
              Aller à mon Espace Client
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ENDED STATE
  // ----------------------------------------------------
  if (session?.status === 'ended') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto">
            <Check className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Réunion Terminée</h2>
            <p className="text-sm text-slate-400 mt-2">
              Merci pour votre participation ! Votre présence à cette séance a été enregistrée avec succès.
            </p>
          </div>
          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Durée totale :</span>
              <span className="font-bold text-white">{formatChronometer(elapsedSeconds)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Formateur :</span>
              <span className="font-bold text-white">{session.trainer_name}</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/live')}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/30"
          >
            Retourner au menu Live
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN LIVE ROOM UI
  // ----------------------------------------------------
  const participants = store.participants;
  const screenSharingParticipant = participants.find((p) => p.is_screen_sharing);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans overflow-hidden">
      {/* Toast Alert Banner */}
      {store.toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-indigo-600/90 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md border border-indigo-400/30 animate-bounce flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{store.toastMessage}</span>
        </div>
      )}

      {/* TOP BAR */}
      <header className="h-16 bg-slate-900/90 border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-sm shadow-md shadow-indigo-600/40">
            E
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
              {session?.title || 'Session Live'}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-medium">{session?.course_title || 'Formation'}</span>
              <span>•</span>
              <span className="text-indigo-400 font-semibold">{session?.trainer_name}</span>
            </div>
          </div>
        </div>

        {/* Center Indicators */}
        <div className="hidden md:flex items-center gap-4 bg-slate-800/70 border border-slate-700/60 px-4 py-1.5 rounded-full">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                session?.status === 'live' ? 'bg-red-500 animate-ping' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {session?.status === 'live' ? 'En Direct' : 'En attente du début'}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{formatChronometer(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowDeviceTestModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 text-xs font-bold rounded-xl transition-all shadow-sm"
            title="Tester la caméra et le microphone"
          >
            <VideoIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Tester Caméra & Micro</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            title="Copier le lien de la réunion"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copié !' : 'Inviter'}</span>
          </button>

          <button
            onClick={handleQuitRoom}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>
      </header>

      {/* CENTER WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIDEO DISPLAY STAGE */}
        <div className="flex-1 p-3 sm:p-6 flex flex-col justify-center items-center bg-slate-950 overflow-y-auto">
          {session?.status === 'scheduled' && (
            <div className="mb-4 bg-indigo-950/60 border border-indigo-800/50 p-3 sm:p-4 rounded-2xl max-w-lg w-full text-center space-y-2">
              <p className="text-xs text-indigo-200 font-bold">
                ⌛ La réunion n'a pas encore démarré par le formateur.
              </p>
              {isTrainer && (
                <button
                  onClick={channel.handleStartMeeting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-md transition-all"
                >
                  🚀 Démarrer la réunion maintenant
                </button>
              )}
            </div>
          )}

          {/* Presentation View */}
          {screenSharingParticipant && (
            <div className="flex-1 w-full max-w-6xl mb-4 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-xl shrink-0 min-h-[300px]">
              <VideoPlayer
                stream={
                  screenSharingParticipant.user_id === currentUser?.id
                    ? screenStreamRef.current
                    : webrtc.remoteStreams[screenSharingParticipant.user_id]
                }
                isLocal={screenSharingParticipant.user_id === currentUser?.id}
                isScreenSharing={true}
                muted={true}
              />
              <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/60 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">
                  Écran partagé par {screenSharingParticipant.user_name} {screenSharingParticipant.user_id === currentUser?.id ? "(Vous)" : ""}
                </span>
              </div>
            </div>
          )}

          {/* Video Grid layout based on participant count */}
          <div
            className={
              screenSharingParticipant 
              ? "flex gap-3 overflow-x-auto pb-2 shrink-0 h-[160px] sm:h-[220px] w-full max-w-6xl snap-x custom-scrollbar"
              : `w-full max-w-5xl grid gap-3 sm:gap-4 transition-all ${
              participants.length <= 1
                ? 'grid-cols-1 max-w-2xl'
                : participants.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {/* Local Video Tile (Current User) */}
            <div
              className={`relative bg-slate-900 border-2 rounded-3xl overflow-hidden flex flex-col items-center justify-center ${screenSharingParticipant ? 'min-w-[160px] sm:min-w-[240px] h-full shrink-0 snap-center' : 'min-h-[180px] sm:min-h-[240px]'} shadow-xl ${
                store.activeSpeakerId === currentUser?.id
                  ? 'border-emerald-400 ring-4 ring-emerald-400/20'
                  : 'border-slate-800'
              }`}
            >
              {store.isCamOn && !store.isScreenSharing ? (
                <VideoPlayer
                  stream={localStreamRef.current}
                  isLocal={true}
                  isScreenSharing={false}
                  muted={true}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 space-y-3">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                    {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    {store.isScreenSharing ? 'En train de présenter' : 'Caméra désactivée'}
                  </p>
                </div>
              )}

              {/* Local User Badge overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-700/60 flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">
                    Vous ({userProfile?.fullName})
                  </span>
                  {isTrainer && (
                    <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                      Formateur
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {store.isHandRaised && (
                    <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold shadow-lg animate-bounce">
                      ✋
                    </span>
                  )}
                  {store.isMicOn && (
                    <div className="hidden sm:flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/60" title="Volume du micro">
                      <div className="w-1.5 rounded-full bg-emerald-400 transition-all duration-75" style={{ height: `${Math.max(4, Math.min(18, media.micVolume * 0.2))}px` }} />
                      <div className="w-1.5 rounded-full bg-emerald-400 transition-all duration-75" style={{ height: `${Math.max(4, Math.min(22, media.micVolume * 0.3))}px` }} />
                      <div className="w-1.5 rounded-full bg-emerald-400 transition-all duration-75" style={{ height: `${Math.max(4, Math.min(18, media.micVolume * 0.2))}px` }} />
                    </div>
                  )}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs backdrop-blur-md ${
                      store.isMicOn ? 'bg-slate-900/80 text-emerald-400' : 'bg-red-600 text-white'
                    }`}
                  >
                    {store.isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Remote Participants Tiles */}
            {participants
              .filter((p) => p.user_id !== currentUser?.id)
              .map((p) => (
                <div
                  key={p.user_id}
                  className={`relative bg-slate-900 border-2 rounded-3xl overflow-hidden flex flex-col items-center justify-center ${screenSharingParticipant ? 'min-w-[160px] sm:min-w-[240px] h-full shrink-0 snap-center' : 'min-h-[180px] sm:min-h-[240px]'} shadow-xl ${
                    store.activeSpeakerId === p.user_id
                      ? 'border-emerald-400 ring-4 ring-emerald-400/20'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Remote Audio Stream element */}
                  {webrtc.remoteStreams[p.user_id] && (
                    <AudioPlayer
                      stream={webrtc.remoteStreams[p.user_id]}
                      onNeedsUnlock={() => setNeedsAudioUnlock(true)}
                    />
                  )}

                  {!p.is_camera_off && !p.is_screen_sharing && webrtc.remoteStreams[p.user_id] ? (
                    <VideoPlayer
                      stream={webrtc.remoteStreams[p.user_id]}
                      isLocal={false}
                      isScreenSharing={false}
                      muted={true}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 space-y-3">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                        {p.user_name ? p.user_name.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <p className="text-xs font-bold text-slate-400">
                        {p.is_screen_sharing ? 'En train de présenter' : p.is_camera_off ? 'Caméra désactivée' : 'Connexion vidéo...'}
                      </p>
                    </div>
                  )}

                  {/* Participant Name Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-700/60 flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate max-w-[120px] flex items-center gap-1">
                        <span>{p.user_name}</span>
                        <VerifiedBadge size="xs" />
                      </span>
                      {p.role === 'trainer' && (
                        <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                          Formateur
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.hand_raised && (
                        <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold shadow-lg animate-bounce">
                          ✋
                        </span>
                      )}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs backdrop-blur-md ${
                          !p.is_muted ? 'bg-slate-900/80 text-emerald-400' : 'bg-red-600 text-white'
                        }`}
                      >
                        {!p.is_muted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* SIDE DRAWER (Participants / Chat) */}
        {store.activeTab && (
          <aside className="w-full sm:w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-30 absolute sm:relative inset-y-0 right-0 shadow-2xl">
            {/* Drawer Header */}
            <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => store.setActiveTab('participants')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    store.activeTab === 'participants'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Participants ({participants.length})
                </button>
                <button
                  onClick={() => store.setActiveTab('chat')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all relative ${
                    store.activeTab === 'chat'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Chat
                  {store.unreadChatCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 bg-red-500 text-white text-[9px] font-black rounded-full">
                      {store.unreadChatCount}
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={() => store.setActiveTab(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TAB 1: PARTICIPANTS LIST */}
            {store.activeTab === 'participants' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Trainer Actions */}
                {isTrainer && (
                  <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl space-y-2">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                      Contrôles du Formateur
                    </span>
                    <button
                      onClick={channel.handleMuteAll}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      <VolumeX className="w-4 h-4 text-amber-400" />
                      <span>Couper tous les micros</span>
                    </button>
                  </div>
                )}

                {/* Active Participants List */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Dans la réunion ({participants.length})
                  </h4>
                  {participants.map((p) => (
                    <div
                      key={p.user_id}
                      className="p-3 bg-slate-800/40 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {p.user_name ? p.user_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                            <span>{p.user_name} {p.user_id === currentUser?.id ? '(Vous)' : ''}</span>
                            <VerifiedBadge size="xs" />
                          </p>
                          <span className="text-[10px] text-slate-400 block">
                            {p.role === 'trainer' ? 'Formateur' : 'Apprenant'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.hand_raised && <span title="Main levée">✋</span>}
                        {p.is_muted ? (
                          <MicOff className="w-4 h-4 text-red-400" />
                        ) : (
                          <Mic className="w-4 h-4 text-emerald-400" />
                        )}

                        {/* Trainer moderations */}
                        {isTrainer && p.user_id !== currentUser?.id && (
                          <div className="flex items-center gap-1 ml-1 border-l border-slate-700 pl-2">
                            <button
                              onClick={() => channel.handleTrainerMuteUser(p.user_id)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-amber-400"
                              title="Couper le micro"
                            >
                              <VolumeX className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => channel.handleTrainerKickUser(p.user_id)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                              title="Exclure de la réunion"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: CHAT */}
            {store.activeTab === 'chat' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                {/* Messages list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {store.messages.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-500">
                      Aucun message. Envoyez le premier message !
                    </div>
                  ) : (
                    store.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          m.user_id === currentUser?.id ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                          <span className="font-bold flex items-center gap-1">
                            <span>{m.user_name}</span>
                            <VerifiedBadge size="xs" />
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(m.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                            m.user_id === currentUser?.id
                              ? 'bg-indigo-600 text-white rounded-br-xs'
                              : 'bg-slate-800 text-slate-200 rounded-bl-xs'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input form */}
                <form onSubmit={(e) => channel.handleSendChatMessage(e, chatInput, setChatInput)} className="p-3 border-t border-slate-800 bg-slate-900">
                  <div className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Écrire un message..."
                      className="w-full pl-4 pr-10 py-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-400 hover:text-white disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* BOTTOM CONTROL TOOLBAR */}
      <footer className="h-20 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between shrink-0">
        {/* Left Trainer status */}
        <div className="flex items-center gap-2">
          {isTrainer && (
            <div className="flex items-center gap-2">
              {session?.status !== 'live' ? (
                <button
                  onClick={channel.handleStartMeeting}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span className="hidden md:inline">Démarrer</span>
                </button>
              ) : (
                <button
                  onClick={channel.handleEndMeeting}
                  className="flex items-center gap-2 px-3 py-2 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-bold rounded-xl transition-all"
                >
                  <span className="hidden md:inline">Terminer</span>
                </button>
              )}

              {/* Record session button for trainer */}
              {media.isRecording ? (
                <button
                  onClick={media.handleStopRecording}
                  disabled={media.isUploadingRecording}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-600/30 transition-all animate-pulse"
                  title="Arrêter l'enregistrement de la session"
                >
                  <Disc className="w-4 h-4 animate-spin text-white" />
                  <span>
                    {media.isUploadingRecording
                      ? 'Envoi...'
                      : `REC (${Math.floor(media.recordingDuration / 60)}:${(media.recordingDuration % 60)
                          .toString()
                          .padStart(2, '0')})`}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => media.handleStartRecording(webrtc.remoteStreams)}
                  disabled={media.isUploadingRecording}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700 hover:border-red-500/50 text-xs font-bold rounded-xl transition-all shadow-sm"
                  title="Enregistrer la session avec MediaRecorder"
                >
                  <Disc className="w-4 h-4 text-red-500 fill-red-500/20" />
                  <span className="hidden sm:inline">Enregistrer la session</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center Main Controls */}
        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          {/* Mic */}
          <button
            onClick={media.handleToggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${
              store.isMicOn
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-red-600 text-white shadow-red-600/30'
            }`}
            title={store.isMicOn ? 'Désactiver le micro' : 'Activer le micro'}
          >
            {store.isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Cam */}
          <button
            onClick={media.handleToggleCam}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${
              store.isCamOn
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-red-600 text-white shadow-red-600/30'
            }`}
            title={store.isCamOn ? 'Désactiver la caméra' : 'Activer la caméra'}
          >
            {store.isCamOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={media.handleToggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${
              store.isScreenSharing
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
            title="Partager l'écran"
          >
            <Monitor className="w-5 h-5" />
          </button>

          {/* Raise Hand */}
          <button
            onClick={store.toggleHandRaise}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${
              store.isHandRaised
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
            title="Lever la main"
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Reactions */}
          <div className="relative">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-md"
              title="Réagir"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showReactions && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-xl p-2 flex gap-2 shadow-2xl z-50">
                {reactions.map((r) => (
                  <button
                    key={r.emoji}
                    onClick={() => channel.handleSendReaction(r.emoji, r.label, setShowReactions)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-700 text-xl transition-all"
                    title={r.label}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Drawer Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => store.setActiveTab(store.activeTab === 'chat' ? null : 'chat')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all relative ${
              store.activeTab === 'chat'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title="Ouvrir le chat"
          >
            <MessageSquare className="w-5 h-5" />
            {store.unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900">
                {store.unreadChatCount}
              </span>
            )}
          </button>

          <button
            onClick={() => store.setActiveTab(store.activeTab === 'participants' ? null : 'participants')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              store.activeTab === 'participants'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title="Liste des participants"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* Audio Autoplay Unlock Alert */}
      {needsAudioUnlock && (
        <button
          onClick={() => {
            document.querySelectorAll('audio, video').forEach((el) => {
              (el as HTMLMediaElement).play().catch(() => {});
            });
            setNeedsAudioUnlock(false);
          }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl animate-bounce"
        >
          🔊 Cliquez pour activer le son
        </button>
      )}

      {/* DEVICE TEST MODAL */}
      {showDeviceTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowDeviceTestModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
                <VideoIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Test de Caméra & Microphone</h3>
                <p className="text-xs text-slate-400">Vérifiez vos périphériques en direct</p>
              </div>
            </div>

            {/* Error Banner if restricted or failed */}
            {media.mediaError && (
              <div className="bg-red-950/60 border border-red-800/80 p-4 rounded-2xl text-xs text-red-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Problème de périphérique détecté</span>
                </div>
                <p>{media.mediaError}</p>
                <div className="pt-2 border-t border-red-800/50 text-[11px] text-red-300">
                  💡 <strong>Astuce :</strong> Si vous utilisez l'aperçu intégré dans l'éditeur, veuillez ouvrir la page dans un <strong>nouvel onglet</strong> pour autoriser le matériel.
                </div>
              </div>
            )}

            {/* Camera Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Aperçu de la Caméra</span>
                <span className={store.isCamOn ? 'text-emerald-400' : 'text-slate-500'}>
                  {store.isCamOn ? '• Active' : '• Désactivée'}
                </span>
              </div>
              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden h-48 flex items-center justify-center">
                {store.isCamOn ? (
                  <VideoPlayer
                    stream={localStreamRef.current}
                    isLocal={true}
                    isScreenSharing={false}
                    muted={true}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                    <VideoOff className="w-8 h-8" />
                    <span className="text-xs">Caméra désactivée</span>
                  </div>
                )}
              </div>
            </div>

            {/* Microphone Test Visualizer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Niveau de Voix (Microphone)</span>
                <span className={store.isMicOn ? 'text-emerald-400 font-mono' : 'text-slate-500'}>
                  {store.isMicOn ? `${media.micVolume}%` : '• Muet'}
                </span>
              </div>

              {/* Volume Bar */}
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl h-4 p-1 flex items-center overflow-hidden">
                <div
                  className={`h-full rounded-lg transition-all duration-75 ${
                    media.micVolume > 70
                      ? 'bg-red-500'
                      : media.micVolume > 30
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: store.isMicOn ? `${Math.max(2, media.micVolume)}%` : '0%' }}
                />
              </div>

              <p className="text-[11px] text-slate-400">
                {!store.isMicOn ? (
                  <span className="text-amber-400">⚠️ Votre micro est actuellement coupé. Activez-le ci-dessous pour le tester.</span>
                ) : media.micVolume > 5 ? (
                  <span className="text-emerald-400 font-bold">✅ Voix détectée ! Votre microphone fonctionne correctement.</span>
                ) : (
                  'Parlez fort dans votre micro : la barre ci-dessus s\'animera pour confirmer la détection sonore.'
                )}
              </p>
            </div>

            {/* Controls & Quick Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => media.acquireMediaStream()}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tester à nouveau les accès</span>
              </button>

              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                <Monitor className="w-4 h-4" />
                <span>Nouvel onglet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
