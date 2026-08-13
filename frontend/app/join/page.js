'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, AlertCircle } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import api from '../../lib/api';

export default function PreJoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mid = searchParams.get('mid');

  const [displayName, setDisplayName] = useState('Guest User');
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // 1. Fetch meeting verification
  useEffect(() => {
    if (!mid) {
      setError('Meeting ID is missing in the URL.');
      return;
    }

    const verifyMeeting = async () => {
      try {
        const res = await api.get(`/meetings/validate/${mid}/`);
        if (res.data.valid) {
          setMeetingInfo(res.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Meeting not found or has already ended.');
      }
    };

    verifyMeeting();
  }, [mid]);

  // 2. Camera Stream Manager
  useEffect(() => {
    const startCamera = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (isVideoOn) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: isAudioOn,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.warn('Could not access camera/mic:', err);
        }
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isVideoOn]);

  // Toggle micro
  const handleToggleAudio = () => {
    const nextState = !isAudioOn;
    setIsAudioOn(nextState);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
  };

  // Toggle camera
  const handleToggleVideo = () => {
    setIsVideoOn(!isVideoOn);
  };

  // Handle joining meeting room
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!meetingInfo) return;
    setIsJoining(true);

    try {
      await api.post(`/meetings/${meetingInfo.id}/join/`, {
        display_name: displayName.trim() || 'Guest User',
        is_host: false,
        is_video_on: isVideoOn,
        is_audio_on: isAudioOn,
      });

      sessionStorage.setItem('zoom_clone_name', displayName.trim() || 'Guest User');
      sessionStorage.setItem('zoom_clone_audio', isAudioOn.toString());
      sessionStorage.setItem('zoom_clone_video', isVideoOn.toString());

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      router.push(`/meeting/${meetingInfo.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to join the meeting room. Please try again.');
      setIsJoining(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#121214] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center p-8 space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center text-red-500">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Unable to Join</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <Button variant="primary" onClick={() => router.push('/')} className="w-full mt-4">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121214] flex flex-col items-center justify-center p-6 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        
        {/* Left: Video Preview */}
        <div className="space-y-4 flex flex-col items-center">
          <div className="relative w-full aspect-video bg-[#1A1A1E] rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg flex items-center justify-center">
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
                <div className="w-20 h-20 rounded-full bg-gray-700 dark:bg-gray-800 flex items-center justify-center text-gray-300 text-3xl font-semibold select-none shadow">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'G'}
                </div>
                <span className="text-sm text-gray-400 font-medium">Camera is off</span>
              </div>
            )}

            {/* Bottom floating toggles */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full flex items-center space-x-3 border border-white/10 shadow-lg">
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`p-2.5 rounded-full transition-colors ${
                  isAudioOn
                    ? 'text-white hover:bg-white/20'
                    : 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
                }`}
                title={isAudioOn ? 'Mute Mic' : 'Unmute Mic'}
              >
                {isAudioOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                type="button"
                onClick={handleToggleVideo}
                className={`p-2.5 rounded-full transition-colors ${
                  isVideoOn
                    ? 'text-white hover:bg-white/20'
                    : 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
                }`}
                title={isVideoOn ? 'Stop Camera' : 'Start Camera'}
              >
                {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            </div>
          </div>
          <span className="text-xs text-gray-500 select-none">Make sure your camera and mic look good before joining</span>
        </div>

        {/* Right: Join Form */}
        <div className="space-y-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs font-bold text-[#0E71EB] uppercase tracking-wider">Ready to join?</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {meetingInfo ? meetingInfo.title : 'Zoom Meeting'}
            </h1>
            {meetingInfo && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Hosted by <span className="font-semibold text-gray-700 dark:text-gray-300">{meetingInfo.host_name}</span>
              </p>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-4 max-w-sm mx-auto md:mx-0">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Your Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name..."
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1E] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0E71EB] focus:border-transparent text-sm shadow-sm"
                required
                maxLength={50}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isJoining || !meetingInfo}
              className="w-full py-3 rounded-2xl font-semibold shadow-md flex items-center justify-center"
            >
              {isJoining ? 'Joining Call...' : 'Join with Computer Audio'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
