import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  useWindowDimensions,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
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
  MessageSquare,
  Send,
  X,
} from 'lucide-react-native';
import { cometchatService } from '../../lib/cometchat-service';
import { supabase } from '../../lib/supabase';

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
  currentUserName?: string;
  conversationId?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Immediately hide CometChat default header panel and participant list button on web so only our 3 custom icons show
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'cometchat-hide-header-style';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      .cometchat-calls-header-container,
      .cometchat-calls-header-actions,
      .cometchat-calls-header-action-button,
      .cometchat-calls-header-layout-dropdown,
      [class*="cometchat-calls-header"],
      [class*="header-action"],
      [class*="header-container"],
      [class*="participant-list-button"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

interface InCallMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  isSelf: boolean;
}

interface InCallChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  inCallMessages: InCallMessage[];
  chatInputText: string;
  setChatInputText: (text: string) => void;
  onSendMessage: () => void;
  chatScrollRef: React.RefObject<ScrollView | null>;
  topInset: number;
  bottomInset: number;
}

function InCallChatSidebar({
  isOpen,
  onClose,
  isMobile,
  inCallMessages,
  chatInputText,
  setChatInputText,
  onSendMessage,
  chatScrollRef,
  topInset,
  bottomInset,
}: InCallChatSidebarProps) {
  if (!isOpen) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        isMobile ? styles.mobileChatOverlay : styles.desktopChatSidebar,
        isMobile && { paddingTop: topInset + 8, paddingBottom: bottomInset + 8 },
      ]}
    >
      {/* Top Header Bar */}
      <View style={styles.chatSidebarHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.chatHeaderIconBadge}>
            <MessageSquare size={16} color="#38bdf8" />
          </View>
          <Text style={styles.chatSidebarTitle}>In-call messages</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onClose}
          style={styles.chatCloseBtn}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Info Notice (Google Meet / Zoom style) */}
      <View style={styles.chatNoticeBanner}>
        <Text style={styles.chatNoticeText}>
          Messages can be seen only by people in the call.
        </Text>
      </View>

      {/* Message List */}
      <ScrollView
        ref={chatScrollRef}
        style={styles.chatMessageScroll}
        contentContainerStyle={[
          styles.chatMessageContent,
          inCallMessages.length === 0 && { justifyContent: 'center', alignItems: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {inCallMessages.length === 0 ? (
          <View style={styles.chatEmptyState}>
            <View style={styles.chatEmptyIconCircle}>
              <MessageSquare size={28} color="#475569" />
            </View>
            <Text style={styles.chatEmptyTitle}>No messages yet</Text>
            <Text style={styles.chatEmptySub}>
              Send a message to everyone in the call.
            </Text>
          </View>
        ) : (
          inCallMessages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.chatMsgItem,
                msg.isSelf ? styles.chatMsgItemSelf : styles.chatMsgItemOther,
              ]}
            >
              <View style={styles.chatMsgHeader}>
                <Text
                  style={[
                    styles.chatMsgSender,
                    { color: msg.isSelf ? '#34d399' : '#38bdf8' },
                  ]}
                  numberOfLines={1}
                >
                  {msg.senderName}
                </Text>
                <Text style={styles.chatMsgTime}>{msg.time}</Text>
              </View>
              <View
                style={[
                  styles.chatBubble,
                  msg.isSelf ? styles.chatBubbleSelf : styles.chatBubbleOther,
                ]}
              >
                <Text style={styles.chatBubbleText}>{msg.text}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Message Input Bar */}
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatTextInput}
          placeholder="Send a message to everyone..."
          placeholderTextColor="#64748b"
          value={chatInputText}
          onChangeText={setChatInputText}
          returnKeyType="send"
          onSubmitEditing={onSendMessage}
          onKeyPress={(e: any) => {
            if (Platform.OS === 'web' && e.nativeEvent?.key === 'Enter' && !e.shiftKey) {
              e.preventDefault?.();
              onSendMessage();
            }
          }}
          multiline={false}
        />
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onSendMessage}
          disabled={!chatInputText.trim()}
          style={[
            styles.chatSendBtn,
            chatInputText.trim() ? styles.chatSendBtnActive : styles.chatSendBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Submit message"
        >
          <Send size={15} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

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
  currentUserName,
  conversationId,
}: ActiveCallModalProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= 768;
  const isMobile = Platform.OS !== 'web' || windowWidth < 768;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraFront, setIsCameraFront] = useState(true); // track which camera is active
  const [callLayout, setCallLayout] = useState<'TILE' | 'SPOTLIGHT'>('TILE');

  // In-Call Chat State (Google Meet / Zoom style sidechat)
  const [isSideChatOpen, setIsSideChatOpen] = useState(false);
  const [inCallMessages, setInCallMessages] = useState<
    Array<{ id: string; senderId: string; senderName: string; text: string; time: string; isSelf: boolean }>
  >([]);
  const [chatInputText, setChatInputText] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatScrollRef = useRef<ScrollView | null>(null);

  const screenStreamRef = useRef<any>(null);
  const localWebStreamRef = useRef<any>(null);
  const webVideoRef = useRef<any>(null);
  const webScreenVideoRef = useRef<any>(null);
  const webCallContainerRef = useRef<any>(null);

  const isSideChatOpenRef = useRef(isSideChatOpen);
  useEffect(() => {
    isSideChatOpenRef.current = isSideChatOpen;
  }, [isSideChatOpen]);

  const chatChannelRef = useRef<any>(null);
  const [latestChatMessage, setLatestChatMessage] = useState<{ senderName: string; text: string } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Listen for in-call chat broadcast messages via Supabase
  useEffect(() => {
    if (!visible || callState !== 'active' || !sessionId) return;

    console.log(`[InCallChat] Subscribing to call_chat_${sessionId}...`);
    const channel = supabase.channel(`call_chat_${sessionId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'new_message' }, ({ payload }: any) => {
        console.log('[InCallChat] Received incoming broadcast message:', payload);
        if (!payload || !payload.text) return;
        const isFromSelf = payload.senderId === currentUserId;
        if (isFromSelf) return;

        const newMsg = {
          id: payload.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          senderId: payload.senderId || 'participant',
          senderName: payload.senderName || 'Participant',
          text: payload.text,
          time: payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: false,
        };

        setInCallMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        if (!isSideChatOpenRef.current) {
          setUnreadChatCount((prev) => prev + 1);
          setLatestChatMessage({ senderName: newMsg.senderName, text: newMsg.text });
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => {
            setLatestChatMessage(null);
          }, 4500);
        }

        setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      })
      .subscribe((status) => {
        console.log(`[InCallChat] Channel status for call_chat_${sessionId}:`, status);
      });

    chatChannelRef.current = channel;

    return () => {
      chatChannelRef.current = null;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [visible, callState, sessionId, currentUserId]);

  // Send an in-call message
  const handleSendInCallMessage = useCallback(async () => {
    const trimmed = chatInputText.trim();
    if (!trimmed || !sessionId) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `incall_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const myName = currentUserName || 'You';

    const localMsg = {
      id: msgId,
      senderId: currentUserId || 'me',
      senderName: myName,
      text: trimmed,
      time: timeStr,
      isSelf: true,
    };

    setInCallMessages((prev) => [...prev, localMsg]);
    setChatInputText('');

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);

    // Directly transmit via active broadcast channel
    try {
      let ch = chatChannelRef.current;
      if (!ch) {
        ch = supabase.channel(`call_chat_${sessionId}`, {
          config: { broadcast: { self: false } },
        });
        chatChannelRef.current = ch;
      }

      const payload = {
        id: msgId,
        senderId: currentUserId || 'me',
        senderName: myName,
        text: trimmed,
        time: timeStr,
      };

      console.log('[InCallChat] Broadcasting message:', payload);
      if (ch.state === 'joined') {
        const res = await ch.send({
          type: 'broadcast',
          event: 'new_message',
          payload,
        });
        console.log('[InCallChat] Broadcast send result:', res);
      } else {
        ch.subscribe(async (status: string) => {
          console.log('[InCallChat] Late subscribe status:', status);
          if (status === 'SUBSCRIBED') {
            const res = await ch.send({
              type: 'broadcast',
              event: 'new_message',
              payload,
            });
            console.log('[InCallChat] Late broadcast send result:', res);
          }
        });
      }
    } catch (e) {
      console.warn('[InCallChat] Error broadcasting message:', e);
    }

    // Persist into chat_messages if conversationId is provided
    if (conversationId && currentUserId) {
      try {
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          owner_user_id: currentUserId,
          sender_user_id: currentUserId,
          message: trimmed,
          message_type: 'text',
          direction: 'Sent',
          sent: true,
          received: false,
        });
      } catch (_) {}
    }
  }, [chatInputText, sessionId, currentUserId, currentUserName, conversationId]);

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

  // Wrapper for ending call cleanly
  const handleEndCall = useCallback(async () => {
    console.log('[ActiveCallModal] handleEndCall initiated');
    setIsSideChatOpen(false);
    setInCallMessages([]);
    setUnreadChatCount(0);
    setLatestChatMessage(null);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    stopScreenShare();
    stopWebMedia();
    cometchatService.leaveSession();
    onEndCall();
  }, [stopScreenShare, stopWebMedia, onEndCall]);

  // Memoize sessionSettings — configured for Desktop Web & Mobile APK
  const sessionSettings = useMemo(() => {
    return {
      sessionType: callType === 'audio' ? 'VOICE' : 'VIDEO',
      isAudioOnly: callType === 'audio',
      mode: callLayout === 'TILE' ? 'SIDEBAR' : 'SPOTLIGHT',
      layout: callLayout === 'TILE' ? 'SIDEBAR' : 'SPOTLIGHT',
      defaultLayout: true,
      enableDefaultLayout: true,
      hideHeaderPanel: true,
      ShowHeaderPanel: false,
      hideSwitchCameraButton: true,
      ShowSwitchCameraButton: false,
      hideParticipantListButton: true,
      ShowParticipantListButton: false,
      hideChatButton: true,
      ShowChatButton: false,
      hideShareInviteButton: true,
      ShowShareInviteButton: false,
      // ── Custom CSS to completely remove CometChat internal top header & participant icons ──
      customCSS: `
        .cometchat-calls-header-container,
        .cometchat-calls-header-actions,
        .cometchat-calls-header-action-button,
        [class*="header-action"],
        [class*="header-container"],
        [class*="participant-list-button"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `,
      // ── Desktop Layout & Controls (all docked at bottom) ─────────────────
      hideChangeLayoutButton: false,
      ShowSwitchModeButton: true,
      ShowVirtualBackgroundSetting: true,
      hideVirtualBackgroundButton: false,
      hideRaiseHandButton: false,
      // ── Screen Sharing (CometChat Native) ─────────────────────────────────
      isDesktopSharingEnabled: true,
      hideScreenSharingButton: false,
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
      // ── Call Listener: binds CometChat leave button directly to React state ─
      getCallListener: () => ({
        onCallEndButtonPressed: () => {
          console.log('[WebCall] onCallEndButtonPressed fired from CometChat SDK');
          handleEndCall();
        },
        onCallEnded: () => {
          console.log('[WebCall] onCallEnded fired from CometChat SDK');
          handleEndCall();
        },
        onUserLeft: (u: any) => {
          console.log('[WebCall] onUserLeft fired:', u);
          if (!isGroupCall) {
            handleEndCall();
          }
        },
        onSessionTimeout: () => {
          console.log('[WebCall] onSessionTimeout fired');
          handleEndCall();
        },
        onScreenShareStarted: () => {
          console.log('[WebCall] onScreenShareStarted fired');
          setIsScreenSharing(true);
        },
        onScreenShareStopped: () => {
          console.log('[WebCall] onScreenShareStopped fired');
          setIsScreenSharing(false);
        },
      }),
    };
  }, [callType, isGroupCall, callLayout, handleEndCall]);

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

  const sessionSettingsRef = useRef(sessionSettings);
  useEffect(() => {
    sessionSettingsRef.current = sessionSettings;
  }, [sessionSettings]);

  // On Web, mount CometChat Calls SDK into container when call is active
  useEffect(() => {
    if (Platform.OS !== 'web' || callState !== 'active' || !callToken) return;

    let isMounted = true;
    let retries = 0;

    const mountCall = async () => {
      while (isMounted && retries < 15) {
        const container =
          webCallContainerRef.current ||
          (typeof document !== 'undefined' ? document.getElementById('cometchat-web-call-container') : null);

        if (container) {
          if (typeof document !== 'undefined') {
            const styleId = 'cometchat-hide-header-style';
            if (!document.getElementById(styleId)) {
              const styleEl = document.createElement('style');
              styleEl.id = styleId;
              styleEl.innerHTML = `
                .cometchat-calls-header-container,
                .cometchat-calls-header-actions,
                .cometchat-calls-header-action-button,
                [class*="header-action"],
                [class*="header-container"],
                [class*="participant-list-button"] {
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                  pointer-events: none !important;
                }
              `;
              document.head.appendChild(styleEl);
            }
          }
          console.log('[WebCall] Mounting CometChat WebRTC conference into container...');
          const res = await cometchatService.startWebSession(callToken, sessionSettingsRef.current || sessionSettings, container);
          if (!res.success && isMounted) {
            console.warn('[WebCall] Failed to start web session:', res.error);
          } else if (isMounted) {
            console.log('[WebCall] WebRTC session mounted successfully');
          }
          return;
        }

        retries++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (isMounted) {
        console.warn('[WebCall] Container element not found after retries');
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
  }, [callState, callToken]);




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
    setCallLayout((prev) => {
      const next = prev === 'TILE' ? 'SPOTLIGHT' : 'TILE';
      cometchatService.setLayout(next);
      return next;
    });
  }, []);

  // CometChat mic mute toggle
  const handleToggleMic = useCallback(() => {
    cometchatService.toggleAudio();
    setIsMuted((prev) => !prev);
  }, []);

  // Capture leave/hangup clicks in Web DOM strictly inside CometChat container
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || callState !== 'active') return;

    const handleWebClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // ── CRITICAL: Ignore all clicks outside CometChat's calling container ──
      // Our custom React Native UI (sidechat, text input, send button, layout dock, etc.)
      // has its own dedicated React handlers and must never trigger a disconnect.
      const cometchatContainer = document.getElementById('cometchat-web-call-container');
      if (!cometchatContainer || !cometchatContainer.contains(target)) {
        return;
      }

      const btn = target.closest('button, [role="button"], a');
      if (btn) {
        const cls = (btn.className || '').toString().toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const text = (((btn as any).innerText as string) || btn.textContent || '').toLowerCase();

        // Use strict regex with word boundaries to match leave/hangup/end call without matching "send"
        const isLeaveOrHangup =
          cls.includes('leave') ||
          cls.includes('hangup') ||
          cls.includes('end-call') ||
          /\b(leave\s*(session|call)?|end\s*call|hang\s*up)\b/i.test(title) ||
          /\b(leave\s*(session|call)?|end\s*call|hang\s*up)\b/i.test(aria) ||
          /\b(leave\s*(session|call)?|end\s*call|hang\s*up)\b/i.test(text);

        if (isLeaveOrHangup) {
          console.log('[ActiveCallModal Web] User clicked CometChat leave/hangup in container, ending call');
          handleEndCall();
        }
      }
    };

    document.addEventListener('click', handleWebClickCapture, true);
    return () => {
      document.removeEventListener('click', handleWebClickCapture, true);
    };
  }, [visible, callState, handleEndCall]);

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

  // Setup Web camera & mic stream ONLY when call is active on Web without callToken (fallback preview)
  // When callToken is present, CometChat Calls SDK manages media tracks exclusively (prevents camera lock on video screen sharing)
  useEffect(() => {
    if (!visible || callState !== 'active' || Platform.OS !== 'web' || Boolean(callToken)) {
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
              onPress={handleEndCall}
              accessibilityRole="button"
              accessibilityLabel="Cancel Call"
            >
              <PhoneOff size={32} color="#ffffff" />
            </TouchableOpacity>
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600', marginTop: 12 }}>
              Cancel Call
            </Text>
          </View>
        ) : (
          /* ───────────── ACTIVE CALL STATE ───────────── */
          <View style={[styles.activeContainer, isDesktopWeb && { flexDirection: 'row' }]}>
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


                {/* ── Top Bar: Duration/Group Badge on Left, Control Icons on Right for Mobile ── */}
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
                      <View style={styles.timerLiveDot} />
                      <Users size={13} color="#38bdf8" style={{ marginRight: 5 }} />
                      <Text style={styles.nativeGroupBadgeText} numberOfLines={1}>
                        {groupName || 'Group Call'}{participantCount ? ` (${participantCount})` : ''} • {formatDuration(callDuration)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.nativeTimerBadge}>
                      <View style={styles.timerLiveDot} />
                      <Text style={styles.nativeTimerText}>{formatDuration(callDuration)}</Text>
                    </View>
                  )}

                  {/* Mobile Only: Control Icons in a single, neat horizontal row */}
                  {isMobile && (
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

                      {/* 4. In-Call Chat */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.nativeActionIconBtn,
                          isSideChatOpen && styles.nativeLayoutIconBtnActive,
                          { position: 'relative' },
                        ]}
                        onPress={() => {
                          setIsSideChatOpen((prev) => {
                            if (!prev) setUnreadChatCount(0);
                            return !prev;
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="In-Call Chat"
                      >
                        <MessageSquare size={18} color={isSideChatOpen ? '#38bdf8' : '#ffffff'} />
                        {unreadChatCount > 0 && !isSideChatOpen && (
                          <View style={styles.mobileChatCountBadge}>
                            <Text style={styles.mobileChatCountText}>
                              {unreadChatCount > 9 ? '9+' : unreadChatCount}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Desktop Web: Clean Layout Mode & Chat Buttons on Bottom */}
                {isDesktopWeb && (
                  <View style={styles.desktopBottomLayoutContainer} pointerEvents="box-none">
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[
                        styles.desktopLayoutDockBtn,
                        callLayout === 'SPOTLIGHT' && styles.desktopLayoutDockBtnActive,
                        { marginRight: 10 },
                      ]}
                      onPress={handleToggleLayout}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle Layout Mode"
                    >
                      <LayoutGrid size={16} color={callLayout === 'SPOTLIGHT' ? '#38bdf8' : '#ffffff'} style={{ marginRight: 6 }} />
                      <Text style={[styles.desktopLayoutDockText, callLayout === 'SPOTLIGHT' && styles.desktopLayoutDockTextActive]}>
                        {callLayout === 'SPOTLIGHT' ? 'Spotlight' : 'Grid'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[
                        styles.desktopLayoutDockBtn,
                        isSideChatOpen && styles.desktopLayoutDockBtnActive,
                      ]}
                      onPress={() => {
                        setIsSideChatOpen((prev) => {
                          if (!prev) setUnreadChatCount(0);
                          return !prev;
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle In-Call Chat"
                    >
                      <MessageSquare size={16} color={isSideChatOpen ? '#38bdf8' : '#ffffff'} style={{ marginRight: 6 }} />
                      <Text style={[styles.desktopLayoutDockText, isSideChatOpen && styles.desktopLayoutDockTextActive]}>
                        In-call chat
                      </Text>
                      {unreadChatCount > 0 && !isSideChatOpen && (
                        <View style={styles.chatBadge}>
                          <Text style={styles.chatBadgeText}>
                            {unreadChatCount > 9 ? '9+' : unreadChatCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <View>
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

                    {/* Mobile 4-icon row in fallback view */}
                    {isMobile && (
                      <View style={styles.nativeActionBtnsRow}>
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

                        {/* In-Call Chat */}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={[
                            styles.nativeActionIconBtn,
                            isSideChatOpen && styles.nativeLayoutIconBtnActive,
                            { position: 'relative' },
                          ]}
                          onPress={() => {
                            setIsSideChatOpen((prev) => {
                              if (!prev) setUnreadChatCount(0);
                              return !prev;
                            });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="In-Call Chat"
                        >
                          <MessageSquare size={18} color={isSideChatOpen ? '#38bdf8' : '#ffffff'} />
                          {unreadChatCount > 0 && !isSideChatOpen && (
                            <View style={styles.mobileChatCountBadge}>
                              <Text style={styles.mobileChatCountText}>
                                {unreadChatCount > 9 ? '9+' : unreadChatCount}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
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
                    {Platform.OS === 'web' && !callToken ? (
                      <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <ActivityIndicator size="large" color="#38bdf8" />
                        <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600', marginTop: 16 }}>
                          Connecting Call...
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                          Securing WebRTC audio & video conference
                        </Text>
                      </View>
                    ) : Platform.OS === 'web' && isScreenSharing && screenStreamRef.current ? (

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

                  {/* In-Call Chat Toggle Button */}
                  <TouchableOpacity
                    style={[styles.controlBtn, isSideChatOpen && styles.controlBtnActive, { position: 'relative' }]}
                    onPress={() => {
                      setIsSideChatOpen((prev) => {
                        if (!prev) setUnreadChatCount(0);
                        return !prev;
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle Chat"
                  >
                    <MessageSquare size={22} color={isSideChatOpen ? '#38bdf8' : '#ffffff'} />
                    {unreadChatCount > 0 && !isSideChatOpen && (
                      <View style={styles.mobileChatCountBadge}>
                        <Text style={styles.mobileChatCountText}>
                          {unreadChatCount > 9 ? '9+' : unreadChatCount}
                        </Text>
                      </View>
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

            {/* Floating In-Call Chat Message Notification (Google Meet style) */}
            {latestChatMessage && !isSideChatOpen && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  setIsSideChatOpen(true);
                  setUnreadChatCount(0);
                  setLatestChatMessage(null);
                }}
                style={[
                  styles.inCallToastContainer,
                  isMobile
                    ? { bottom: bottomInset + 80, left: 16, right: 16 }
                    : { bottom: 84, left: 24, maxWidth: 360 },
                ]}
              >
                <View style={styles.inCallToastIconBadge}>
                  <MessageSquare size={15} color="#38bdf8" />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inCallToastSender} numberOfLines={1}>
                    {latestChatMessage.senderName}
                  </Text>
                  <Text style={styles.inCallToastText} numberOfLines={1}>
                    {latestChatMessage.text}
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setLatestChatMessage(null);
                  }}
                  style={styles.inCallToastCloseBtn}
                >
                  <X size={14} color="#94a3b8" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}

            {/* In-Call Chat Sidebar (Desktop Side Dock / Mobile Fullscreen Overlay) */}
            <InCallChatSidebar
              isOpen={isSideChatOpen}
              onClose={() => setIsSideChatOpen(false)}
              inCallMessages={inCallMessages}
              chatInputText={chatInputText}
              setChatInputText={setChatInputText}
              onSendMessage={handleSendInCallMessage}
              chatScrollRef={chatScrollRef}
              isMobile={isMobile}
              topInset={topInset}
              bottomInset={bottomInset}
            />
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
    minWidth: 0,
    height: '100%',
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  fallbackContainer: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    backgroundColor: '#090d16',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
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
  desktopBottomLayoutContainer: {
    position: 'absolute',
    bottom: 24,
    right: 28,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopLayoutDockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  desktopLayoutDockBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38bdf8',
  },
  desktopLayoutDockText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  desktopLayoutDockTextActive: {
    color: '#38bdf8',
  },

  /* ── In-Call Chat Sidebar Styles (Google Meet / Zoom style) ── */
  desktopChatSidebar: {
    width: 360,
    height: '100%',
    backgroundColor: '#0b0f19',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10000,
    flexDirection: 'column',
  },
  mobileChatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090d16',
    zIndex: 99999,
    flexDirection: 'column',
  },
  chatSidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  chatHeaderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSidebarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  chatCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  chatNoticeBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  chatNoticeText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
  chatMessageScroll: {
    flex: 1,
    paddingHorizontal: 14,
  },
  chatMessageContent: {
    paddingVertical: 12,
    minHeight: '100%',
  },
  chatEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  chatEmptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  chatEmptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  chatEmptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  chatMsgItem: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  chatMsgItemSelf: {
    alignSelf: 'flex-end',
  },
  chatMsgItemOther: {
    alignSelf: 'flex-start',
  },
  chatMsgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  chatMsgSender: {
    fontSize: 11,
    fontWeight: '600',
  },
  chatMsgTime: {
    fontSize: 10,
    color: '#64748b',
  },
  chatBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  chatBubbleSelf: {
    backgroundColor: '#0284c7',
    borderBottomRightRadius: 2,
  },
  chatBubbleOther: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 2,
  },
  chatBubbleText: {
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendBtnActive: {
    backgroundColor: '#0284c7',
  },
  chatSendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  chatBadge: {
    marginLeft: 6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  mobileChatDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#090d16',
  },
  mobileChatCountBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#090d16',
    zIndex: 10,
  },
  mobileChatCountText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  inCallToastContainer: {
    position: 'absolute',
    zIndex: 99998,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  inCallToastIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inCallToastSender: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  inCallToastText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 16,
  },
  inCallToastCloseBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
