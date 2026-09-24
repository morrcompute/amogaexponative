import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  ScreenShare,
  ScreenShareOff,
  MonitorUp,
  Volume2,
  SwitchCamera,
  FlipHorizontal2,
  LayoutGrid,
} from 'lucide-react-native';
import { cometchatService } from '../../lib/cometchat-service';

export interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
}

export interface ActiveCallModalProps {
  visible: boolean;
  callState: 'outgoing' | 'active';
  callType: 'audio' | 'video';
  partnerName: string;
  partnerId?: string;
  callToken: string | null;
  sessionId: string;
  onEndCall: () => void;
  isGroupCall?: boolean;
  groupName?: string;
  participantCount?: number;
  participants?: CallParticipant[];
  currentUserId?: string;
  currentUserMobile?: string;
  conversationId?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ActiveCallModal({
  visible,
  callState,
  callType,
  partnerName,
  partnerId,
  callToken,
  sessionId,
  onEndCall,
  isGroupCall = false,
  groupName,
  participantCount = 1,
  participants = [],
  currentUserId,
  currentUserMobile,
  conversationId,
}: ActiveCallModalProps) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraFront, setIsCameraFront] = useState(true); // track which camera is active
  const [callLayout, setCallLayout] = useState<'TILE' | 'SPOTLIGHT'>('TILE');

  // Memoize sessionSettings — using CometChat native recording & screen sharing
  const sessionSettings = useMemo(() => {
    return {
      sessionType: callType === 'audio' ? 'VOICE' : 'VIDEO',
      isAudioOnly: callType === 'audio',
      layout: callLayout,
      defaultLayout: true,
      // Hide CometChat internal header panel so custom 4-icon top bar does not collide
      hideHeaderPanel: true,
      hideSwitchCameraButton: true,
      hideChangeLayoutButton: true,
      // ── Screen Sharing (CometChat Native) ─────────────────────────────────
      isDesktopSharingEnabled: true,
      hideScreenSharingButton: false,       // correct SDK prop (with "ing")
      ShowScreenShareButton: true,
      hideScreenShareButton: false,
      // ── Recording Disabled ────────────────────────────────────────────────
      hideRecordingButton: true,
      ShowRecordingButton: false,
      // ── Call Controls ──────────────────────────────────────────────────────
      hideLeaveSessionButton: false,
      ShowEndCallButton: true,
      hideToggleAudioButton: false,
      ShowMuteAudioButton: true,
      hideToggleVideoButton: callType === 'audio',
      ShowPauseVideoButton: callType === 'video',
      hideAudioModeButton: false,
      ShowAudioModeButton: true,
      // ── Default States ─────────────────────────────────────────────────────
      startAudioMuted: false,
      StartAudioMuted: false,
      startVideoPaused: false,
      StartVideoMuted: false,
      audioMode: 'SPEAKER',
      defaultAudioMode: 'SPEAKER',
      initialCameraFacing: 'FRONT',
      enableSpotlightSwap: true,
      enableSpotlightDrag: true,
      maxParticipantCount: isGroupCall ? 25 : 2,
    };
  }, [callType, isGroupCall, callLayout]);

  // Pulse animation for outgoing calling screen
  useEffect(() => {
    if (!visible || callState !== 'outgoing') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [visible, callState, pulseAnim]);

  const screenStreamRef = useRef<any>(null);
  const localWebStreamRef = useRef<any>(null);
  const webVideoRef = useRef<any>(null);
  const webScreenVideoRef = useRef<any>(null);
  const webCallContainerRef = useRef<any>(null);

  // Stop web media stream and release tracks
  const stopWebMedia = useCallback(() => {
    if (localWebStreamRef.current) {
      try {
        const tracks = localWebStreamRef.current.getTracks ? localWebStreamRef.current.getTracks() : [];
        tracks.forEach((t: any) => {
          try {
            t.stop();
          } catch (_) {}
        });
      } catch (_) {}
      localWebStreamRef.current = null;
    }
  }, []);

  // Stop screen sharing cleanly and release system media tracks
  const stopScreenShare = useCallback(() => {
    try {
      if (cometchatService.isSupported()) {
        console.log('[ScreenShare] Stopping CometChat screen sharing...');
        cometchatService.stopScreenSharing();
      }
      if (screenStreamRef.current) {
        const tracks = screenStreamRef.current.getTracks ? screenStreamRef.current.getTracks() : [];
        tracks.forEach((track: any) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        screenStreamRef.current = null;
      }
    } catch (err) {
      console.warn('[ScreenShare] Error stopping stream tracks:', err);
    }
    setIsScreenSharing(false);
  }, []);

  // Start screen sharing with CometChat WebRTC conference engine or Web MediaDevices fallback
  const startScreenShare = useCallback(async () => {
    try {
      if (cometchatService.isSupported()) {
        console.log('[ScreenShare] Starting CometChat screen sharing via Calls SDK...');
        cometchatService.startScreenSharing();
        setIsScreenSharing(true);
        return;
      }

      // Web / Browser environment fallback
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
        if (nav && nav.mediaDevices && nav.mediaDevices.getDisplayMedia) {
          console.log('[ScreenShare] Requesting browser getDisplayMedia fallback...');
          const stream = await nav.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
          if (stream) {
            screenStreamRef.current = stream;
            setIsScreenSharing(true);

            // Listen for track ending (e.g. user clicks "Stop sharing" in browser banner)
            const videoTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
            if (videoTracks.length > 0) {
              videoTracks[0].onended = () => {
                console.log('[ScreenShare] Browser screen share track ended');
                stopScreenShare();
              };
            }
          }
        } else {
          Alert.alert('Not Supported', 'Screen sharing is not supported in this browser.');
        }
        return;
      }

      // Mobile environment when native calling SDK is not compiled in
      Alert.alert(
        '📺 Screen Share',
        'Screen sharing requires an EAS build with native calling support.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error: any) {
      console.warn('[ScreenShare] Error starting screen share:', error);
      setIsScreenSharing(false);
      const errorMsg = error?.message || String(error || '');
      if (
        !errorMsg.toLowerCase().includes('cancel') &&
        !errorMsg.toLowerCase().includes('denied') &&
        !errorMsg.toLowerCase().includes('abort')
      ) {
        Alert.alert('Screen Share Error', 'Unable to start screen capture: ' + errorMsg);
      }
    }
  }, [stopScreenShare]);

  // On Web, mount CometChat Calls SDK into container when call is active
  useEffect(() => {
    if (Platform.OS !== 'web' || callState !== 'active' || !callToken) return;

    let isMounted = true;
    const mountCall = async () => {
      // Short tick to ensure DOM element is mounted
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!isMounted) return;

      const container =
        webCallContainerRef.current ||
        (typeof document !== 'undefined' ? document.getElementById('cometchat-web-call-container') : null);

      if (container) {
        console.log('[WebCall] Mounting CometChat WebRTC conference into container...');
        const res = await cometchatService.startWebSession(callToken, sessionSettings, container);
        if (!res.success && isMounted) {
          console.warn('[WebCall] Failed to start web session:', res.error);
        }
      } else {
        console.warn('[WebCall] Container element not found for CometChat WebRTC conference');
      }
    };

    mountCall();

    return () => {
      isMounted = false;
      if (Platform.OS === 'web') {
        console.log('[WebCall] Leaving CometChat web session on unmount');
        cometchatService.leaveSession();
      }
    };
  }, [callState, callToken, sessionSettings]);



  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // CometChat camera flip
  const handleSwitchCamera = useCallback(() => {
    cometchatService.switchCamera();
    setIsCameraFront((prev) => !prev);
  }, []);

  // Layout toggle (TILE <-> SPOTLIGHT)
  const handleToggleLayout = useCallback(() => {
    setCallLayout((prev) => (prev === 'TILE' ? 'SPOTLIGHT' : 'TILE'));
  }, []);

  // CometChat mic mute toggle
  const handleToggleMic = useCallback(() => {
    cometchatService.toggleAudio();
    setIsMuted((prev) => !prev);
  }, []);

  // Wrapper for ending call
  const handleEndCall = useCallback(async () => {
    stopScreenShare();
    stopWebMedia();
    onEndCall();
  }, [stopScreenShare, stopWebMedia, onEndCall]);

  // Duration timer & cleanup during active call
  useEffect(() => {
    if (!visible || callState !== 'active') {
      setCallDuration(0);
      stopScreenShare();
      stopWebMedia();
      return;
    }

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      stopScreenShare();
      stopWebMedia();
    };
  }, [visible, callState, stopScreenShare, stopWebMedia]);

  // Setup Web camera & mic stream when call becomes active on Web
  useEffect(() => {
    if (!visible || callState !== 'active' || Platform.OS !== 'web') {
      stopWebMedia();
      return;
    }

    let isMounted = true;
    async function startWebMedia() {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          console.log('[ActiveCallModal Web] Initializing local media stream for call type:', callType);
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video',
          });
          if (!isMounted) {
            stream.getTracks().forEach((t) => {
              try { t.stop(); } catch (_) {}
            });
            return;
          }
          localWebStreamRef.current = stream;

          // Apply current mute and video pause state
          stream.getAudioTracks().forEach((t) => {
            t.enabled = !isMuted;
          });
          stream.getVideoTracks().forEach((t) => {
            t.enabled = !isVideoDisabled;
          });

          // Attach to live video element
          if (webVideoRef.current) {
            webVideoRef.current.srcObject = stream;
            webVideoRef.current.play?.().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[ActiveCallModal Web] Could not acquire local media stream:', err);
      }
    }

    startWebMedia();

    return () => {
      isMounted = false;
      stopWebMedia();
    };
  }, [visible, callState, callType, stopWebMedia]);

  // Sync mic mute state to web audio tracks
  useEffect(() => {
    if (Platform.OS === 'web' && localWebStreamRef.current) {
      try {
        localWebStreamRef.current.getAudioTracks?.().forEach((t: any) => {
          t.enabled = !isMuted;
        });
      } catch (_) {}
    }
  }, [isMuted]);

  // Sync video pause state to web video tracks
  useEffect(() => {
    if (Platform.OS === 'web' && localWebStreamRef.current) {
      try {
        localWebStreamRef.current.getVideoTracks?.().forEach((t: any) => {
          t.enabled = !isVideoDisabled;
        });
      } catch (_) {}
    }
  }, [isVideoDisabled]);

  // Sync web screen sharing video ref
  useEffect(() => {
    if (Platform.OS === 'web' && isScreenSharing && screenStreamRef.current && webScreenVideoRef.current) {
      try {
        webScreenVideoRef.current.srcObject = screenStreamRef.current;
        webScreenVideoRef.current.play?.().catch(() => {});
      } catch (_) {}
    }
  }, [isScreenSharing]);

  // CometChat native event listeners (session & screen share)
  useEffect(() => {
    if (!visible || callState !== 'active' || !cometchatService.isSupported()) return;

    const controller = new AbortController();
    const { signal } = controller;

    cometchatService.addEventListener('onSessionLeft', () => {
      console.log('[CometChat] Session left');
      handleEndCall();
    }, { signal });

    cometchatService.addEventListener('onLeaveSessionButtonClicked', () => {
      console.log('[CometChat] Leave button clicked');
      cometchatService.leaveSession();
      handleEndCall();
    }, { signal });

    cometchatService.addEventListener('onSessionTimedOut', () => {
      console.log('[CometChat] Session timed out');
      handleEndCall();
    }, { signal });

    // ── Screen share events ───────────────────────────────────────────────────
    cometchatService.addEventListener('onScreenShareStarted', () => {
      setIsScreenSharing(true);
    }, { signal });

    cometchatService.addEventListener('onScreenShareStopped', () => {
      setIsScreenSharing(false);
    }, { signal });

    cometchatService.addEventListener('onParticipantStartedScreenShare', () => {
      setIsScreenSharing(true);
    }, { signal });

    cometchatService.addEventListener('onParticipantStoppedScreenShare', () => {
      setIsScreenSharing(false);
    }, { signal });

    return () => {
      controller.abort();
    };
  }, [visible, callState, handleEndCall, conversationId, currentUserId, partnerId, callType]);



  if (!visible) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const titleText = isGroupCall ? (groupName || 'Group Call') : partnerName;

  const initials =
    titleText
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || (isGroupCall ? 'GP' : 'AM');

  const isNativeSupported = cometchatService.isSupported();
  const sdk = cometchatService.getSDK();
  const CometChatComponent = sdk?.Component;

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0);
  const bottomInset = Math.max(insets.bottom, 16);

  // Fallback demo participants if list empty in group mode
  const displayParticipants: CallParticipant[] =
    participants.length > 0
      ? participants
      : isGroupCall
      ? [
          { id: '1', name: 'You (Host)', isSpeaking: true },
          { id: '2', name: partnerName || 'Alex', isMuted: false },
          { id: '3', name: 'Sarah M.', isMuted: true },
          { id: '4', name: 'David K.', isMuted: false },
        ]
      : [{ id: '1', name: partnerName, isSpeaking: true }];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onEndCall}
    >
      <View style={styles.container}>
        {callState === 'outgoing' ? (
          /* ───────────── OUTGOING RINGING STATE ───────────── */
          <View
            style={[
              styles.outgoingContainer,
              { paddingTop: topInset + 20, paddingBottom: bottomInset + 20 },
            ]}
          >
            <View style={styles.badgeRow}>
              {isGroupCall && <Users size={14} color="#38bdf8" style={{ marginRight: 6 }} />}
              <Text style={styles.callTypeLabel}>
                {isGroupCall
                  ? (callType === 'video' ? 'Outgoing Group Video Call' : 'Outgoing Group Audio Call')
                  : (callType === 'video' ? 'Outgoing Video Call' : 'Outgoing Audio Call')}
              </Text>
            </View>

            <Animated.View
              style={[
                styles.pulseRing,
                isGroupCall && styles.groupPulseRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={[styles.avatarCircle, isGroupCall && styles.groupAvatarCircle]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </Animated.View>

            <Text style={styles.partnerName} numberOfLines={1}>
              {titleText}
            </Text>
            <Text style={styles.statusText}>
              {isGroupCall ? 'Calling group members...' : 'Ringing...'}
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.hangupBtn}
              onPress={onEndCall}
              accessibilityRole="button"
              accessibilityLabel="Cancel Call"
            >
              <PhoneOff size={32} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          /* ───────────── ACTIVE CALL STATE ───────────── */
          <View style={styles.activeContainer}>
            {callToken && ((Platform.OS !== 'web' && CometChatComponent) || Platform.OS === 'web') ? (
              /* CometChat WebRTC Calling Component (Native & Web) with Safe Area Insets & Custom Controls Overlay */
              <View
                style={[
                  styles.nativeCallWrapper,
                  {
                    paddingTop: topInset,
                    paddingBottom: bottomInset,
                  },
                ]}
              >
                {Platform.OS === 'web' ? (
                  React.createElement('div', {
                    id: 'cometchat-web-call-container',
                    ref: webCallContainerRef,
                    style: {
                      width: '100%',
                      height: '100%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#0a0f1d',
                      zIndex: 1,
                    },
                  })
                ) : (
                  <CometChatComponent
                    callToken={callToken}
                    sessionSettings={sessionSettings}
                    callSettings={sessionSettings}
                  />
                )}


                {/* ── Top Bar: Duration/Group Badge on Left, 3 Control Icons on Right in ONE Row ── */}
                <View
                  pointerEvents="box-none"
                  style={[
                    styles.nativeTopOverlay,
                    { top: topInset + 10 },
                  ]}
                >
                  {/* Left: Call Timer or Group Badge */}
                  {isGroupCall ? (
                    <View style={styles.nativeGroupBadge}>
                      <Users size={13} color="#38bdf8" style={{ marginRight: 5 }} />
                      <Text style={styles.nativeGroupBadgeText} numberOfLines={1}>
                        {groupName || 'Group Call'} ({participantCount})
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.nativeTimerBadge}>
                      <View style={styles.timerLiveDot} />
                      <Text style={styles.nativeTimerText}>{formatDuration(callDuration)}</Text>
                    </View>
                  )}

                  {/* Right side: Control Icons in a single, neat horizontal row */}
                  <View style={styles.nativeActionBtnsRow}>
                    {/* 1. Camera Switch (front / back) */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.nativeActionIconBtn,
                        callType === 'audio' && styles.nativeActionIconBtnDisabled,
                      ]}
                      onPress={handleSwitchCamera}
                      disabled={callType === 'audio'}
                      accessibilityRole="button"
                      accessibilityLabel="Switch Camera"
                    >
                      <SwitchCamera size={18} color={callType === 'audio' ? '#64748b' : '#ffffff'} />
                    </TouchableOpacity>

                    {/* 2. Layout Switch (Grid / Spotlight) */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.nativeActionIconBtn,
                        callLayout === 'SPOTLIGHT' && styles.nativeLayoutIconBtnActive,
                      ]}
                      onPress={handleToggleLayout}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle Layout"
                    >
                      <LayoutGrid size={18} color={callLayout === 'SPOTLIGHT' ? '#38bdf8' : '#ffffff'} />
                    </TouchableOpacity>

                    {/* 3. Screen Share (CometChat screen sharing) */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.nativeActionIconBtn,
                        isScreenSharing && styles.nativeScreenShareIconBtnActive,
                      ]}
                      onPress={toggleScreenShare}
                      accessibilityRole="button"
                      accessibilityLabel={isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share'}
                    >
                      {isScreenSharing ? (
                        <ScreenShareOff size={18} color="#ffffff" />
                      ) : (
                        <ScreenShare size={18} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Screen Share Active Banner */}
                {isScreenSharing && (
                  <View
                    pointerEvents="box-none"
                    style={[
                      styles.nativeIndicatorBanner,
                      { top: topInset + 58 },
                    ]}
                  >
                    <View style={styles.screenShareBannerInner}>
                      <MonitorUp size={14} color="#10b981" style={{ marginRight: 6 }} />
                      <Text style={styles.screenShareText}>Sharing Screen</Text>
                      <TouchableOpacity
                        onPress={stopScreenShare}
                        style={styles.stopShareBtn}
                      >
                        <Text style={styles.stopShareText}>Stop</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* Fallback / Web & Preview Calling Screen with Group & Screen Sharing UI */
              <View
                style={[
                  styles.fallbackContainer,
                  { paddingTop: topInset + 10, paddingBottom: bottomInset + 10 },
                ]}
              >
                {/* Header Information Bar */}
                <View style={styles.headerInfo}>
                  <View style={styles.topBadgeRow}>
                    {isGroupCall && (
                      <View style={styles.participantCountBadge}>
                        <Users size={12} color="#38bdf8" style={{ marginRight: 4 }} />
                        <Text style={styles.participantCountText}>
                          {isGroupCall ? `${displayParticipants.length} in call` : '1-on-1'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.callTypeBadge}>
                      {callType === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}
                    </Text>
                  </View>

                  <Text style={styles.partnerNameSmall}>{titleText}</Text>
                  <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
                </View>

                {/* Screen Share Active Banner */}
                {isScreenSharing && (
                  <View style={styles.screenShareBanner}>
                    <MonitorUp size={16} color="#10b981" style={{ marginRight: 8 }} />
                    <Text style={styles.screenShareText}>You are sharing your screen</Text>
                    <TouchableOpacity
                      onPress={stopScreenShare}
                      style={styles.stopShareBtn}
                    >
                      <Text style={styles.stopShareText}>Stop</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Center Stage: Multi-Participant Grid or Spotlight */}
                {isGroupCall ? (
                  <ScrollView
                    contentContainerStyle={styles.groupGridContainer}
                    showsVerticalScrollIndicator={false}
                  >
                    {displayParticipants.map((p, idx) => {
                      const pInitials = p.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <View
                          key={p.id || idx}
                          style={[
                            styles.groupParticipantCard,
                            p.isSpeaking && styles.participantSpeakingGlow,
                          ]}
                        >
                          <View style={styles.participantAvatar}>
                            <Text style={styles.participantAvatarText}>{pInitials}</Text>
                          </View>
                          <Text style={styles.participantNameText} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <View style={styles.participantStatusRow}>
                            {p.isMuted ? (
                              <MicOff size={12} color="#ef4444" />
                            ) : (
                              <Volume2 size={12} color="#10b981" />
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.centerStage}>
                    {Platform.OS === 'web' && isScreenSharing && screenStreamRef.current ? (
                      <View style={styles.webVideoContainer}>
                        {React.createElement('video', {
                          ref: webScreenVideoRef,
                          autoPlay: true,
                          playsInline: true,
                          muted: true,
                          style: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            backgroundColor: '#000000',
                            borderRadius: 16,
                          },
                        })}
                        <View style={styles.webVideoBadge}>
                          <Text style={styles.webVideoBadgeText}>Your Shared Screen</Text>
                        </View>
                      </View>
                    ) : Platform.OS === 'web' && callType === 'video' && !isVideoDisabled ? (
                      <View style={styles.webVideoContainer}>
                        {React.createElement('video', {
                          ref: webVideoRef,
                          autoPlay: true,
                          playsInline: true,
                          muted: true, // Local preview muted to prevent audio feedback loop
                          style: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            backgroundColor: '#0f172a',
                            borderRadius: 16,
                            transform: isCameraFront ? 'scaleX(-1)' : 'none',
                          },
                        })}
                        <View style={styles.webVideoBadge}>
                          <Text style={styles.webVideoBadgeText}>You (Live Camera)</Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.bigAvatar}>
                          <Text style={styles.bigAvatarText}>{initials}</Text>
                        </View>
                        <Text style={styles.connectedBadge}>
                          {isNativeSupported ? 'Connected via CometChat' : 'Connected'}
                        </Text>
                        {Platform.OS !== 'web' && !isNativeSupported && (
                          <Text style={styles.devNote}>
                            (Native WebRTC active in EAS Dev Build. Previewing UI layout & signaling)
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Action Control Dock */}
                <View style={styles.controlsRow}>
                  {/* Mic Toggle */}
                  <TouchableOpacity
                    style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                    onPress={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? (
                      <MicOff size={22} color="#ef4444" />
                    ) : (
                      <Mic size={22} color="#ffffff" />
                    )}
                  </TouchableOpacity>

                  {/* Video Toggle */}
                  {callType === 'video' && (
                    <TouchableOpacity
                      style={[styles.controlBtn, isVideoDisabled && styles.controlBtnActive]}
                      onPress={() => setIsVideoDisabled(!isVideoDisabled)}
                    >
                      {isVideoDisabled ? (
                        <VideoOff size={22} color="#ef4444" />
                      ) : (
                        <Video size={22} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Screen Share Toggle */}
                  <TouchableOpacity
                    style={[styles.controlBtn, isScreenSharing && styles.screenShareBtnActive]}
                    onPress={toggleScreenShare}
                    accessibilityRole="button"
                    accessibilityLabel={isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share'}
                  >
                    {isScreenSharing ? (
                      <ScreenShareOff size={22} color="#10b981" />
                    ) : (
                      <ScreenShare size={22} color="#ffffff" />
                    )}
                  </TouchableOpacity>

                  {/* Hangup / End Call */}
                  <TouchableOpacity
                    style={[styles.controlBtn, styles.hangupBtnSmall]}
                    onPress={handleEndCall}
                  >
                    <PhoneOff size={26} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#090d16',
  },
  outgoingContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
  },
  callTypeLabel: {
    fontSize: 14,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  pulseRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    marginBottom: 32,
  },
  groupPulseRing: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarCircle: {
    backgroundColor: '#0284c7',
  },
  avatarText: {
    fontSize: 44,
    fontWeight: '700',
    color: '#ffffff',
  },
  partnerName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#38bdf8',
    fontWeight: '500',
    marginBottom: 64,
  },
  hangupBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  activeContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  nativeCallWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  fallbackContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#090d16',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerInfo: {
    alignItems: 'center',
    width: '100%',
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  participantCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  participantCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
  callTypeBadge: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  partnerNameSmall: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  timerText: {
    fontSize: 15,
    color: '#38bdf8',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  screenShareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 10,
  },
  screenShareText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 10,
  },
  stopShareBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stopShareText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  groupGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    width: SCREEN_WIDTH - 40,
  },
  groupParticipantCard: {
    width: (SCREEN_WIDTH - 64) / 2,
    height: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  participantSpeakingGlow: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  participantAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  participantNameText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '85%',
  },
  participantStatusRow: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: 4,
  },
  bigAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bigAvatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
  },
  connectedBadge: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  devNote: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  screenShareBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  hangupBtnSmall: {
    backgroundColor: '#ef4444',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  nativeTopOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 999,
  },
  nativeTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timerLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  nativeTimerText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  nativeActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nativeGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    maxWidth: SCREEN_WIDTH - 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  nativeGroupBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
  nativeActionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  nativeActionIconBtnDisabled: {
    opacity: 0.35,
  },
  nativeScreenShareIconBtnActive: {
    backgroundColor: '#10b981',
    borderColor: '#34d399',
  },
  nativeLayoutIconBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38bdf8',
  },
  nativeIndicatorBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  screenShareBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  webVideoContainer: {
    width: Math.min(SCREEN_WIDTH - 40, 560),
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  webVideoBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  webVideoBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
