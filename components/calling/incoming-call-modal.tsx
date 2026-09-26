import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Phone, PhoneOff, Video, Users } from 'lucide-react-native';

export interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  isGroupCall?: boolean;
  groupName?: string;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  visible,
  callerName,
  callerAvatar,
  callType,
  isGroupCall = false,
  groupName,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [visible, pulseAnim]);

  if (!visible) return null;

  const displayName = isGroupCall ? (groupName || 'Group Call') : (callerName || 'Unknown Caller');
  const initials =
    displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || (isGroupCall ? 'GP' : 'AM');

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onReject}
    >
      <View style={styles.fullScreenContainer}>
        {/* Top Header Section */}
        <View style={styles.topSection}>
          <View style={styles.badgeRow}>
            {isGroupCall && <Users size={16} color="#38bdf8" style={{ marginRight: 8 }} />}
            <Text style={styles.callTypeBadge}>
              {isGroupCall
                ? (callType === 'video' ? 'INCOMING GROUP VIDEO CALL' : 'INCOMING GROUP AUDIO CALL')
                : (callType === 'video' ? 'INCOMING VIDEO CALL' : 'INCOMING AUDIO CALL')}
            </Text>
          </View>
        </View>

        {/* Center Caller Profile & Pulsing Ring Section */}
        <View style={styles.centerSection}>
          <Animated.View
            style={[
              styles.pulseRingOuter,
              { transform: [{ scale: pulseAnim }] },
              isGroupCall && styles.groupPulseRingOuter,
            ]}
          >
            <View style={[styles.pulseRingMiddle, isGroupCall && styles.groupPulseRingMiddle]}>
              <View style={[styles.avatarCircle, isGroupCall && styles.groupAvatarCircle]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
          </Animated.View>

          <Text style={styles.callerName} numberOfLines={1}>
            {displayName}
          </Text>

          <Text style={styles.ringingSub}>
            {isGroupCall ? `${callerName || 'Someone'} is inviting you to join` : 'Ringing...'}
          </Text>
        </View>

        {/* Bottom Actions Section: Decline (Red) and Accept (Green) */}
        <View style={styles.bottomSection}>
          <View style={styles.actionsRow}>
            {/* Decline Button */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.callBtn, styles.declineBtn]}
                onPress={onReject}
                accessibilityRole="button"
                accessibilityLabel="Decline Call"
              >
                <PhoneOff size={32} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Decline</Text>
            </View>

            {/* Accept Button */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.callBtn, styles.acceptBtn]}
                onPress={onAccept}
                accessibilityRole="button"
                accessibilityLabel="Accept Call"
              >
                {callType === 'video' ? (
                  <Video size={32} color="#ffffff" />
                ) : (
                  <Phone size={32} color="#ffffff" />
                )}
              </TouchableOpacity>
              <Text style={styles.btnLabel}>{isGroupCall ? 'Join Call' : 'Accept'}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 24,
    zIndex: 999999,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTypeBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pulseRingOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: 32,
  },
  groupPulseRingOuter: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  pulseRingMiddle: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupPulseRingMiddle: {
    backgroundColor: 'rgba(56, 189, 248, 0.3)',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  groupAvatarCircle: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
  },
  avatarText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#ffffff',
  },
  callerName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  ringingSub: {
    fontSize: 16,
    color: '#38bdf8',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bottomSection: {
    width: '100%',
    paddingBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  actionCol: {
    alignItems: 'center',
  },
  callBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
    marginBottom: 12,
  },
  declineBtn: {
    backgroundColor: '#ef4444',
  },
  acceptBtn: {
    backgroundColor: '#10b981',
  },
  btnLabel: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '600',
  },
});
