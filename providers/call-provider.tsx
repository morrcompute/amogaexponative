import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth-provider';
import { cometchatService } from '../lib/cometchat-service';
import { requestCallPermissions } from '../lib/call-permissions';
import { callSoundService } from '../lib/call-sound-service';
import { logCallMessage } from '../lib/chat-service';
import { IncomingCallModal } from '../components/calling/incoming-call-modal';
import { ActiveCallModal } from '../components/calling/active-call-modal';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'active';
export type CallType = 'audio' | 'video';

export interface CallPartner {
  id: string;
  name: string;
  avatar?: string;
}

export interface GroupCallInfo {
  id: string;
  name: string;
  memberCount?: number;
}

export interface CallContextType {
  callState: CallState;
  callType: CallType;
  partnerInfo: CallPartner | null;
  sessionId: string | null;
  callToken: string | null;
  isGroupCall: boolean;
  groupInfo: GroupCallInfo | null;
  startCall: (targetUser: CallPartner, type: CallType) => Promise<boolean>;
  startGroupCall: (conversation: any, type: CallType) => Promise<boolean>;
  joinActiveGroupCall: (sessionId: string, group: GroupCallInfo, type: CallType) => Promise<boolean>;
  acceptCall: () => Promise<boolean>;
  rejectCall: () => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('audio');
  const [partnerInfo, setPartnerInfo] = useState<CallPartner | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [callToken, setCallToken] = useState<string | null>(null);
  const [isGroupCall, setIsGroupCall] = useState<boolean>(false);
  const [groupInfo, setGroupInfo] = useState<GroupCallInfo | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  const partnerInfoRef = useRef<CallPartner | null>(null);
  partnerInfoRef.current = partnerInfo;

  const groupInfoRef = useRef<GroupCallInfo | null>(null);
  groupInfoRef.current = groupInfo;

  const isGroupCallRef = useRef<boolean>(false);
  isGroupCallRef.current = isGroupCall;

  const callTypeRef = useRef<CallType>(callType);
  callTypeRef.current = callType;

  const isCallerRef = useRef<boolean>(false);
  const callStartTimeRef = useRef<number | null>(null);

  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar || profile?.avatar_url || user?.user_metadata?.avatar_url || undefined;

  // Initialize CometChat and login current user when auth changes
  useEffect(() => {
    if (!user?.id) return;

    async function setupCometChat() {
      try {
        await cometchatService.init();
        await cometchatService.login(user!.id, undefined, {
          name: displayName,
          avatar: avatarUrl,
        });
      } catch (err) {
        console.warn('[CallProvider] Failed to auto-login CometChat user:', err);
      }
    }

    setupCometChat();
  }, [user?.id, displayName, avatarUrl]);

  // Teardown / Reset call state
  const resetCallState = useCallback(() => {
    callSoundService.stopAll();
    setCallState('idle');
    setPartnerInfo(null);
    setGroupInfo(null);
    setIsGroupCall(false);
    setSessionId(null);
    setCallToken(null);
    callStartTimeRef.current = null;
    isCallerRef.current = false;
  }, []);

  // Clean up sounds on unmount
  useEffect(() => {
    return () => {
      callSoundService.stopAll();
    };
  }, []);

  // End active call
  const endCall = useCallback(() => {
    callSoundService.stopAll();
    const activeSession = sessionIdRef.current;
    const partner = partnerInfoRef.current;
    const currentGroup = groupInfoRef.current;
    const isGroup = isGroupCallRef.current;
    const currentType = callTypeRef.current;
    const isCaller = isCallerRef.current;
    const startTime = callStartTimeRef.current;

    cometchatService.leaveSession();

    // Log call duration or missed status into chat
    if (user?.id) {
      if (isGroup && currentGroup?.id) {
        if (startTime) {
          const durationSecs = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
          logCallMessage({
            callerId: user.id,
            calleeId: currentGroup.id,
            callType: currentType,
            status: 'completed',
            durationSeconds: durationSecs,
          });
        }
      } else if (partner?.id) {
        if (startTime) {
          const durationSecs = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
          logCallMessage({
            callerId: isCaller ? user.id : partner.id,
            calleeId: isCaller ? partner.id : user.id,
            callType: currentType,
            status: 'completed',
            durationSeconds: durationSecs,
          });
        } else if (isCaller) {
          // Cancelled before answer
          logCallMessage({
            callerId: user.id,
            calleeId: partner.id,
            callType: currentType,
            status: 'missed',
            durationSeconds: 0,
          });
        }
      }
    }

    if (activeSession && partner?.id && !isGroup) {
      try {
        const channel = supabase.channel(`call_signals_${partner.id}`);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'call_ended',
              payload: { sessionId: activeSession },
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });
      } catch (err) {
        console.warn('[CallProvider] Error broadcasting call_ended:', err);
      }
    }

