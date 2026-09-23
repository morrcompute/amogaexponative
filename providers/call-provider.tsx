import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth-provider';
import { cometchatService } from '../lib/cometchat-service';
import { IncomingCallModal } from '../components/calling/incoming-call-modal';
import { ActiveCallModal } from '../components/calling/active-call-modal';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'active';
export type CallType = 'audio' | 'video';

export interface CallPartner {
  id: string;
  name: string;
  avatar?: string;
}

export interface CallContextType {
  callState: CallState;
  callType: CallType;
  partnerInfo: CallPartner | null;
  sessionId: string | null;
  callToken: string | null;
  startCall: (targetUser: CallPartner, type: CallType) => Promise<boolean>;
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

  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  const partnerInfoRef = useRef<CallPartner | null>(null);
  partnerInfoRef.current = partnerInfo;

  // Initialize CometChat and login current user when auth changes
  useEffect(() => {
    if (!user?.id) return;

    async function setupCometChat() {
      try {
        await cometchatService.init();
        await cometchatService.login(user!.id);
      } catch (err) {
        console.warn('[CallProvider] Failed to auto-login CometChat user:', err);
      }
    }

    setupCometChat();
  }, [user?.id]);

  // Teardown / Reset call state
  const resetCallState = useCallback(() => {
    setCallState('idle');
    setPartnerInfo(null);
    setSessionId(null);
    setCallToken(null);
  }, []);

  // End active call
  const endCall = useCallback(() => {
    const activeSession = sessionIdRef.current;
    const partner = partnerInfoRef.current;

    cometchatService.leaveSession();

    if (activeSession && partner?.id) {
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
  }, [resetCallState]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    const activeSession = sessionIdRef.current;
    const partner = partnerInfoRef.current;

    if (activeSession && partner?.id) {
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
  }, [resetCallState]);

  // Accept incoming call
  const acceptCall = useCallback(async (): Promise<boolean> => {
    const activeSession = sessionIdRef.current;
    const partner = partnerInfoRef.current;

    if (!activeSession || !partner?.id || !user?.id) {
      return false;
    }

    try {
      // 1. Ensure CometChat initialized & logged in
      await cometchatService.init();
      await cometchatService.login(user.id);

      // 2. Generate token for this session
      const { token } = await cometchatService.generateToken(activeSession);
      if (token) {
        setCallToken(token);
      }

      // 3. Notify caller that call was accepted
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

      setCallState('active');
      return true;
    } catch (err) {
      console.error('[CallProvider] Failed to accept call:', err);
      resetCallState();
      return false;
    }
  }, [user, resetCallState]);

  // Start outgoing call
  const startCall = useCallback(
    async (targetUser: CallPartner, type: CallType): Promise<boolean> => {
      if (!user?.id || !targetUser?.id) return false;

      const newSessionId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      setCallType(type);
      setPartnerInfo(targetUser);
      setSessionId(newSessionId);
      setCallState('outgoing');

      try {
        // 1. Initialize & Login caller to CometChat
        await cometchatService.init();
        await cometchatService.login(user.id);

        // 2. Pre-generate call token for caller
        const tokenRes = await cometchatService.generateToken(newSessionId);
        if (tokenRes.token) {
          setCallToken(tokenRes.token);
        }

        // 3. Broadcast call invitation to callee over Supabase Realtime
        const callerName = profile?.name || profile?.display_name || user.email?.split('@')[0] || 'User';
        const channel = supabase.channel(`call_signals_${targetUser.id}`);

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'call_invitation',
              payload: {
                sessionId: newSessionId,
                callType: type,
                caller: {
                  id: user.id,
                  name: callerName,
                  avatar: profile?.avatar || profile?.avatar_url,
                },
              },
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });

        return true;
      } catch (err) {
        console.error('[CallProvider] Error starting call:', err);
        resetCallState();
        return false;
      }
    },
    [user, profile, resetCallState]
  );

  // Listen for call signaling events targeted to current user
  useEffect(() => {
    if (!user?.id) return;

    const myChannel = supabase.channel(`call_signals_${user.id}`);

    myChannel
      .on('broadcast', { event: 'call_invitation' }, ({ payload }: any) => {
        console.log('[CallProvider] Received call invitation:', payload);
        // If already in a call, ignore or auto-decline
        if (callState !== 'idle') return;

        setSessionId(payload.sessionId);
        setCallType(payload.callType || 'audio');
        setPartnerInfo(payload.caller);
        setCallState('incoming');
      })
      .on('broadcast', { event: 'call_accepted' }, ({ payload }: any) => {
        console.log('[CallProvider] Call was accepted by callee:', payload);
        if (sessionIdRef.current === payload.sessionId) {
          setCallState('active');
        }
      })
      .on('broadcast', { event: 'call_rejected' }, ({ payload }: any) => {
        console.log('[CallProvider] Call was rejected:', payload);
        if (sessionIdRef.current === payload.sessionId) {
          resetCallState();
        }
      })
      .on('broadcast', { event: 'call_ended' }, ({ payload }: any) => {
        console.log('[CallProvider] Call was ended by partner:', payload);
        if (sessionIdRef.current === payload.sessionId) {
          cometchatService.leaveSession();
          resetCallState();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(myChannel);
    };
  }, [user?.id, callState, resetCallState]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        partnerInfo,
        sessionId,
        callToken,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
      }}
    >
      {children}

      {/* Global Incoming Call Dialog */}
      <IncomingCallModal
        visible={callState === 'incoming'}
        callerName={partnerInfo?.name || 'Incoming Call'}
        callerAvatar={partnerInfo?.avatar}
        callType={callType}
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
