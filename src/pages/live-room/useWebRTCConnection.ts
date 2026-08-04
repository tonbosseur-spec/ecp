import React from 'react';
import { useState, useRef } from 'react';
import { useLiveStore } from '../../stores/useLiveStore';

export function useWebRTCConnection(
  localStreamRef: React.MutableRefObject<MediaStream | null>,
  screenStreamRef: React.MutableRefObject<MediaStream | null>
) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const offeredPeersRef = useRef<Set<string>>(new Set());

  // TODO: replace with production TURN credentials
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const createPeerConnection = (remoteUserId: string, channel: any, currentUserId: string) => {
    if (peerConnectionsRef.current.has(remoteUserId)) {
      return peerConnectionsRef.current.get(remoteUserId)!;
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(remoteUserId, pc);

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state avec ${remoteUserId}:`, pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state avec ${remoteUserId}:`, pc.connectionState);
    };

    const isSharing = useLiveStore.getState().isScreenSharing;
    const screenTrack = isSharing && screenStreamRef.current ? screenStreamRef.current.getVideoTracks()[0] : null;

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((audioTrack) => {
        pc.addTrack(audioTrack, localStreamRef.current!);
      });

      if (screenTrack) {
        pc.addTrack(screenTrack, screenStreamRef.current!);
      } else {
        localStreamRef.current.getVideoTracks().forEach((videoTrack) => {
          pc.addTrack(videoTrack, localStreamRef.current!);
        });
      }
    } else if (screenTrack) {
      pc.addTrack(screenTrack, screenStreamRef.current!);
    } else {
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const existingStream = prev[remoteUserId];
        let streamToUse: MediaStream;
        if (existingStream) {
          if (!existingStream.getTracks().some((t) => t.id === event.track.id)) {
            existingStream.addTrack(event.track);
          }
          streamToUse = new MediaStream(existingStream.getTracks());
        } else if (event.streams && event.streams[0]) {
          streamToUse = new MediaStream(event.streams[0].getTracks());
        } else {
          streamToUse = new MediaStream([event.track]);
        }
        return {
          ...prev,
          [remoteUserId]: streamToUse,
        };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc_ice_candidate',
          payload: {
            sender_id: currentUserId,
            target_id: remoteUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    return pc;
  };

  const initiateOffer = async (remoteUserId: string, channel: any, currentUserId: string) => {
    try {
      const pc = createPeerConnection(remoteUserId, channel, currentUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channel.send({
        type: 'broadcast',
        event: 'webrtc_offer',
        payload: {
          sender_id: currentUserId,
          target_id: remoteUserId,
          sdp: offer,
        },
      });
    } catch (err) {
      console.error('Error initiating WebRTC offer to', remoteUserId, err);
    }
  };

  const handleWebRTCOffer = async (
    payload: { sender_id: string; target_id: string; sdp: RTCSessionDescriptionInit },
    channel: any,
    currentUserId: string
  ) => {
    if (payload.target_id !== currentUserId) return;
    const senderId = payload.sender_id;
    try {
      const pc = createPeerConnection(senderId, channel, currentUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

      const queue = iceCandidateQueuesRef.current.get(senderId) || [];
      for (const cand of queue) {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      }
      iceCandidateQueuesRef.current.delete(senderId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channel.send({
        type: 'broadcast',
        event: 'webrtc_answer',
        payload: {
          sender_id: currentUserId,
          target_id: senderId,
          sdp: answer,
        },
      });
    } catch (err) {
      console.error('Error handling WebRTC offer from', senderId, err);
    }
  };

  const handleWebRTCAnswer = async (
    payload: { sender_id: string; target_id: string; sdp: RTCSessionDescriptionInit },
    currentUserId: string
  ) => {
    if (payload.target_id !== currentUserId) return;
    const senderId = payload.sender_id;
    const pc = peerConnectionsRef.current.get(senderId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const queue = iceCandidateQueuesRef.current.get(senderId) || [];
        for (const cand of queue) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
        iceCandidateQueuesRef.current.delete(senderId);
      } catch (err) {
        console.error('Error setting remote answer from', senderId, err);
      }
    }
  };

  const handleWebRTCCandidate = async (
    payload: { sender_id: string; target_id: string; candidate: RTCIceCandidateInit },
    currentUserId: string
  ) => {
    if (payload.target_id !== currentUserId) return;
    const senderId = payload.sender_id;
    const pc = peerConnectionsRef.current.get(senderId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate from', senderId, err);
      }
    } else {
      const existing = iceCandidateQueuesRef.current.get(senderId) || [];
      existing.push(payload.candidate);
      iceCandidateQueuesRef.current.set(senderId, existing);
    }
  };

  const cleanupWebRTC = () => {
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    peerConnectionsRef.current.clear();
    offeredPeersRef.current.clear();
    iceCandidateQueuesRef.current.clear();
    setRemoteStreams({});
  };

  return {
    remoteStreams,
    peerConnectionsRef,
    offeredPeersRef,
    createPeerConnection,
    initiateOffer,
    handleWebRTCOffer,
    handleWebRTCAnswer,
    handleWebRTCCandidate,
    cleanupWebRTC,
  };
}
