'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Video, Plus, Calendar, Copy, Clock, Check, AlertCircle, Share2, Settings, HelpCircle } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Modal from '../components/Modal';
import ClockComponent from '../components/Clock';
import api from '../lib/api';
import { discardPendingScreenShareStream, setPendingScreenShareStream } from '../lib/pendingScreenShare';

const normalizeMeetingId = (idOrUrl) => {
  if (!idOrUrl) return '';
  let id = idOrUrl.trim();
  if (id.includes('mid=')) {
    try {
      const urlParams = new URLSearchParams(id.split('?')[1]);
      const extracted = urlParams.get('mid');
      if (extracted) id = extracted;
    } catch (err) {}
  }
  const clean = id.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length === 10) {
    return `${clean.substring(0, 3)}-${clean.substring(3, 6)}-${clean.substring(6, 10)}`;
  }
  return id;
};

const formatMeetingDate = (dateString) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));

const formatMeetingTime = (dateString) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateString));

export default function DashboardClient({ upcomingMeetings, recentMeetings }) {
  const router = useRouter();
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  
  // New Interactive Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isShareScreenOpen, setIsShareScreenOpen] = useState(false);
  
  const [settingsTab, setSettingsTab] = useState('profile');
  const [displayName, setDisplayName] = useState('Guest User');
  const [theme, setTheme] = useState('light');
  
  const searchParams = useSearchParams();
  const kicked = searchParams ? searchParams.get('kicked') : null;
  const [isKickedModalOpen, setIsKickedModalOpen] = useState(false);

  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');

  // Join Modal State
  const [joinId, setJoinId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Share Screen Modal State
  const [shareId, setShareId] = useState('');
  const [shareError, setShareError] = useState('');
  const [isShareValidating, setIsShareValidating] = useState(false);

  // Schedule Modal State
  const [scheduleData, setScheduleData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration: 60,
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Copy Link State
  const [copiedId, setCopiedId] = useState(null);

  // Load settings, check kick status, and query actual input hardware devices on mount
  useEffect(() => {
    const savedName = sessionStorage.getItem('zoom_clone_name') || 'Guest User';
    setDisplayName(savedName);

    const savedTheme = localStorage.getItem('zoom_clone_theme') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (kicked === 'true') {
      setIsKickedModalOpen(true);
      router.replace('/');
    }

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
    fetchDevices();
  }, [kicked, router]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle theme mode
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('zoom_clone_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Save profile display name
  const handleSaveProfile = (e) => {
    e.preventDefault();
    sessionStorage.setItem('zoom_clone_name', displayName.trim());
    setIsSettingsOpen(false);
    router.refresh();
  };

  // Launch Instant Meeting
  const handleNewMeeting = async () => {
    try {
      const res = await api.post('/meetings/', {
        title: 'Instant Meeting',
        description: 'Instant meeting started from the Web Dashboard.',
      });
      sessionStorage.setItem(`zoom_clone_host_key_${res.data.id}`, res.data.host_access_token);
      router.push(`/join?mid=${res.data.meeting_id}`);
    } catch (err) {
      console.error('Failed to create instant meeting', err);
      alert('Could not start a new meeting. Please try again.');
    }
  };

  // Handle Join Form Submission
  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    setJoinError('');
    setIsValidating(true);

    const mid = normalizeMeetingId(joinId);

    try {
      const res = await api.get(`/meetings/validate/${mid}/`);
      if (res.data.valid) {
        setIsJoinOpen(false);
        setJoinId('');
        router.push(`/join?mid=${res.data.meeting_id}`);
      }
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Invalid Meeting ID. Please check and try again.');
    } finally {
      setIsValidating(false);
    }
  };

  // Handle Share Screen Submit (validates and joins meeting room directly in sharing mode)
  const handleShareScreenSubmit = async (e) => {
    e.preventDefault();
    setShareError('');
    setIsShareValidating(true);

    const mid = normalizeMeetingId(shareId);

    try {
      // 1. Validate the meeting first before prompting for screen sharing (better UX)
      const res = await api.get(`/meetings/validate/${mid}/`);
      if (res.data.valid) {
        // 2. Request user for screen sharing permission
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        setPendingScreenShareStream(screenStream);
        setIsShareScreenOpen(false);
        setShareId('');
        // Fallback marker for a page refresh during navigation.
        sessionStorage.setItem('zoom_clone_pre_share', 'true');
        router.push(`/meeting/${res.data.id}`);
      }
    } catch (err) {
      discardPendingScreenShareStream();
      setShareError(
        err.name === 'NotAllowedError'
          ? 'Screen sharing was cancelled or blocked by the browser.'
          : err.response?.data?.error || 'Invalid Meeting ID. Please check and try again.',
      );
    } finally {
      setIsShareValidating(false);
    }
  };

  // Handle Schedule Form Submission
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setScheduleError('');
    setIsScheduling(true);

    const { title, description, date, time, duration } = scheduleData;

    if (!title || !date || !time) {
      setScheduleError('Title, Date, and Time are required.');
      setIsScheduling(false);
      return;
    }

    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    try {
      const response = await api.post('/meetings/', {
        title,
        description,
        scheduled_at: scheduledAt,
        duration_minutes: parseInt(duration),
      });
      sessionStorage.setItem(`zoom_clone_host_key_${response.data.id}`, response.data.host_access_token);

      setIsScheduleOpen(false);
      setScheduleData({
        title: '',
        description: '',
        date: '',
        time: '',
        duration: 60,
      });

      router.refresh();
    } catch (err) {
      setScheduleError(err.response?.data?.detail || 'Failed to schedule meeting.');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div suppressHydrationWarning className="min-h-screen bg-gray-50 dark:bg-[#121214] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Navbar */}
      <header className="sticky top-0 bg-white/85 dark:bg-[#1A1A1E]/85 backdrop-blur-xl border-b border-gray-200/80 dark:border-[#232328] px-6 py-4 z-40 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/icon.svg" alt="Zoom" className="w-10 h-10 rounded-xl shadow-sm" />
            <span className="text-xl font-bold tracking-tight text-[#0B5CFF] dark:text-blue-400 select-none">zoom</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsHelpOpen(true)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#232328] rounded-xl transition-colors"
              title="Help & Guides"
            >
              <HelpCircle size={20} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#232328] rounded-xl transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2"></div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{displayName}</span>
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face"
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border-2 border-blue-500 shadow-sm cursor-pointer"
                  onClick={() => setIsSettingsOpen(true)}
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#1A1A1E] rounded-full"></span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Action Cards & History */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Quick Action Grid - 2x2 layout exactly mirroring the Zoom Desktop Client */}
          <div className="grid grid-cols-2 gap-6">
            <div
              onClick={handleNewMeeting}
              className="flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 dark:from-orange-950/25 dark:to-orange-900/15 rounded-3xl cursor-pointer shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 border border-orange-100/80 dark:border-orange-900/30"
            >
              <div className="w-16 h-16 bg-[#FF7426] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Video size={36} className="text-white" />
              </div>
              <span className="font-bold text-gray-800 dark:text-gray-100 text-base tracking-wide">New Meeting</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">Start instant sync</span>
            </div>

            <div
              onClick={() => setIsJoinOpen(true)}
              className="flex flex-col items-center justify-center p-8 text-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 rounded-3xl cursor-pointer shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 border border-blue-100/50 dark:border-blue-900/30"
            >
              <div className="w-16 h-16 bg-[#0E71EB] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Plus size={36} className="text-white" />
              </div>
              <span className="font-bold text-gray-800 dark:text-gray-100 text-base tracking-wide">Join</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">Join via ID or link</span>
            </div>

            <div
              onClick={() => setIsScheduleOpen(true)}
              className="flex flex-col items-center justify-center p-8 text-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 rounded-3xl cursor-pointer shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 border border-blue-100/50 dark:border-blue-900/30"
            >
              <div className="w-16 h-16 bg-[#0E71EB] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Calendar size={36} className="text-white" />
              </div>
              <span className="font-bold text-gray-800 dark:text-gray-100 text-base tracking-wide">Schedule</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">Plan future calls</span>
            </div>

            <div
              onClick={() => setIsShareScreenOpen(true)}
              className="flex flex-col items-center justify-center p-8 text-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 rounded-3xl cursor-pointer shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 border border-blue-100/50 dark:border-blue-900/30"
            >
              <div className="w-16 h-16 bg-[#0E71EB] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Share2 size={36} className="text-white" />
              </div>
              <span className="font-bold text-gray-800 dark:text-gray-100 text-base tracking-wide">Share Screen</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">Present your desktop</span>
            </div>
          </div>

          {/* Recent Meetings Feed */}
          <div className="pt-2">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <Clock size={20} className="text-gray-400" />
              <span>Recent Meetings (Past 24h)</span>
            </h3>
            <div className="space-y-4">
              {recentMeetings.length === 0 ? (
                <div className="bg-white dark:bg-[#1A1A1E] rounded-2xl p-6 text-center text-gray-500 border border-gray-100 dark:border-[#232328]">
                  No meetings in the past 24 hours.
                </div>
              ) : (
                recentMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between p-5 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-gray-100 dark:border-[#232328] opacity-75 hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">{meeting.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">ID: {meeting.meeting_id}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-400">Ended</span>
                      <Button
                        variant="secondary"
                        onClick={() => router.push(`/join?mid=${meeting.meeting_id}`)}
                        className="text-xs py-1.5 px-3 rounded-lg"
                      >
                        Rejoin
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Clock Hero & Upcoming Meetings */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Clock Hero Widget with premium nature background wallpaper */}
          <div 
            className="relative rounded-3xl p-8 overflow-hidden shadow-lg border border-white/5 flex flex-col justify-end min-h-[220px]"
            style={{ 
              backgroundImage: "url('https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=600&fit=crop')",
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Dark mask overlay to guarantee high-contrast text readability */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-0"></div>
            
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1 select-none">Personal Meeting Room</p>
              <ClockComponent />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1E] rounded-3xl p-6 border border-gray-200/50 dark:border-[#232328] shadow-sm min-h-[300px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <Calendar size={20} className="text-blue-500" />
              <span>Upcoming Meetings</span>
            </h3>

            <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-1">
              {upcomingMeetings.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
                  <Calendar size={48} className="text-gray-200 dark:text-gray-800 mb-3" />
                  <p className="text-sm font-medium">No upcoming meetings</p>
                  <p className="text-xs text-gray-400 mt-1">Schedule a meeting to get started</p>
                </div>
              ) : (
                upcomingMeetings.map((meeting) => {
                  const startTime = new Date(meeting.scheduled_at);
                  const timeFormatted = formatMeetingTime(startTime);
                  const dateFormatted = formatMeetingDate(startTime);

                  return (
                    <div
                      key={meeting.id}
                      className="p-4 bg-gray-50 dark:bg-[#232328] rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full mb-1">
                            {dateFormatted} @ {timeFormatted}
                          </span>
                          <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm line-clamp-1">{meeting.title}</h4>
                          {meeting.description && (
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{meeting.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                        <span className="text-xs text-gray-400">Dur: {meeting.duration_minutes}m</span>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            onClick={() => copyToClipboard(meeting.invite_link, meeting.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#0E71EB] hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            title="Copy Invite Link"
                          >
                            {copiedId === meeting.id ? (
                              <Check size={16} className="text-green-500 animate-pulse" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </Button>
                          <Button
                            variant="primary"
                            onClick={() => router.push(`/join?mid=${meeting.meeting_id}`)}
                            className="text-xs py-1.5 px-3 rounded-lg"
                          >
                            Start
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 pb-3 mb-4 text-xs font-semibold">
          <button 
            type="button"
            onClick={() => setSettingsTab('profile')}
            className={`pb-1 px-1 border-b-2 transition-colors ${
              settingsTab === 'profile' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Video & Audio
          </button>
        </div>

        {settingsTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
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
          <div className="space-y-4 py-2">
            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
              Theme Mode
            </span>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-xl border text-center font-bold text-sm transition-all ${
                  theme === 'light' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-[#0E71EB]' 
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                }`}
              >
                ☀️ Light Mode
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-xl border text-center font-bold text-sm transition-all ${
                  theme === 'dark' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-[#0E71EB]' 
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-800'
                }`}
              >
                🌙 Dark Mode
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'devices' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                Select Camera
              </label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => {
                  setSelectedVideoDevice(e.target.value);
                  sessionStorage.setItem('zoom_clone_video_device', e.target.value);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                Select Microphone
              </label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => {
                  setSelectedAudioDevice(e.target.value);
                  sessionStorage.setItem('zoom_clone_audio_device', e.target.value);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Help & Guides">
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed pr-1 overflow-y-auto max-h-[70vh]">
          <section className="space-y-2">
            <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
              <span>Multi-User Collaboration</span>
            </h4>
            <p className="text-xs">
              To test the synchronized real-time chat, participant lists, and moderation controls, copy the meeting invite link and open it in a <strong>separate incognito browser window</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
              <span>Video & Audio Inputs</span>
            </h4>
            <p className="text-xs">
              Open the settings panel (gear icon) to select your actual connected camera and microphone. In a live meeting room, changing these selectors dynamically switches your media stream in real-time.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
              <span>Screen Sharing</span>
            </h4>
            <p className="text-xs">
              Click <strong>Share Screen</strong> on the dashboard to validate a meeting ID and start presenting immediately, or use the <strong>Share Screen</strong> control inside the live meeting room.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
              <span>Host Moderation & Security</span>
            </h4>
            <p className="text-xs">
              As a meeting host, you can lock the meeting, enable waiting rooms, restrict chat/rename/sharing permissions, mute all microphones, or eject users from the room in real-time.
            </p>
          </section>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setIsHelpOpen(false)}>
              Close Guide
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share Screen Modal */}
      <Modal isOpen={isShareScreenOpen} onClose={() => { setIsShareScreenOpen(false); setShareError(''); }} title="Share Screen">
        <form onSubmit={handleShareScreenSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Enter Meeting ID to share desktop
            </label>
            <input
              type="text"
              placeholder="e.g. 123-456-7890"
              value={shareId}
              onChange={(e) => setShareId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          {shareError && (
            <div className="flex items-center space-x-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
              <AlertCircle size={16} />
              <span>{shareError}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <Button variant="secondary" onClick={() => { setIsShareScreenOpen(false); setShareError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isShareValidating}>
              {isShareValidating ? 'Connecting...' : 'Share'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join Meeting Modal */}
      <Modal isOpen={isJoinOpen} onClose={() => { setIsJoinOpen(false); setJoinError(''); }} title="Join Meeting">
        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Meeting ID or Invite Link
            </label>
            <input
              type="text"
              placeholder="e.g. 123-456-7890"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>

          {joinError && (
            <div className="flex items-center space-x-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
              <AlertCircle size={16} />
              <span>{joinError}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <Button variant="secondary" onClick={() => { setIsJoinOpen(false); setJoinError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isValidating}>
              {isValidating ? 'Validating...' : 'Join'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Meeting Modal */}
      <Modal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Topic</label>
            <input
              type="text"
              placeholder="e.g. Weekly Planning Sync"
              value={scheduleData.title}
              onChange={(e) => setScheduleData({ ...scheduleData, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Description (Optional)</label>
            <textarea
              placeholder="Provide meeting agenda or notes..."
              value={scheduleData.description}
              onChange={(e) => setScheduleData({ ...scheduleData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Date</label>
              <input
                type="date"
                value={scheduleData.date}
                onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Time</label>
              <input
                type="time"
                value={scheduleData.time}
                onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Duration (Minutes)</label>
            <select
              value={scheduleData.duration}
              onChange={(e) => setScheduleData({ ...scheduleData, duration: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232328] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value={15}>15 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={45}>45 Minutes</option>
              <option value={60}>1 Hour</option>
              <option value={90}>1.5 Hours</option>
              <option value={120}>2 Hours</option>
            </select>
          </div>

          {scheduleError && (
            <div className="flex items-center space-x-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
              <AlertCircle size={16} />
              <span>{scheduleError}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <Button variant="secondary" onClick={() => setIsScheduleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isScheduling}>
              {isScheduling ? 'Scheduling...' : 'Schedule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Kicked Modal */}
      <Modal isOpen={isKickedModalOpen} onClose={() => setIsKickedModalOpen(false)} title="Meeting Notification">
        <div className="text-center py-6 space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center text-red-500">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Removed from Meeting</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You have been removed from this meeting by the host.
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => setIsKickedModalOpen(false)} className="w-full">
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
