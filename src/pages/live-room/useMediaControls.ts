import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useLiveStore } from '../../stores/useLiveStore';
import { uploadSessionRecording, saveSessionRecordingMetadata } from '../../lib/liveService';

interface UseMediaControlsProps {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  screenStreamRef: React.MutableRefObject<MediaStream | null>;
  peerConnectionsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  broadcastStateUpdate: (updates: any) => void;
  updateMyPresence: (updates: any) => void;
  session: any;
}

export function useMediaControls({
  localStreamRef,
  screenStreamRef,
  peerConnectionsRef,
  broadcastStateUpdate,
  updateMyPresence,
  session,
}: UseMediaControlsProps) {
  const store = useLiveStore();

  const [micVolume, setMicVolume] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const testVideoRef = useRef<HTMLVideoElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Synchronize local media tracks with store toggles
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = store.isMicOn;
      });
      broadcastStateUpdate({ is_muted: !store.isMicOn });
      updateMyPresence({ is_muted: !store.isMicOn });
    }
  }, [store.isMicOn]);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = store.isCamOn;
      });
      broadcastStateUpdate({ is_camera_off: !store.isCamOn });
      updateMyPresence({ is_camera_off: !store.isCamOn });
    }
  }, [store.isCamOn]);

  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // Normalize 0-100
        setMicVolume(Math.min(100, Math.round((average / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn('AudioAnalyser setup error:', e);
    }
  };

  const acquireMediaStream = async () => {
    try {
      setMediaError(null);
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (e2) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (e3) {
            throw e1;
          }
        }
      }

      if (stream) {
        localStreamRef.current = stream;

        // Apply current store muted / camera off state to tracks
        stream.getAudioTracks().forEach((t) => {
          t.enabled = store.isMicOn;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = store.isCamOn;
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        if (testVideoRef.current) {
          testVideoRef.current.srcObject = stream;
          testVideoRef.current.play().catch(() => {});
        }
        setupAudioAnalyser(stream);

        // Add tracks to any established WebRTC peer connections
        peerConnectionsRef.current.forEach((pc) => {
          stream!.getTracks().forEach((track) => {
            const senders = pc.getSenders();
            const exists = senders.some((s) => s.track?.id === track.id || s.track?.kind === track.kind);
            if (!exists) {
              pc.addTrack(track, stream!);
            }
          });
        });
      }

      return stream;
    } catch (err: any) {
      console.warn('Could not acquire local video/audio:', err);
      const errMsg = err?.name === 'NotAllowedError'
        ? 'Permission refusée. Veuillez autoriser la caméra et le micro dans votre navigateur.'
        : err?.name === 'NotFoundError'
        ? 'Aucune caméra ou micro n\'a été détecté sur votre appareil.'
        : 'Impossible d\'accéder aux périphériques vidéo/audio.';
      setMediaError(errMsg);
      return null;
    }
  };

  const handleToggleMic = () => {
    const nextMic = !store.isMicOn;
    store.toggleMic();
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextMic;
      });
    }
    broadcastStateUpdate({ is_muted: !nextMic });
    updateMyPresence({ is_muted: !nextMic });
  };

  const handleToggleCam = () => {
    const nextCam = !store.isCamOn;
    store.toggleCam();
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextCam;
      });
    }

    // Ne mettre à jour l'émetteur vidéo WebRTC que si le partage d'écran n'est PAS actif
    if (!store.isScreenSharing) {
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      peerConnectionsRef.current.forEach((pc) => {
        let videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (!videoSender) {
          const transceiver = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video' || t.mid !== null);
          if (transceiver) videoSender = transceiver.sender;
        }
        if (videoSender) {
          videoSender.replaceTrack(nextCam && camTrack ? camTrack : null).catch(() => {});
        }
      });
    }

    broadcastStateUpdate({ is_camera_off: !nextCam, is_screen_sharing: store.isScreenSharing });
    updateMyPresence({ is_camera_off: !nextCam, is_screen_sharing: store.isScreenSharing });
  };

  const handleToggleScreenShare = async () => {
    const currentState = useLiveStore.getState();
    if (currentState.isScreenSharing) {
      // Arrêt du partage : revenir à la caméra (si elle est allumée) sur toutes les connexions
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;

      peerConnectionsRef.current.forEach((pc) => {
        let videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (!videoSender) {
          const transceiver = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video' || t.mid !== null);
          if (transceiver) videoSender = transceiver.sender;
        }
        if (videoSender) {
          videoSender.replaceTrack(currentState.isCamOn && camTrack ? camTrack : null).catch(() => {});
        }
      });

      store.toggleScreenShare(false);
      broadcastStateUpdate({ is_screen_sharing: false, is_camera_off: !currentState.isCamOn });
      updateMyPresence({ is_screen_sharing: false, is_camera_off: !currentState.isCamOn });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        // Remplacer la piste vidéo envoyée à CHAQUE pair déjà connecté
        peerConnectionsRef.current.forEach((pc) => {
          let videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (!videoSender) {
            const transceiver = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video' || t.mid !== null);
            if (transceiver) videoSender = transceiver.sender;
          }
          if (videoSender) {
            videoSender.replaceTrack(screenTrack).catch((err) => console.warn('replaceTrack error:', err));
          } else {
            pc.addTrack(screenTrack, stream);
          }
        });

        store.toggleScreenShare(true);
        // Garder le statut réel de la caméra (is_camera_off: !currentState.isCamOn)
        broadcastStateUpdate({ is_screen_sharing: true, is_camera_off: !currentState.isCamOn });
        updateMyPresence({ is_screen_sharing: true, is_camera_off: !currentState.isCamOn });

        // Quand l'utilisateur arrête le partage depuis la barre native du navigateur
        screenTrack.onended = () => {
          const stateAtEnd = useLiveStore.getState();
          if (stateAtEnd.isScreenSharing) {
            handleToggleScreenShare();
          }
        };
      } catch (err) {
        console.warn('Screen sharing cancelled or unsupported:', err);
      }
    }
  };

  const handleStartRecording = async (remoteStreams: Record<string, MediaStream>) => {
    try {
      const tracks: MediaStreamTrack[] = [];

      // 1. Video track: Screen stream if active, else local video track
      if (store.isScreenSharing && screenStreamRef.current) {
        const vTrack = screenStreamRef.current.getVideoTracks()[0];
        if (vTrack) tracks.push(vTrack);
      } else if (localStreamRef.current && store.isCamOn) {
        const vTrack = localStreamRef.current.getVideoTracks()[0];
        if (vTrack) tracks.push(vTrack);
      }

      // If no video track found yet, prompt for screen capture
      if (tracks.length === 0) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          displayStream.getTracks().forEach((t) => tracks.push(t));
        } catch (e) {
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => tracks.push(t));
          }
        }
      }

      // 2. Audio tracks (local mic + remote audio if available)
      if (localStreamRef.current && store.isMicOn) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          if (!tracks.includes(t)) tracks.push(t);
        });
      }

      Object.values(remoteStreams).forEach((stream: any) => {
        if (stream && stream.getAudioTracks) {
          stream.getAudioTracks().forEach((t: MediaStreamTrack) => {
            if (!tracks.includes(t)) tracks.push(t);
          });
        }
      });

      if (tracks.length === 0) {
        store.showToast('Impossible de démarrer l\'enregistrement : aucune piste vidéo ou audio disponible.');
        return;
      }

      const streamToRecord = new MediaStream(tracks);

      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

      const recorderOptions = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(streamToRecord, recorderOptions);

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
        if (blob.size === 0) {
          store.showToast('Enregistrement vide.');
          setIsRecording(false);
          setRecordingDuration(0);
          return;
        }

        setIsUploadingRecording(true);
        store.showToast('⏳ Enregistrement terminé. Sauvegarde dans Supabase...');

        const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `recording-${session?.id || 'live'}-${dateStr}.webm`;
        const dur = recordingDuration;

        const publicUrl = await uploadSessionRecording(session?.id || 'live', blob, fileName);

        if (publicUrl) {
          await saveSessionRecordingMetadata(session?.id || 'live', publicUrl, dur, session?.title);
          store.showToast('✅ Vidéo sauvegardée dans le bucket Supabase avec succès !');
        } else {
          store.showToast('ℹ️ Envoi Supabase effectué / Téléchargement local de secours.');
        }

        // Automatic local download trigger for convenience
        try {
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = downloadUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
          }, 200);
        } catch (e) {
          console.warn('Local download trigger error:', e);
        }

        setIsUploadingRecording(false);
        setIsRecording(false);
        setRecordingDuration(0);
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      store.showToast('🔴 Enregistrement de la session démarré !');
    } catch (err) {
      console.error('Error starting MediaRecorder:', err);
      store.showToast('Erreur lors du démarrage de l\'enregistrement.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      store.showToast('Arrêt de l\'enregistrement...');
    }
  };

  const cleanupMedia = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  return {
    micVolume,
    mediaError,
    setMediaError,
    isRecording,
    recordingDuration,
    isUploadingRecording,
    localVideoRef,
    testVideoRef,
    acquireMediaStream,
    handleToggleMic,
    handleToggleCam,
    handleToggleScreenShare,
    handleStartRecording,
    handleStopRecording,
    cleanupMedia,
  };
}
