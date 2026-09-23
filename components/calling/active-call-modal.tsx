import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  callToken: string | null;
  sessionId: string;
  onEndCall: () => void;
  isGroupCall?: boolean;
  groupName?: string;
  participantCount?: number;
  participants?: CallParticipant[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ActiveCallModal({
  visible,
  callState,
  callType,
  partnerName,
  callToken,
  sessionId,
  onEndCall,
  isGroupCall = false,
  groupName,
  participantCount = 1,
  participants = [],
}: ActiveCallModalProps) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

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

  // Duration timer during active call
  useEffect(() => {
    if (!visible || callState !== 'active') {
      setCallDuration(0);
      setIsScreenSharing(false);
      return;
    }

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, callState]);

  // CometChat native event listeners
  useEffect(() => {
    if (!visible || callState !== 'active' || !cometchatService.isSupported()) return;

    const controller = new AbortController();
    const { signal } = controller;

    cometchatService.addEventListener(
      'onSessionLeft',
      () => {
        console.log('[CometChat] Session left event received');
        onEndCall();
      },
      { signal }
    );

    cometchatService.addEventListener(
      'onLeaveSessionButtonClicked',
      () => {
        console.log('[CometChat] Leave button clicked');
        cometchatService.leaveSession();
        onEndCall();
      },
      { signal }
    );

    cometchatService.addEventListener(
      'onParticipantLeft',
      (participant: any) => {
        console.log('[CometChat] Participant left:', participant?.name);
      },
      { signal }
    );

    cometchatService.addEventListener(
      'onSessionTimedOut',
      () => {
        console.log('[CometChat] Session timed out');
        onEndCall();
      },
      { signal }
    );

    return () => {
      controller.abort();
    };
  }, [visible, callState, onEndCall]);

  // Memoize sessionSettings with group calling & screen sharing features enabled
  const sessionSettings = useMemo(() => {
    return {
      sessionType: callType === 'audio' ? 'VOICE' : 'VIDEO',
      isAudioOnly: callType === 'audio',
      layout: 'TILE',
      defaultLayout: true,
      isDesktopSharingEnabled: true,
      ShowScreenShareButton: true,
      hideScreenShareButton: false,
      startScreenSharing: false,
      hideLeaveSessionButton: false,
      ShowEndCallButton: true,
      hideToggleAudioButton: false,
      ShowMuteAudioButton: true,
      hideToggleVideoButton: callType === 'audio',
      ShowPauseVideoButton: callType === 'video',
      hideSwitchCameraButton: callType === 'audio',
      ShowSwitchCameraButton: callType === 'video',
      hideAudioModeButton: false,
      ShowAudioModeButton: true,
      startAudioMuted: false,
      StartAudioMuted: false,
      startVideoPaused: false,
      StartVideoMuted: false,
      audioMode: 'SPEAKER',
      defaultAudioMode: 'SPEAKER',
      initialCameraFacing: 'FRONT',
      enableSpotlightSwap: true,
      enableSpotlightDrag: true,
      hideRecordingButton: true,
      ShowRecordingButton: false,
      maxParticipantCount: isGroupCall ? 25 : 2,
    };
  }, [callType, isGroupCall]);

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
            {isNativeSupported && callToken && CometChatComponent ? (
              /* Native CometChat WebRTC Calling Component with Safe Area Insets */
              <View
                style={[
                  styles.nativeCallWrapper,
                  {
                    paddingTop: topInset,
                    paddingBottom: bottomInset,
                  },
                ]}
              >
                <CometChatComponent
                  callToken={callToken}
                  sessionSettings={sessionSettings}
                  callSettings={sessionSettings}
                />
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
                      onPress={() => setIsScreenSharing(false)}
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
                    <View style={styles.bigAvatar}>
                      <Text style={styles.bigAvatarText}>{initials}</Text>
                    </View>
                    <Text style={styles.connectedBadge}>Connected via CometChat</Text>
                    {!isNativeSupported && (
                      <Text style={styles.devNote}>
                        (Native WebRTC active in EAS Dev Build. Previewing UI layout & signaling)
                      </Text>
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
                    onPress={() => setIsScreenSharing(!isScreenSharing)}
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
                    onPress={onEndCall}
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
});
