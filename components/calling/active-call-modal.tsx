import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react-native';
import { cometchatService } from '../../lib/cometchat-service';

export interface ActiveCallModalProps {
  visible: boolean;
  callState: 'outgoing' | 'active';
  callType: 'audio' | 'video';
  partnerName: string;
  callToken: string | null;
  sessionId: string;
  onEndCall: () => void;
}

export function ActiveCallModal({
  visible,
  callState,
  callType,
  partnerName,
  callToken,
  sessionId,
  onEndCall,
}: ActiveCallModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');

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

    cometchatService.addEventListener('onSessionLeft', () => {
      console.log('[CometChat] Session left event received');
      onEndCall();
    }, { signal });

    cometchatService.addEventListener('onLeaveSessionButtonClicked', () => {
      console.log('[CometChat] Leave button clicked');
      cometchatService.leaveSession();
      onEndCall();
    }, { signal });

    cometchatService.addEventListener('onParticipantLeft', (participant: any) => {
      console.log('[CometChat] Participant left:', participant?.name);
    }, { signal });

    cometchatService.addEventListener('onSessionTimedOut', () => {
      console.log('[CometChat] Session timed out');
      onEndCall();
    }, { signal });

    return () => {
      controller.abort();
    };
  }, [visible, callState, onEndCall]);

  if (!visible) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const initials =
    partnerName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AM';

  const isNativeSupported = cometchatService.isSupported();
  const sdk = cometchatService.getSDK();
  const CometChatComponent = sdk?.Component;

  // Session settings for native CometChat Calls component
  const sessionSettings = {
    sessionType: callType === 'audio' ? 'VOICE' : 'VIDEO',
    layout: 'TILE',
    hideLeaveSessionButton: false,
    hideToggleAudioButton: false,
    hideToggleVideoButton: callType === 'audio',
    hideSwitchCameraButton: callType === 'audio',
    hideAudioModeButton: false,
    startAudioMuted: false,
    startVideoPaused: false,
    audioMode: 'SPEAKER',
    hideRecordingButton: false,
  } as const;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onEndCall}
    >
      <View style={styles.container}>
        {callState === 'outgoing' ? (
          /* ───────────── OUTGOING RINGING STATE ───────────── */
          <View style={styles.outgoingContainer}>
            <Text style={styles.callTypeLabel}>
              {callType === 'video' ? 'Outgoing Video Call' : 'Outgoing Audio Call'}
            </Text>

            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </Animated.View>

            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName}
            </Text>
            <Text style={styles.statusText}>Calling...</Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.hangupBtn}
              onPress={onEndCall}
              accessibilityRole="button"
              accessibilityLabel="End Call"
            >
              <PhoneOff size={32} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          /* ───────────── ACTIVE CALL STATE ───────────── */
          <View style={styles.activeContainer}>
            {isNativeSupported && callToken && CometChatComponent ? (
              /* Native CometChat WebRTC Calling Component */
              <View style={styles.nativeCallWrapper}>
                <CometChatComponent
                  callToken={callToken}
                  sessionSettings={sessionSettings}
                />
              </View>
            ) : (
              /* Fallback / Web Simulated Call Screen */
              <View style={styles.fallbackContainer}>
                <View style={styles.headerInfo}>
                  <Text style={styles.callTypeBadge}>
                    {callType === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}
                  </Text>
                  <Text style={styles.partnerNameSmall}>{partnerName}</Text>
                  <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
                </View>

                <View style={styles.centerStage}>
                  <View style={styles.bigAvatar}>
                    <Text style={styles.bigAvatarText}>{initials}</Text>
                  </View>
                  <Text style={styles.connectedBadge}>Connected via CometChat</Text>
                  {!isNativeSupported && (
                    <Text style={styles.devNote}>
                      (Native WebRTC requires Expo Dev Build. Previewing UI & signaling mode)
                    </Text>
                  )}
                </View>

                {/* Control Action Buttons */}
                <View style={styles.controlsRow}>
                  <TouchableOpacity
                    style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                    onPress={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? (
                      <MicOff size={24} color="#ef4444" />
                    ) : (
                      <Mic size={24} color="#ffffff" />
                    )}
                  </TouchableOpacity>

                  {callType === 'video' && (
                    <TouchableOpacity
                      style={[styles.controlBtn, isVideoDisabled && styles.controlBtnActive]}
                      onPress={() => setIsVideoDisabled(!isVideoDisabled)}
                    >
                      {isVideoDisabled ? (
                        <VideoOff size={24} color="#ef4444" />
                      ) : (
                        <Video size={24} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.controlBtn, styles.hangupBtnSmall]}
                    onPress={onEndCall}
                  >
                    <PhoneOff size={28} color="#ffffff" />
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
    backgroundColor: '#090d16',
  },
  outgoingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  callTypeLabel: {
    fontSize: 14,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 48,
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
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#000000',
  },
  nativeCallWrapper: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'space-between',
    paddingVertical: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerInfo: {
    alignItems: 'center',
  },
  callTypeBadge: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  partnerNameSmall: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  timerText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  centerStage: {
    alignItems: 'center',
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
    gap: 20,
  },
  controlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  hangupBtnSmall: {
    backgroundColor: '#ef4444',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});
