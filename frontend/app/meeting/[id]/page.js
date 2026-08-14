'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Room, RoomEvent, Track,
} from 'livekit-client';
import { 
  Mic, MicOff, Video, VideoOff, Users, MessageSquare, PhoneOff, 
  ShieldAlert, VideoIcon, Smile, Settings, Shield, Grid, Tv, 
  HelpCircle, Lock, LockOpen, Check, X, LogOut, AlertTriangle,
  UserMinus
} from 'lucide-react';
import Button from '../../../components/Button';
import Card from '../../../components/Card';
import Modal from '../../../components/Modal';
import api, { WS_BASE_URL } from '../../../lib/api';
import { consumePendingScreenShareStream } from '../../../lib/pendingScreenShare';

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id; // UUID database primary key

  const [meetingTitle, setMeetingTitle] = useState('Meeting Room');
  const [meetingNum, setMeetingNum] = useState('000-000-0000');
  const [hostName, setHostName] = useState('');
  const [displayName, setDisplayName] = useState('Guest User');

  // Local media controls
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [selfParticipantId, setSelfParticipantId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const [muteNotice, setMuteNotice] = useState('');

  // Layout UI states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  
  // Interactive Modals & Dropdowns State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isReactionsOpen, setIsReactionsOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'speaker'
  const [settingsTab, setSettingsTab] = useState('profile');
  const [theme, setTheme] = useState('light');
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');

  // Security Policy States
  const [isMeetingLocked, setIsMeetingLocked] = useState(false);
  const [isWaitingRoomEnabled, setIsWaitingRoomEnabled] = useState(false);
  const [allowShareScreen, setAllowShareScreen] = useState(true);
  const [allowChat, setAllowChat] = useState(true);
  const [allowRename, setAllowRename] = useState(true);

  // Feature states
  const [isRecording, setIsRecording] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  // Poll-based states
  const [activeParticipants, setActiveParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Reactions state
  const [reactions, setReactions] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [roomToken, setRoomToken] = useState('');
  const [livekitUrl, setLivekitUrl] = useState(process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880');

  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const chatBottomRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  const socketRef = useRef(null);

  // 1. Fetch pre-join configurations from sessionStorage and consume pending screen stream once on mount
  useEffect(() => {
    // Consume screen share stream once on page mount to avoid race conditions
    const pendingStream = consumePendingScreenShareStream();
    if (pendingStream) {
      localScreenStreamRef.current = pendingStream;
    }

    const savedName = sessionStorage.getItem('zoom_clone_name') || 'Guest User';
    const savedAudio = sessionStorage.getItem('zoom_clone_audio') === 'true';
    const savedVideo = sessionStorage.getItem('zoom_clone_video') === 'true';

    setDisplayName(savedName);
    setIsAudioOn(savedAudio);
    setIsVideoOn(savedVideo);

    const savedTheme = localStorage.getItem('zoom_clone_theme') || 'light';
    setTheme(savedTheme);

    const fetchDetails = async () => {
      try {
        const res = await api.get(`/meetings/${meetingId}/`);
        setMeetingTitle(res.data.title);
        setMeetingNum(res.data.meeting_id);
        setHostName(res.data.host.display_name);
        
        // Update security policies
        setIsMeetingLocked(res.data.is_locked || false);
        setIsWaitingRoomEnabled(res.data.is_waiting_room_enabled || false);
        setAllowShareScreen(res.data.allow_share_screen !== false);
        setAllowChat(res.data.allow_chat !== false);
        setAllowRename(res.data.allow_rename !== false);
      } catch (err) {
        console.error('Failed to fetch meeting details', err);
      }
    };
    fetchDetails();

    // Trigger instant pre-share if redirected from dashboard Share Screen card
    const preShareActive = sessionStorage.getItem('zoom_clone_pre_share') === 'true';
    if (preShareActive) {
      // The actual share request runs only after LiveKit has connected.
      // Calling getDisplayMedia before then was the reason dashboard sharing
      // appeared to do nothing.
    }
  // The pre-share flag is consumed only on entry; later control changes must not retrigger it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // Query actual hardware inputs on mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoIn = devices.filter((d) => d.kind === 'videoinput');
          const audioIn = devices.filter((d) => d.kind === 'audioinput');
          
          setVideoDevices(videoIn);
          setAudioDevices(audioIn);
          
          if (videoIn.length > 0) {
            setSelectedVideoDevice(sessionStorage.getItem('zoom_clone_video_device') || videoIn[0].deviceId);
          }
          if (audioIn.length > 0) {
            setSelectedAudioDevice(sessionStorage.getItem('zoom_clone_audio_device') || audioIn[0].deviceId);
          }
        }
      } catch (err) {
        console.warn('Failed to enumerate devices:', err);
      }
    };
    
    // Listen for device changes
    navigator.mediaDevices?.addEventListener('devicechange', fetchDevices);
    fetchDevices();
    
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', fetchDevices);
    };
  }, []);

  const handleVideoDeviceChange = async (deviceId) => {
    setSelectedVideoDevice(deviceId);
    sessionStorage.setItem('zoom_clone_video_device', deviceId);
    if (roomRef.current) {
      try {
        await roomRef.current.switchActiveDevice(Track.Source.Camera, deviceId);
      } catch (err) {
        console.error('Failed to switch video device:', err);
      }
    }
  };

  const handleAudioDeviceChange = async (deviceId) => {
    setSelectedAudioDevice(deviceId);
    sessionStorage.setItem('zoom_clone_audio_device', deviceId);
    if (roomRef.current) {
      try {
        await roomRef.current.switchActiveDevice(Track.Source.Microphone, deviceId);
      } catch (err) {
        console.error('Failed to switch audio device:', err);
      }
    }
  };

  // 2. LiveKit owns media capture and publishing. This avoids opening a
  // second local stream that competes with the tracks published to the room.
  const handleToggleScreenShare = async () => {
    if (!allowShareScreen && displayName !== hostName) {
      alert("Host has disabled screen sharing for participants.");
      return;
    }

    if (!roomRef.current?.localParticipant) return;
    try {
      const nextState = !isSharingScreen;
      await roomRef.current.localParticipant.setScreenShareEnabled(nextState);
      setIsSharingScreen(nextState);
    } catch (err) {
      console.warn('Screen share canceled or unavailable', err);
    }
  };

  // 4. WebSocket setup for real-time participant updates and signaling
  useEffect(() => {
    if (!meetingId || !displayName) return;

    // LiveKit is the sole source of participant presence. Keeping the legacy
    // signaling socket active created duplicate tiles for every participant.
    return undefined;

    const wsUrl = `${WS_BASE_URL}/ws/meetings/${meetingId}/`;
    const ws = new WebSocket(wsUrl);

    const handleWebSocketMessage = (event) => {
      const data = JSON.parse(event.data);
      const type = data.type;

      if (type === 'existing_participants') {
        // Initial list of existing participants
        const existingParticipants = data.participants || [];
        const otherParticipants = existingParticipants.filter(
          (p) => p.displayName !== displayName
        );
        setActiveParticipants(
          otherParticipants.map((p) => ({
            id: p.participantId,
            display_name: p.displayName,
            is_audio_on: true,
            is_video_on: true,
            is_host: false,
          }))
        );
      } else if (type === 'peer.joined') {
        // New participant joined
        const newParticipant = {
          id: data.participantId,
          display_name: data.displayName,
          is_audio_on: true,
          is_video_on: true,
          is_host: false,
        };
        setActiveParticipants((prev) => [...prev, newParticipant]);
      } else if (type === 'peer.left') {
        // Participant left
        setActiveParticipants((prev) =>
          prev.filter((p) => p.display_name !== data.displayName)
        );
      } else if (type === 'chat_message') {
        // New chat message
        setChatMessages((prev) => [...prev, data.message]);
      } else if (type === 'participant_state_changed') {
        // Participant audio/video state changed
        setActiveParticipants((prev) =>
          prev.map((p) =>
            p.id === data.participantId
              ? {
                  ...p,
                  is_audio_on: data.is_audio_on !== undefined ? data.is_audio_on : p.is_audio_on,
                  is_video_on: data.is_video_on !== undefined ? data.is_video_on : p.is_video_on,
                }
              : p
          )
        );
      }
    };

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join',
          participantId: selfParticipantId || `${displayName}-${Date.now()}`,
          displayName,
        })
      );
    };

    ws.onmessage = handleWebSocketMessage;
    ws.onerror = (error) => console.error('WebSocket error:', error);

    socketRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [meetingId, displayName, selfParticipantId]);

  // Fetch initial participant data on mount
  useEffect(() => {
    const fetchInitialStatus = async () => {
      try {
        const res = await api.get(`/meetings/${meetingId}/`);
        const active = res.data.participants.filter((p) => p.left_at === null);

        const storedParticipantId = sessionStorage.getItem('zoom_clone_participant_id');
        const currentParticipant = active.find((p) => String(p.id) === storedParticipantId) || null;
        if (currentParticipant) {
          setSelfParticipantId(currentParticipant.id);
          sessionStorage.setItem('zoom_clone_participant_id', String(currentParticipant.id));
        }

      } catch (err) {
        console.error('Failed to fetch initial participant status', err);
      }
    };

    const fetchChats = async () => {
      try {
        const res = await api.get(`/chat/?meeting_id=${meetingId}`);
        setChatMessages(res.data);
      } catch (err) {
        console.error('Failed to fetch chat messages', err);
      }
    };

    if (meetingId && displayName) {
      fetchInitialStatus();
      fetchChats();
    }
  }, [meetingId, displayName]);

  useEffect(() => {
    const createLivekitToken = async () => {
      if (!meetingId) return;

      try {
        const payload = {
          display_name: displayName,
          participant_id: sessionStorage.getItem('zoom_clone_participant_id'),
          host_access_token: sessionStorage.getItem(`zoom_clone_host_key_${meetingId}`),
        };

        const res = await api.post(`/meetings/${meetingId}/livekit_token/`, payload);
        setRoomToken(res.data.token);
        if (res.data.participant?.id) {
          setSelfParticipantId(res.data.participant.id);
          setIsHost(Boolean(res.data.participant.is_host));
          sessionStorage.setItem('zoom_clone_participant_id', String(res.data.participant.id));
        }
        setLivekitUrl(res.data.ws_url || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880');
        setConnectionStatus('ready');
      } catch (err) {
        console.error('Failed to create LiveKit token', err);
        setConnectionStatus('failed');
      }
    };

    createLivekitToken();
  }, [meetingId, displayName]);

  useEffect(() => {
    if (!roomToken || !livekitUrl) return;

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
      },
    });
    roomRef.current = room;

    const syncLiveKitParticipants = () => {
      setActiveParticipants(Array.from(room.remoteParticipants.values()).map((participant) => ({
        id: participant.identity,
        display_name: participant.name || participant.identity,
        is_audio_on: !participant.getTrackPublication(Track.Source.Microphone)?.isMuted,
        is_video_on: !participant.getTrackPublication(Track.Source.Camera)?.isMuted,
        is_host: participant.name === hostName,
      })));
    };

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) setConnectionStatus('connected');
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setConnectionStatus('disconnected');
    });

    room.on(RoomEvent.Connecting, () => {
      if (!cancelled) setConnectionStatus('connecting');
    });
    room.on(RoomEvent.ParticipantConnected, syncLiveKitParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncLiveKitParticipants);
    room.on(RoomEvent.TrackSubscribed, syncLiveKitParticipants);
    room.on(RoomEvent.TrackUnsubscribed, syncLiveKitParticipants);
    room.on(RoomEvent.TrackMuted, syncLiveKitParticipants);
    room.on(RoomEvent.TrackUnmuted, syncLiveKitParticipants);
    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (
        (publication.source === Track.Source.Camera || publication.source === Track.Source.ScreenShare)
        && videoRef.current
      ) {
        publication.videoTrack?.attach(videoRef.current);
      }
    });
    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.ScreenShare && !cancelled) {
        setIsSharingScreen(false);
        const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
        if (cameraTrack && videoRef.current) cameraTrack.attach(videoRef.current);
      }
    });
    room.on(RoomEvent.DataReceived, async (payload) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === 'chat') {
          setChatMessages((previous) => previous.some((item) => item.client_id === message.id)
            ? previous
            : [...previous, { ...message.message, client_id: message.id }]);
        } else if (message.type === 'reaction') {
          setReactions((previous) => [...previous, { id: message.id, emoji: message.emoji }]);
          setTimeout(() => setReactions((previous) => previous.filter((reaction) => reaction.id !== message.id)), 4000);
        } else if (message.type === 'mute-all') {
          await room.localParticipant.setMicrophoneEnabled(false);
          setIsAudioOn(false);
          setMuteNotice('The host muted all microphones');
          setTimeout(() => setMuteNotice(''), 4000);
        } else if (message.type === 'meeting-ended') {
          room.disconnect();
          router.push('/');
        } else if (message.type === 'kick') {
          const selfPartId = sessionStorage.getItem('zoom_clone_participant_id');
          if (String(message.participantId) === String(selfPartId)) {
            room.disconnect();
            router.push('/?kicked=true');
          }
        } else if (message.type === 'security-policy') {
          setIsMeetingLocked(message.policy.isLocked);
          setIsWaitingRoomEnabled(message.policy.isWaitingRoomEnabled);
          setAllowShareScreen(message.policy.allowShareScreen);
          setAllowChat(message.policy.allowChat);
          setAllowRename(message.policy.allowRename);
        }
      } catch (error) {
        console.warn('Ignoring invalid LiveKit room message', error);
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      console.log(`Track subscribed from ${participant.name}:`, track.kind);

      if (track.kind === Track.Kind.Video) {
        // Create or get existing MediaStream for this participant
        const mediaStream = new MediaStream();
        const videoTrack = track.mediaStreamTrack;

        if (videoTrack) {
          mediaStream.addTrack(videoTrack);

          setRemoteStreams((prev) => {
            const existing = prev[participant.identity];
            existing?.getAudioTracks().forEach((audioTrack) => mediaStream.addTrack(audioTrack));
            return { ...prev, [participant.identity]: mediaStream };
          });
        }
      } else if (track.kind === Track.Kind.Audio) {
        // Get existing MediaStream or create new one
        setRemoteStreams((prev) => {
          const existing = prev[participant.identity] || new MediaStream();
          const audioTrack = track.mediaStreamTrack;

          if (audioTrack && !existing.getAudioTracks().some(t => t.id === audioTrack.id)) {
            existing.addTrack(audioTrack);
          }

          return {
            ...prev,
            [participant.identity]: existing,
          };
        });
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (_track, _publication, participant) => {
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
    });

    const connectRoom = async () => {
      try {
        console.log('Connecting to LiveKit room:', livekitUrl);
        await room.connect(livekitUrl, roomToken, { autoSubscribe: true });
        syncLiveKitParticipants();
        console.log('Connected to LiveKit room');

        const wantsAudio = sessionStorage.getItem('zoom_clone_audio') === 'true';
        const wantsVideo = sessionStorage.getItem('zoom_clone_video') === 'true';
        await room.localParticipant.setMicrophoneEnabled(wantsAudio);
        await room.localParticipant.setCameraEnabled(wantsVideo);
        if (wantsVideo && videoRef.current) {
          room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack?.attach(videoRef.current);
        }
        const pendingScreenShare = localScreenStreamRef.current;
        if (pendingScreenShare?.getVideoTracks()[0]) {
          sessionStorage.removeItem('zoom_clone_pre_share');
          const screenTrack = pendingScreenShare.getVideoTracks()[0];
          screenTrack.onended = () => setIsSharingScreen(false);
          await room.localParticipant.publishTrack(screenTrack, {
            source: Track.Source.ScreenShare,
            simulcast: true,
          });
          if (!cancelled) setIsSharingScreen(true);
        } else if (sessionStorage.getItem('zoom_clone_pre_share') === 'true') {
          sessionStorage.removeItem('zoom_clone_pre_share');
        }
        if (!cancelled) {
          setIsAudioOn(wantsAudio);
          setIsVideoOn(wantsVideo);
        }

        if (!cancelled) {
          setConnectionStatus('connected');
        }
      } catch (err) {
        console.error('LiveKit room connection failed', err);
        if (!cancelled) setConnectionStatus('failed');
      }
    };

    connectRoom();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
    };
  }, [roomToken, livekitUrl, hostName]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // Send message
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (!allowChat && displayName !== hostName) {
      alert("Host has disabled chat in this meeting.");
      return;
    }

    try {
      const res = await api.post('/chat/', {
        meeting: meetingId,
        sender_name: displayName,
        content: newMessage.trim(),
      });
      const id = crypto.randomUUID();
      const message = { ...res.data, client_id: id };
      setChatMessages((prev) => [...prev, message]);
      await roomRef.current?.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'chat', id, message })),
        { reliable: true },
      );
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send chat message', err);
    }
  };

  // Toggle Mute Audio
  const handleToggleAudio = async () => {
    const nextState = !isAudioOn;
    setIsAudioOn(nextState);

    if (roomRef.current?.localParticipant) {
      roomRef.current.localParticipant.setMicrophoneEnabled(nextState);
    }

    if (selfParticipantId) {
      try {
        await api.post(`/participants/${selfParticipantId}/toggle_audio/`, {
          is_audio_on: nextState,
        });
      } catch (err) {
        console.error('Failed to sync mic state', err);
      }
    }
  };

  // Toggle Video Stop
  const handleToggleVideo = async () => {
    const nextState = !isVideoOn;
    setIsVideoOn(nextState);

    if (roomRef.current?.localParticipant) {
      roomRef.current.localParticipant.setCameraEnabled(nextState);
    }

    if (selfParticipantId) {
      try {
        await api.post(`/participants/${selfParticipantId}/toggle_video/`, {
          is_video_on: nextState,
        });
      } catch (err) {
        console.error('Failed to sync camera state', err);
      }
    }
  };

  // Leave meeting action
  const handleLeave = async () => {
    try {
      await api.post(`/meetings/${meetingId}/leave/`, {
        display_name: displayName,
      });
    } catch (err) {}
    roomRef.current?.disconnect();
    router.push('/');
  };

  // End meeting for all action
  const handleEndAll = async () => {
    if (!isHost || !selfParticipantId) return;
    try {
      await api.post(`/meetings/${meetingId}/end/`, {
        participant_id: selfParticipantId,
        host_access_token: sessionStorage.getItem(`zoom_clone_host_key_${meetingId}`),
      });
      await roomRef.current?.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'meeting-ended' })),
        { reliable: true },
      );
    } catch (err) {
      console.error('Failed to end meeting', err);
      return;
    }
    roomRef.current?.disconnect();
    router.push('/');
  };

  // Floating emojis trigger
  const triggerReaction = (emoji) => {
    const id = Date.now() + Math.random();
    setReactions((prev) => [...prev, { id, emoji }]);
    roomRef.current?.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: 'reaction', id, emoji })),
      { reliable: true },
    ).catch((err) => console.warn('Failed to send reaction', err));
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 4000);
  };

  // Host Mute All action
  const handleMuteAll = async () => {
    if (!isHost) return;
    try {
      await api.post(`/meetings/${meetingId}/mute_all/`, {
        host_access_token: sessionStorage.getItem(`zoom_clone_host_key_${meetingId}`),
      });
      await roomRef.current?.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'mute-all' })),
        { reliable: true },
      );
    } catch (err) {
      console.error('Failed to mute all participants', err);
      return;
    }
    setIsMutedAll(true);
    // Exclude host from muting
    setActiveParticipants((prev) => prev.map((participant) => ({ ...participant, is_audio_on: false })));

    setMuteNotice('Host has muted all participant microphones');
    setTimeout(() => setMuteNotice(''), 4000);
  };

  // Host Kick Participant action
  const handleKickParticipant = async (participant) => {
    if (!isHost || !selfParticipantId) return;
    const confirmKick = window.confirm(`Are you sure you want to remove ${participant.display_name} from the meeting?`);
    if (!confirmKick) return;

    try {
      await api.post(`/participants/${participant.id}/kick/`, {
        host_access_token: sessionStorage.getItem(`zoom_clone_host_key_${meetingId}`),
      });
      await roomRef.current?.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'kick', participantId: participant.id })),
        { reliable: true },
      );
      setActiveParticipants((prev) => prev.filter((p) => p.id !== participant.id));
    } catch (err) {
      console.error('Failed to remove participant', err);
      alert('Failed to remove participant. Please try again.');
    }
  };

  // Host update security policy
  const handleSecurityPolicyChange = async (policyKey, value) => {
    if (policyKey === 'is_locked') setIsMeetingLocked(value);
    if (policyKey === 'waiting_room_enabled') setIsWaitingRoomEnabled(value);
    if (policyKey === 'allow_share_screen') setAllowShareScreen(value);
    if (policyKey === 'allow_chat') setAllowChat(value);
    if (policyKey === 'allow_rename') setAllowRename(value);

    try {
      await api.patch(`/meetings/${meetingId}/update_security/`, {
        host_access_token: sessionStorage.getItem(`zoom_clone_host_key_${meetingId}`),
        [policyKey]: value,
      });

      const msg = {
        type: 'security-policy',
        policy: {
          isLocked: policyKey === 'is_locked' ? value : isMeetingLocked,
          isWaitingRoomEnabled: policyKey === 'waiting_room_enabled' ? value : isWaitingRoomEnabled,
          allowShareScreen: policyKey === 'allow_share_screen' ? value : allowShareScreen,
          allowChat: policyKey === 'allow_chat' ? value : allowChat,
          allowRename: policyKey === 'allow_rename' ? value : allowRename,
        }
      };
      await roomRef.current?.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(msg)),
        { reliable: true }
      );
    } catch (err) {
      console.error('Failed to update security policy:', err);
    }
  };

  // Change theme mode
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('zoom_clone_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Profile save display name update
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!allowRename && displayName !== hostName) {
      alert("Host has locked display name edits for participants.");
      return;
    }
    sessionStorage.setItem('zoom_clone_name', displayName.trim());
    setIsSettingsOpen(false);
  };

  // Compute grid layouts based on participant counts for Gallery View
  const totalTiles = activeParticipants.length + 1;
  const getGridCols = () => {
    if (totalTiles === 1) return 'grid-cols-1';
    if (totalTiles === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-2';
  };

  // Identify who is rendering inside the main speaker slot in Speaker View
  const getSpeakerTarget = () => {
    if (displayName === hostName || activeParticipants.length === 0) {
      return { isSelf: true, name: displayName };
    }
    const hostUser = activeParticipants.find(p => p.display_name === hostName);
    if (hostUser) return { isSelf: false, data: hostUser };
    return { isSelf: false, data: activeParticipants[0] };
  };

  const speakerTarget = getSpeakerTarget();

  return (
    <div className="h-screen w-full bg-[#1A1A1E] text-white flex flex-col overflow-hidden relative select-none font-sans">
      
      {/* Header bar overlay */}
      <header className="absolute top-0 left-0 w-full z-30 px-6 py-4 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-semibold select-all">Meeting ID: {meetingNum}</span>
          {isMeetingLocked && (
            <span className="flex items-center text-xs text-orange-400 font-bold pl-2 border-l border-white/10">
              <Lock size={12} className="mr-1" />
              <span>Locked</span>
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-3 pointer-events-auto">
          {isRecording && (
            <div className="flex items-center space-x-2 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              <span>Recording</span>
            </div>
          )}

          {/* View mode dropdown toggle */}
          <div className="relative">
            <button 
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              className="bg-black/40 hover:bg-black/60 text-white px-3 py-1.5 rounded-xl border border-white/5 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Grid size={14} />
              <span>View</span>
            </button>
            {isViewDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1E1E24] border border-white/10 rounded-xl shadow-2xl overflow-hidden text-xs z-50">
                <button
                  onClick={() => { setViewMode('gallery'); setIsViewDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-3 flex items-center space-x-2 hover:bg-white/5 ${viewMode === 'gallery' ? 'text-blue-400 font-bold' : 'text-gray-300'}`}
                >
                  <Grid size={14} />
                  <span>Gallery View</span>
                </button>
                <button
                  onClick={() => { setViewMode('speaker'); setIsViewDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-3 flex items-center space-x-2 hover:bg-white/5 ${viewMode === 'speaker' ? 'text-blue-400 font-bold' : 'text-gray-300'}`}
                >
                  <Tv size={14} />
                  <span>Speaker View</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Screen Sharing overlay indicator border */}
      {isSharingScreen && (
        <div className="absolute inset-0 border-4 border-green-500 pointer-events-none z-20"></div>
      )}

      {/* Mute All Notification Banner */}
      {muteNotice && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-40 bg-orange-600/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-bounce flex items-center space-x-2 border border-orange-400/40">
          <MicOff size={14} />
          <span>{muteNotice}</span>
        </div>
      )}

      {/* Body panel split: Video grid vs Sidebar */}
      <div className="flex-1 flex overflow-hidden w-full h-full">
        {/* Video Area containing Speaker View / Gallery View */}
        <div className="flex-grow p-6 pt-20 pb-28 flex flex-col items-center justify-center relative overflow-y-auto max-w-6xl mx-auto w-full h-full">
          
          {viewMode === 'gallery' ? (
            /* 1. GALLERY VIEW - Standard equal grid */
            <div className={`grid gap-6 w-full h-full max-h-[70vh] ${getGridCols()}`}>
              
              {/* Tile 1: You */}
              <div className="relative rounded-3xl overflow-hidden bg-gray-900 border border-white/5 shadow-xl flex items-center justify-center group">
                {isVideoOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-extrabold shadow-md select-none">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-400">{displayName} (You)</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl flex items-center space-x-2 border border-white/5 text-xs">
                  {isAudioOn ? (
                    <Mic size={14} className="text-green-500" />
                  ) : (
                    <MicOff size={14} className="text-red-500" />
                  )}
                  <span>{displayName} (You)</span>
                </div>
              </div>

              {/* Other active participants with LiveKit streams */}
              {activeParticipants.map((participant) => {
                const remoteStream = remoteStreams[String(participant.id)];
                return (
                  <div
                    key={participant.id}
                    className="relative rounded-3xl overflow-hidden bg-gray-900 border border-white/5 shadow-xl flex items-center justify-center group"
                  >
                    {remoteStream ? (
                      <>
                      <video
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        ref={(node) => {
                          if (node && node.srcObject !== remoteStream) {
                            node.srcObject = remoteStream;
                          }
                        }}
                      />
                      <audio
                        autoPlay
                        ref={(node) => {
                          if (node && node.srcObject !== remoteStream) node.srcObject = remoteStream;
                        }}
                      />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 text-3xl font-bold select-none shadow">
                          {participant.display_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-400">{participant.display_name}</span>
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl flex items-center space-x-2 border border-white/5 text-xs">
                      {participant.is_audio_on ? <Mic size={14} className="text-green-500" /> : <MicOff size={14} className="text-red-500" />}
                      <span>{participant.display_name}</span>
                    </div>
                    {participant.is_host && (
                      <span className="absolute top-4 right-4 bg-[#0E71EB]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full select-none">
                        Host
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. SPEAKER VIEW - Large speaker, small strip at the top */
            <div className="w-full h-full flex flex-col space-y-4 justify-between max-h-[70vh]">
              
              {/* Horizontal Participant strip at the top */}
              <div className="flex items-center space-x-4 overflow-x-auto py-2 shrink-0 max-h-[140px]">
                {(!speakerTarget.isSelf) && (
                  <div className="w-40 aspect-video rounded-xl bg-gray-900 border border-white/5 relative overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                    {isVideoOn ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[9px]">You</span>
                  </div>
                )}

                {activeParticipants.map((p) => {
                  if (!speakerTarget.isSelf && speakerTarget.data.id === p.id) return null;
                  const remoteStream = remoteStreams[String(p.id)];
                  return (
                    <div key={p.id} className="w-40 aspect-video rounded-xl bg-gray-900 border border-white/5 relative overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                      {remoteStream ? (
                        <>
                        <video
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          ref={(node) => {
                            if (node && node.srcObject !== remoteStream) {
                              node.srcObject = remoteStream;
                            }
                          }}
                        />
                        <audio autoPlay ref={(node) => { if (node && node.srcObject !== remoteStream) node.srcObject = remoteStream; }} />
                        </>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-xs font-bold">
                          {p.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-1.5 left-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[9px] truncate max-w-[80px]">
                        {p.display_name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Giant active speaker focus panel */}
              <div className="flex-1 bg-gray-950 rounded-3xl border border-white/5 overflow-hidden relative flex items-center justify-center shadow-2xl">
                {speakerTarget.isSelf ? (
                  isVideoOn ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-white text-5xl font-black shadow-lg mx-auto">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-lg font-bold text-gray-400">{displayName}</p>
                    </div>
                  )
                ) : (
                  (() => {
                    const speakerRemoteStream = remoteStreams[String(speakerTarget.data.id)];
                    return speakerRemoteStream ? (
                      <>
                      <video
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        ref={(node) => {
                          if (node && node.srcObject !== speakerRemoteStream) {
                            node.srcObject = speakerRemoteStream;
                          }
                        }}
                      />
                      <audio autoPlay ref={(node) => { if (node && node.srcObject !== speakerRemoteStream) node.srcObject = speakerRemoteStream; }} />
                      </>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 text-5xl font-black shadow-lg mx-auto">
                          {speakerTarget.data.display_name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-lg font-bold text-gray-400">{speakerTarget.data.display_name}</p>
                      </div>
                    );
                  })()
                )}

                <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center space-x-2 border border-white/5 text-sm">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                  <span className="font-bold text-xs">Active Speaker: {speakerTarget.isSelf ? displayName : speakerTarget.data.display_name}</span>
                </div>
              </div>
            </div>
          )}

          {/* Floating Emoji animations layers */}
          <div className="absolute bottom-28 right-8 z-25 pointer-events-none flex flex-col space-y-2 items-end">
            {reactions.map((r) => (
              <span
                key={r.id}
                className="text-5xl animate-bounce drop-shadow-xl"
                style={{ animation: 'floatUp 4s ease-out forwards' }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Right Sidebar split for Chat panel / Participants panel */}
        {(isChatOpen || isParticipantsOpen) && (
          <aside className="w-80 bg-[#151518] border-l border-gray-200/5 dark:border-[#232328] flex flex-col h-full z-20">
            <div className="p-4 border-b border-gray-200/5 dark:border-[#232328] flex justify-between items-center bg-[#1A1A1E]">
              <h3 className="font-bold text-sm">
                {isChatOpen ? 'Meeting Chat' : 'Participants'}
              </h3>
              <Button
                variant="ghost"
                onClick={() => { setIsChatOpen(false); setIsParticipantsOpen(false); }}
                className="text-xs p-1"
              >
                Close
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isChatOpen ? (
                <div className="flex flex-col h-full justify-between space-y-4">
                  {/* Chat messages list */}
                  <div className="flex-grow overflow-y-auto space-y-3 max-h-[60vh] pr-1">
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-10">No messages yet.</p>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} className="text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-blue-400">{msg.sender_name}</span>
                            <span className="text-[9px] text-gray-500">
                              {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="bg-[#1e1e24] p-2.5 rounded-2xl border border-white/5 text-gray-200 break-words">
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Send chat form */}
                  <form onSubmit={handleSendChat} className="flex items-center space-x-2 pt-2 border-t border-white/5">
                    <input
                      type="text"
                      placeholder="Send message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-grow bg-[#232328] border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-white"
                      disabled={!allowChat && displayName !== hostName}
                      maxLength={500}
                    />
                    <Button 
                      type="submit" 
                      variant="primary" 
                      disabled={!allowChat && displayName !== hostName}
                      className="py-2 px-3 rounded-xl text-xs"
                    >
                      Send
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  {isHost && <div className="bg-[#1e1e24] p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400">Host Actions</span>
                    <Button
                      variant="secondary"
                      onClick={handleMuteAll}
                      className="text-[10px] py-1.5 px-3 rounded-lg font-bold bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30"
                    >
                      Mute All
                    </Button>
                  </div>}

                  {/* Participants status list */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-white/5">
                      <span className="font-semibold">{displayName} (You)</span>
                      <div className="flex items-center space-x-2 text-gray-500">
                        {isAudioOn ? <Mic size={14} className="text-green-500" /> : <MicOff size={14} className="text-red-500" />}
                        {isVideoOn ? <Video size={14} className="text-green-500" /> : <VideoOff size={14} className="text-red-500" />}
                      </div>
                    </div>
                    {activeParticipants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-white/5"
                      >
                        <span className="font-semibold">{p.display_name}</span>
                        <div className="flex items-center space-x-3 text-gray-500">
                          {isHost && (
                            <button
                              onClick={() => handleKickParticipant(p)}
                              className="flex items-center text-[10px] bg-red-500 hover:bg-red-600 active:bg-red-700 text-white px-2 py-1 rounded-lg font-bold shadow-sm transition-all transform active:scale-95 duration-100"
                              title="Remove participant from meeting"
                            >
                              <UserMinus size={11} className="mr-1" />
                              <span>Remove</span>
                            </button>
                          )}
                          <div className="flex items-center space-x-1">
                            {p.is_audio_on ? <Mic size={14} className="text-green-500" /> : <MicOff size={14} className="text-red-500" />}
                            {p.is_video_on ? <Video size={14} className="text-green-500" /> : <VideoOff size={14} className="text-red-500" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Floating Emoji animations styles */}
      <style jsx global>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(-20px) scale(1.1);
          }
          100% {
            transform: translateY(-220px) scale(0.8);
            opacity: 0;
          }
        }
      `}</style>

      {/* Bottom Control Bar overlay */}
      <div className="absolute bottom-0 left-0 w-full z-45 bg-[#1A1A1E]/95 backdrop-blur-md border-t border-gray-200/5 dark:border-[#232328] py-4 px-6 flex items-center justify-between shadow-2xl">
        
        {/* Toggle Audio & Video */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleAudio}
            className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 transition-colors ${
              isAudioOn ? 'text-gray-300' : 'text-red-500'
            }`}
          >
            {isAudioOn ? <Mic size={20} /> : <MicOff size={20} />}
            <span className="text-[10px] mt-1 select-none font-semibold">{isAudioOn ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            onClick={handleToggleVideo}
            className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 transition-colors ${
              isVideoOn ? 'text-gray-300' : 'text-red-500'
            }`}
          >
            {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
            <span className="text-[10px] mt-1 select-none font-semibold">{isVideoOn ? 'Stop Video' : 'Start Video'}</span>
          </button>
        </div>

        {/* Utility panel controls */}
        <div className="flex items-center space-x-2 md:space-x-3 relative">
          
          {/* Security Dropdown Menu - Toggles Locks and Permissions */}
          {isHost && <div className="relative">
            <button
              onClick={() => { setIsSecurityOpen(!isSecurityOpen); setIsViewDropdownOpen(false); }}
              className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 transition-colors ${
                isSecurityOpen ? 'text-[#0E71EB]' : 'text-gray-300'
              }`}
            >
              <Shield size={20} />
              <span className="text-[10px] mt-1 select-none font-semibold">Security</span>
            </button>
            {isSecurityOpen && (
              <div className="absolute bottom-16 left-0 w-64 bg-[#1E1E24] border border-white/10 rounded-xl shadow-2xl p-4 space-y-4 text-xs z-50">
                <span className="block font-bold text-gray-400 uppercase tracking-wide">Lock Meeting & Policy</span>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Lock Meeting</span>
                  <input
                    type="checkbox"
                    checked={isMeetingLocked}
                    onChange={(e) => handleSecurityPolicyChange('is_locked', e.target.checked)}
                    className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span>Enable Waiting Room</span>
                  <input
                    type="checkbox"
                    checked={isWaitingRoomEnabled}
                    onChange={(e) => handleSecurityPolicyChange('waiting_room_enabled', e.target.checked)}
                    className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                <div className="h-px bg-white/10 my-2"></div>
                
                <button
                  type="button"
                  onClick={handleMuteAll}
                  className="w-full py-2 bg-orange-600/20 text-orange-400 font-bold border border-orange-500/30 rounded-lg hover:bg-orange-600/30 text-center"
                >
                  Mute All Mics
                </button>

                <div className="h-px bg-white/10 my-2"></div>
                <span className="block font-bold text-gray-400 uppercase tracking-wide">Allow participants to:</span>

                <label className="flex items-center justify-between cursor-pointer">
                  <span>Share Screen</span>
                  <input
                    type="checkbox"
                    checked={allowShareScreen}
                    onChange={(e) => handleSecurityPolicyChange('allow_share_screen', e.target.checked)}
                    className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span>Chat</span>
                  <input
                    type="checkbox"
                    checked={allowChat}
                    onChange={(e) => handleSecurityPolicyChange('allow_chat', e.target.checked)}
                    className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span>Rename Themselves</span>
                  <input
                    type="checkbox"
                    checked={allowRename}
                    onChange={(e) => handleSecurityPolicyChange('allow_rename', e.target.checked)}
                    className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                </label>
              </div>
            )}
          </div>}

          <button
            onClick={() => { setIsParticipantsOpen(!isParticipantsOpen); setIsChatOpen(false); }}
            className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 transition-colors relative ${
              isParticipantsOpen ? 'text-[#0E71EB]' : 'text-gray-300'
            }`}
          >
            <Users size={20} />
            <span className="text-[10px] mt-1 select-none font-semibold">Participants</span>
            <span className="absolute top-1.5 right-3.5 w-4 h-4 bg-blue-600 rounded-full text-[9px] font-bold flex items-center justify-center text-white border border-[#1A1A1E]">
              {activeParticipants.length + 1}
            </span>
          </button>

          <button
            onClick={() => { setIsChatOpen(!isChatOpen); setIsParticipantsOpen(false); }}
            className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 transition-colors ${
              isChatOpen ? 'text-[#0E71EB]' : 'text-gray-300'
            }`}
          >
            <MessageSquare size={20} />
            <span className="text-[10px] mt-1 select-none font-semibold">Chat</span>
          </button>

          <button
            onClick={handleToggleScreenShare}
            className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 transition-colors ${
              isSharingScreen ? 'text-green-500' : 'text-gray-300'
            }`}
          >
            <VideoIcon size={20} />
            <span className="text-[10px] mt-1 select-none font-semibold">{isSharingScreen ? 'Stop Sharing' : 'Share Screen'}</span>
          </button>

          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 transition-colors ${
              isRecording ? 'text-red-500' : 'text-gray-300'
            }`}
          >
            <ShieldAlert size={20} />
            <span className="text-[10px] mt-1 select-none font-semibold">{isRecording ? 'Pause Rec' : 'Record'}</span>
          </button>

          {/* Emoji floating reactions button trigger */}
          <div className="relative">
            <button onClick={() => setIsReactionsOpen((open) => !open)} className="flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 text-gray-300 transition-colors">
              <Smile size={20} />
              <span className="text-[10px] mt-1 select-none font-semibold">Reactions</span>
            </button>
            <div className={`absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-[#1e1e24] border border-white/5 p-2 rounded-full space-x-2 shadow-2xl ${isReactionsOpen ? 'flex items-center' : 'hidden'} z-50`}>
              {['👍', '👏', '❤️', '😂', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { triggerReaction(emoji); setIsReactionsOpen(false); }}
                  className="hover:scale-125 transition-transform p-1 focus:outline-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Active meeting settings configuration */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl hover:bg-white/10 text-gray-300 transition-colors"
          >
            <Settings size={20} />
            <span className="text-[10px] mt-1 select-none font-semibold">Settings</span>
          </button>
        </div>

        {/* Leave/End call button opening explicit action popover */}
        <div className="relative">
          <Button
            variant="danger"
            onClick={() => setIsEndModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <PhoneOff size={14} />
            <span>End / Leave</span>
          </Button>
        </div>
      </div>

      {/* End / Leave Selection Modal */}
      <Modal isOpen={isEndModalOpen} onClose={() => setIsEndModalOpen(false)} title="End or Leave Meeting">
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Select an action to exit the meeting room:
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleLeave}
              className="w-full p-4 rounded-xl border border-gray-700 bg-[#232328] hover:bg-gray-800 text-white text-left font-bold text-xs flex items-center justify-between transition-colors"
            >
              <div className="flex items-center space-x-3">
                <LogOut size={18} className="text-gray-400" />
                <div>
                  <div>Leave Meeting</div>
                  <div className="text-[10px] text-gray-400 font-normal">Other participants can remain in the call.</div>
                </div>
              </div>
            </button>

            {isHost && <button
              onClick={handleEndAll}
              className="w-full p-4 rounded-xl border border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-red-400 text-left font-bold text-xs flex items-center justify-between transition-colors"
            >
              <div className="flex items-center space-x-3">
                <PhoneOff size={18} className="text-red-500" />
                <div>
                  <div>End Meeting for All</div>
                  <div className="text-[10px] text-red-300 font-normal">Terminates the call session for every participant.</div>
                </div>
              </div>
            </button>}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setIsEndModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal (Meeting Room Instance) */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 pb-3 mb-4 text-xs font-semibold text-gray-500">
          <button 
            type="button"
            onClick={() => setSettingsTab('profile')}
            className={`pb-1 px-1 border-b-2 transition-colors ${
              settingsTab === 'profile' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Profile
          </button>
          <button 
            type="button"
            onClick={() => setSettingsTab('appearance')}
            className={`pb-1 px-1 border-b-2 transition-colors ${
              settingsTab === 'appearance' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Appearance
          </button>
          <button 
            type="button"
            onClick={() => setSettingsTab('devices')}
            className={`pb-1 px-1 border-b-2 transition-colors ${
              settingsTab === 'devices' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Video & Audio
          </button>
        </div>

        {settingsTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!allowRename && displayName !== hostName}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-700 bg-[#232328] text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
              {!allowRename && displayName !== hostName && (
                <p className="text-[10px] text-orange-400 mt-1">Host has disabled rename privileges.</p>
              )}
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save
              </Button>
            </div>
          </form>
        )}

        {settingsTab === 'appearance' && (
          <div className="space-y-4 py-2 text-gray-300">
            <span className="block text-xs font-bold text-gray-400 uppercase mb-2">
              Theme Mode
            </span>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-xl border text-center font-bold text-sm transition-all ${
                  theme === 'light' 
                    ? 'border-blue-500 bg-blue-950/20 text-blue-400' 
                    : 'border-gray-700 hover:bg-gray-800'
                }`}
              >
                ☀️ Light Mode
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-xl border text-center font-bold text-sm transition-all ${
                  theme === 'dark' 
                    ? 'border-blue-500 bg-blue-950/20 text-blue-400' 
                    : 'border-gray-700 hover:bg-gray-800'
                }`}
              >
                🌙 Dark Mode
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'devices' && (
          <div className="space-y-4 text-gray-300">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">
                Select Camera
              </label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => handleVideoDeviceChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-700 bg-[#232328] text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {videoDevices.length === 0 ? (
                  <option value="">No cameras detected or permission not granted</option>
                ) : (
                  videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera (${d.deviceId.substring(0, 5)})`}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">
                Select Microphone
              </label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => handleAudioDeviceChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-700 bg-[#232328] text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {audioDevices.length === 0 ? (
                  <option value="">No microphones detected or permission not granted</option>
                ) : (
                  audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone (${d.deviceId.substring(0, 5)})`}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setIsSettingsOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
