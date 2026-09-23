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
import { Phone, PhoneOff, Video } from 'lucide-react-native';

export interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  visible,
  callerName,
  callerAvatar,
  callType,
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

  const initials =
    callerName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AM';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onReject}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.callTypeBadge}>
            {callType === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call'}
          </Text>

          {/* Animated Avatar Box */}
          <Animated.View
            style={[
              styles.avatarContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </Animated.View>

          <Text style={styles.callerName} numberOfLines={1}>
            {callerName || 'Unknown Caller'}
          </Text>
          <Text style={styles.ringingSub}>Ringing...</Text>

          {/* Action Buttons: Decline (Red) and Accept (Green) */}
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
                <PhoneOff size={28} color="#ffffff" />
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
                  <Video size={28} color="#ffffff" />
                ) : (
                  <Phone size={28} color="#ffffff" />
                )}
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Accept</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f172a',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  callTypeBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    marginBottom: 20,
  },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  callerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  ringingSub: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '500',
    marginBottom: 36,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 16,
  },
  actionCol: {
    alignItems: 'center',
  },
  callBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 8,
  },
  declineBtn: {
    backgroundColor: '#ef4444',
  },
  acceptBtn: {
    backgroundColor: '#10b981',
  },
  btnLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
  },
});
