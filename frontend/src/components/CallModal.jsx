import { useState, useEffect, useCallback } from 'react';
import { Phone, Video, VideoOff, Mic, MicOff, PhoneOff, X, Clock, User } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const CallModal = () => {
  const [callState, setCallState] = useState({
    isOpen: false,
    isInCall: false,
    isReceiving: false,
    callType: null,
    caller: null,
    callee: null,
    callId: null,
    isMuted: false,
    isVideoOff: false,
    callStartTime: null,
    callDuration: 0,
  });

  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    const checkForIncomingCalls = async () => {
      try {
        const response = await api.get('/calls/incoming');
        const calls = response.data.data;
        if (calls && Array.isArray(calls) && calls.length > 0) {
          const firstCall = calls[0];
          setIncomingCall(firstCall);
          setCallState(prev => ({
            ...prev,
            isOpen: true,
            isReceiving: true,
            caller: { name: firstCall.callerName },
            callId: firstCall.id,
            callType: firstCall.callType,
          }));
        }
      } catch (error) {
        // Silently handle - no incoming calls is normal
      }
    };

    const interval = setInterval(checkForIncomingCalls, 5000);
    checkForIncomingCalls();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer;
    if (callState.isInCall && callState.callStartTime) {
      timer = setInterval(() => {
        setCallState(prev => ({
          ...prev,
          callDuration: Math.floor((Date.now() - prev.callStartTime) / 1000),
        }));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState.isInCall, callState.callStartTime]);

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = async (userId, type) => {
    try {
      const response = await api.post('/calls', {
        calleeId: userId,
        type,
      });
      setCallState(prev => ({
        ...prev,
        isOpen: true,
        isInCall: true,
        callType: type,
        callId: response.data.data.id,
        callStartTime: Date.now(),
      }));
      toast.success(`Calling...`);
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to start call');
    }
  };

  const handleAcceptCall = async () => {
    try {
      await api.post(`/calls/${callState.callId}/accept`);
      setCallState(prev => ({
        ...prev,
        isReceiving: false,
        isInCall: true,
        callStartTime: Date.now(),
      }));
      toast.success('Call connected');
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Failed to accept call');
    }
  };

  const handleDeclineCall = async () => {
    try {
      await api.post(`/calls/${callState.callId}/decline`);
      setCallState(prev => ({
        ...prev,
        isOpen: false,
        isReceiving: false,
        caller: null,
        callId: null,
      }));
      setIncomingCall(null);
    } catch (error) {
      console.error('Error declining call:', error);
      setCallState(prev => ({
        ...prev,
        isOpen: false,
        isReceiving: false,
        caller: null,
        callId: null,
      }));
    }
  };

  const handleEndCall = async () => {
    try {
      if (callState.callId) {
        await api.post(`/calls/${callState.callId}/end`);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
    setCallState(prev => ({
      ...prev,
      isOpen: false,
      isInCall: false,
      isReceiving: false,
      callId: null,
      callStartTime: null,
      callDuration: 0,
      isMuted: false,
      isVideoOff: false,
    }));
    setIncomingCall(null);
  };

  const handleToggleMute = async () => {
    try {
      await api.post(`/calls/${callState.callId}/mute`, {
        muted: !callState.isMuted,
      });
      setCallState(prev => ({
        ...prev,
        isMuted: !prev.isMuted,
      }));
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleToggleVideo = async () => {
    try {
      await api.post(`/calls/${callState.callId}/video`, {
        off: !callState.isVideoOff,
      });
      setCallState(prev => ({
        ...prev,
        isVideoOff: !prev.isVideoOff,
      }));
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  const handleCloseModal = () => {
    if (callState.isReceiving) {
      handleDeclineCall();
    } else if (callState.isInCall) {
      handleEndCall();
    } else {
      setCallState(prev => ({
        ...prev,
        isOpen: false,
      }));
    }
  };

  if (!callState.isOpen) return null;

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-deep/80 backdrop-blur-md" onClick={handleCloseModal}></div>
      
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-slide-up border border-white/20 bg-base-100">
        <div className={`p-8 ${
          callState.isReceiving 
            ? 'bg-gradient-to-br from-brand-vibrant/10 to-emerald-500/10' 
            : 'bg-gradient-to-br from-brand-deep/5 to-brand-vibrant/5'
        }`}>
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className={`relative ${
                callState.isReceiving ? 'animate-pulse' : ''
              }`}>
                {callState.caller?.avatarUrl || callState.callee?.avatarUrl ? (
                  <img
                    src={callState.caller?.avatarUrl || callState.callee?.avatarUrl}
                    alt={callState.caller?.name ? `${callState.caller.name}'s profile picture` : callState.callee?.name ? `${callState.callee.name}'s profile picture` : 'Caller profile picture'}
                    className="w-20 h-20 rounded-full object-cover border-4 border-brand-vibrant/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-vibrant/30 to-emerald-500/30 flex items-center justify-center border-4 border-brand-vibrant/20">
                    <User size={32} className="text-brand-vibrant" />
                  </div>
                )}
                {callState.isInCall && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center border-2 border-base-100">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-black text-base-content">
                  {callState.isReceiving 
                    ? callState.caller?.name || 'Incoming Call'
                    : 'In Call'}
                </h2>
                {callState.isInCall && (
                  <div className="flex items-center gap-1.5 text-base-content/60 mt-1">
                    <Clock size={14} />
                    <span className="text-sm font-medium">{formatDuration(callState.callDuration)}</span>
                  </div>
                )}
                {callState.isReceiving && (
                  <p className="text-sm text-base-content/50 mt-1">
                    {callState.callType === 'video' ? 'Video Call' : 'Audio Call'}
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={handleCloseModal}
              className="p-2 hover:bg-base-200/50 rounded-full transition-colors text-base-content/40"
            >
              <X size={24} />
            </button>
          </div>

          {callState.isReceiving && (
            <div className="mb-4 p-4 rounded-xl bg-base-200/50 border border-base-300/50">
              <p className="text-sm text-base-content/70 text-center">
                <span className="font-bold text-brand-vibrant">{callState.caller?.name}</span> is calling you
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-base-100">
          {callState.isReceiving ? (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleDeclineCall}
                className="w-16 h-16 rounded-full bg-error/10 hover:bg-error/20 text-error flex items-center justify-center transition-all transform hover:scale-105"
              >
                <PhoneOff size={28} />
              </button>
              <button
                onClick={handleAcceptCall}
                className="w-20 h-20 rounded-full bg-success/10 hover:bg-success/20 text-success flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-success/20"
              >
                {callState.callType === 'video' ? (
                  <Video size={36} />
                ) : (
                  <Phone size={36} />
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={handleToggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                    callState.isMuted 
                      ? 'bg-error/10 text-error' 
                      : 'bg-base-200 text-base-content/70 hover:bg-base-200/80'
                  }`}
                  title={callState.isMuted ? 'Unmute' : 'Mute'}
                >
                  {callState.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                
                <button
                  onClick={handleToggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                    callState.isVideoOff 
                      ? 'bg-error/10 text-error' 
                      : 'bg-base-200 text-base-content/70 hover:bg-base-200/80'
                  }`}
                  title={callState.isVideoOff ? 'Turn on video' : 'Turn off video'}
                >
                  {callState.isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>
              </div>

              <button
                onClick={handleEndCall}
                className="w-full py-4 rounded-xl bg-error text-white font-bold text-sm hover:bg-error/90 transition-all flex items-center justify-center gap-2"
              >
                <PhoneOff size={20} />
                End Call
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;

export const useCallModal = () => {
  const [callInitiator, setCallInitiator] = useState(null);

  const initiateCall = useCallback((userId, type) => {
    setCallInitiator({ userId, type });
  }, []);

  return { callInitiator, initiateCall };
};