    resetCallState();
  }, [user?.id, resetCallState]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    callSoundService.stopAll();
    const activeSession = sessionIdRef.current;
    const partner = partnerInfoRef.current;
    const isGroup = isGroupCallRef.current;
    const currentType = callTypeRef.current;

    if (!isGroup && user?.id && partner?.id) {
      logCallMessage({
        callerId: partner.id,
        calleeId: user.id,
        callType: currentType,
        status: 'rejected',
        durationSeconds: 0,
      });
    }

    if (!isGroup && activeSession && partner?.id) {
      try {
        const channel = supabase.channel(`call_signals_${partner.id}`);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'call_rejected',
              payload: { sessionId: activeSession },
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });
      } catch (err) {
        console.warn('[CallProvider] Error broadcasting call_rejected:', err);
      }
    }

    resetCallState();
  }, [user?.id, resetCallState]);

  // Accept incoming call (1-on-1 or Group Call)
  const acceptCall = useCallback(async (): Promise<boolean> => {
    const activeSession = sessionIdRef.current;
    const partner = partnerInfoRef.current;
    const isGroup = isGroupCallRef.current;

    if (!activeSession || !user?.id) {
      return false;
    }

    // 1. Stop incoming ringtone immediately
    await callSoundService.stopAll();

    // 2. Request microphone & camera permissions before entering call session
    const hasPermission = await requestCallPermissions(callType);
    if (!hasPermission) {
      Alert.alert(
        'Permissions Required',
        callType === 'video'
          ? 'Microphone and Camera permissions are needed to join a video call.'
          : 'Microphone permission is needed to join a call.'
      );
      rejectCall();
      return false;
    }

    try {
      // 3. Ensure CometChat initialized & logged in
      await cometchatService.init();
      await cometchatService.login(user.id, undefined, {
        name: displayName,
        avatar: avatarUrl,
      });

      // 4. Generate token for this session
      const tokenRes = await cometchatService.generateToken(activeSession);
      if (tokenRes.token) {
        setCallToken(tokenRes.token);
      } else if (cometchatService.isSupported()) {
        console.warn('[CallProvider] Could not generate call token:', tokenRes.error);
      }

      // 5. Notify caller if 1-on-1
      if (!isGroup && partner?.id) {
        const channel = supabase.channel(`call_signals_${partner.id}`);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'call_accepted',
              payload: { sessionId: activeSession },
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });
      }

      callStartTimeRef.current = Date.now();
      isCallerRef.current = false;
      setCallState('active');
      return true;
    } catch (err) {
      console.error('[CallProvider] Failed to accept call:', err);
      resetCallState();
      return false;
    }
  }, [user, callType, displayName, avatarUrl, rejectCall, resetCallState]);

  // Start 1-on-1 outgoing call
  const startCall = useCallback(
    async (targetUser: CallPartner, type: CallType): Promise<boolean> => {
      if (!user?.id || !targetUser?.id) return false;

      const hasPermission = await requestCallPermissions(type);
      if (!hasPermission) {
        Alert.alert(
          'Permissions Required',
          type === 'video'
            ? 'Microphone and Camera permissions are required to place a video call.'
            : 'Microphone permission is required to place an audio call.'
        );
        return false;
      }

      const newSessionId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      setCallType(type);
      setIsGroupCall(false);
      setGroupInfo(null);
      setPartnerInfo(targetUser);
      setSessionId(newSessionId);
      isCallerRef.current = true;
      callStartTimeRef.current = null;
      setCallState('outgoing');

      // Play outgoing ringtone while waiting for callee to answer
      callSoundService.playOutgoingTone();

      try {
        await cometchatService.init();
        await cometchatService.login(user.id, undefined, {
          name: displayName,
          avatar: avatarUrl,
        });

        const tokenRes = await cometchatService.generateToken(newSessionId);
        if (tokenRes.token) {
          setCallToken(tokenRes.token);
        }

        const channel = supabase.channel(`call_signals_${targetUser.id}`);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'call_invitation',
              payload: {
                sessionId: newSessionId,
                callType: type,
                isGroupCall: false,
                caller: {
                  id: user.id,
                  name: displayName,
                  avatar: avatarUrl,
                },
              },
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });

        return true;
      } catch (err) {
        console.error('[CallProvider] Error starting call:', err);
        callSoundService.stopAll();
        resetCallState();
        return false;
      }
    },
    [user, displayName, avatarUrl, resetCallState]
  );

  // Start Group Audio / Video Call
  const startGroupCall = useCallback(
    async (conversation: any, type: CallType): Promise<boolean> => {
      if (!user?.id || !conversation?.id) return false;

      const hasPermission = await requestCallPermissions(type);
      if (!hasPermission) {
        Alert.alert(
          'Permissions Required',
          type === 'video'
            ? 'Microphone and Camera permissions are required to start a group video call.'
            : 'Microphone permission is required to start a group audio call.'
        );
        return false;
      }

      const newSessionId = `group_${conversation.id}_${Date.now()}`;
      const groupName = conversation.name || 'Group Chat';
      const count = conversation.membersCount || conversation.members?.length || 2;

      setCallType(type);
      setIsGroupCall(true);
      setGroupInfo({ id: conversation.id, name: groupName, memberCount: count });
      setPartnerInfo({ id: conversation.id, name: groupName });
      setSessionId(newSessionId);
      isCallerRef.current = true;
      callStartTimeRef.current = Date.now();

      try {
        await cometchatService.init();
        await cometchatService.login(user.id, undefined, {
          name: displayName,
          avatar: avatarUrl,
        });

        const tokenRes = await cometchatService.generateToken(newSessionId);
        if (tokenRes.token) {
          setCallToken(tokenRes.token);
        }

        // Broadcast group call invitation to all member personal signaling channels
        const members = conversation.members || [];
        members.forEach((m: any) => {
          if (m.id && m.id !== user.id) {
            const channel = supabase.channel(`call_signals_${m.id}`);
            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                channel.send({
                  type: 'broadcast',
                  event: 'call_invitation',
                  payload: {
                    sessionId: newSessionId,
                    callType: type,
                    isGroupCall: true,
                    groupId: conversation.id,
                    groupName: groupName,
                    caller: {
                      id: user.id,
                      name: displayName,
                      avatar: avatarUrl,
                    },
                  },
                });
                setTimeout(() => supabase.removeChannel(channel), 1000);
              }
            });
          }
        });

        // Initiator directly enters active room
        setCallState('active');
        return true;
      } catch (err) {
        console.error('[CallProvider] Error starting group call:', err);
        resetCallState();
        return false;
      }
    },
    [user, displayName, avatarUrl, resetCallState]
  );

  // Join an ongoing group call
  const joinActiveGroupCall = useCallback(
    async (targetSessionId: string, group: GroupCallInfo, type: CallType): Promise<boolean> => {
      if (!user?.id || !targetSessionId) return false;

      const hasPermission = await requestCallPermissions(type);
      if (!hasPermission) {
        Alert.alert('Permissions Required', 'Permissions are needed to join the group call.');
        return false;
      }

      setCallType(type);
      setIsGroupCall(true);
      setGroupInfo(group);
      setPartnerInfo({ id: group.id, name: group.name });
      setSessionId(targetSessionId);
      isCallerRef.current = false;
      callStartTimeRef.current = Date.now();

      try {
        await cometchatService.init();
        await cometchatService.login(user.id, undefined, {
          name: displayName,
          avatar: avatarUrl,
        });

        const tokenRes = await cometchatService.generateToken(targetSessionId);
        if (tokenRes.token) {
          setCallToken(tokenRes.token);
        }

        setCallState('active');
        return true;
      } catch (err) {
        console.error('[CallProvider] Failed to join group call:', err);
        resetCallState();
        return false;
      }
    },
    [user, displayName, avatarUrl, resetCallState]
  );

  // Listen for call signaling events targeted to current user
  useEffect(() => {
    if (!user?.id) return;

    const myChannel = supabase.channel(`call_signals_${user.id}`);

    myChannel
      .on('broadcast', { event: 'call_invitation' }, ({ payload }: any) => {
        console.log('[CallProvider] Received call invitation:', payload);
        if (callState !== 'idle') return;

        setSessionId(payload.sessionId);
        setCallType(payload.callType || 'audio');
        setIsGroupCall(Boolean(payload.isGroupCall));

        if (payload.isGroupCall) {
          setGroupInfo({
            id: payload.groupId,
            name: payload.groupName || 'Group Chat',
          });
          setPartnerInfo(payload.caller);
        } else {
          setGroupInfo(null);
          setPartnerInfo(payload.caller);
        }

        isCallerRef.current = false;
        callStartTimeRef.current = null;
        setCallState('incoming');

        callSoundService.playIncomingTone();
      })
      .on('broadcast', { event: 'call_accepted' }, async ({ payload }: any) => {
        console.log('[CallProvider] Call was accepted by callee:', payload);
        if (sessionIdRef.current === payload.sessionId) {
          await callSoundService.stopAll();

          if (!callToken && sessionIdRef.current) {
            const tokenRes = await cometchatService.generateToken(sessionIdRef.current);
            if (tokenRes.token) {
              setCallToken(tokenRes.token);
            }
          }

          callStartTimeRef.current = Date.now();
          setCallState('active');
        }
      })
      .on('broadcast', { event: 'call_rejected' }, ({ payload }: any) => {
        console.log('[CallProvider] Call was rejected:', payload);
        if (sessionIdRef.current === payload.sessionId && !isGroupCallRef.current) {
          callSoundService.stopAll();
          resetCallState();
        }
      })
      .on('broadcast', { event: 'call_ended' }, ({ payload }: any) => {
        console.log('[CallProvider] Call was ended:', payload);
        if (sessionIdRef.current === payload.sessionId && !isGroupCallRef.current) {
          callSoundService.stopAll();
          cometchatService.leaveSession();
          resetCallState();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(myChannel);
    };
  }, [user?.id, callState, callToken, resetCallState]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        partnerInfo,
        sessionId,
        callToken,
        isGroupCall,
        groupInfo,
        startCall,
        startGroupCall,
        joinActiveGroupCall,
        acceptCall,
        rejectCall,
        endCall,
      }}
    >
      {children}

      {/* Global Incoming Call Dialog (1-on-1 and Group) */}
      <IncomingCallModal
        visible={callState === 'incoming'}
        callerName={partnerInfo?.name || 'Incoming Call'}
        callerAvatar={partnerInfo?.avatar}
        callType={callType}
        isGroupCall={isGroupCall}
        groupName={groupInfo?.name}
        onAccept={acceptCall}
        onReject={rejectCall}
      />

      {/* Global Active Call & Outgoing Ringing Fullscreen Modal */}
      <ActiveCallModal
        visible={callState === 'outgoing' || callState === 'active'}
        callState={callState === 'outgoing' ? 'outgoing' : 'active'}
        callType={callType}
        partnerName={partnerInfo?.name || 'Call'}
        callToken={callToken}
        sessionId={sessionId || ''}
        isGroupCall={isGroupCall}
        groupName={groupInfo?.name}
        participantCount={groupInfo?.memberCount}
        onEndCall={endCall}
      />
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
