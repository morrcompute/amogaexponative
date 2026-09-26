import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/**
 * Register device for Expo Push Notifications and store token in Supabase
 */
export async function registerForPushNotificationsAsync(
  userEmail?: string,
  userId?: string
): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'web') {
    return null;
  }

  try {
    // 1. Android Notification Channel configuration (high importance, sound, vibration)
    if (Platform.OS === 'android') {
      // Channel for Emails & General App notifications
      await Notifications.setNotificationChannelAsync('email-notifications', {
        name: 'Email & App Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f97316',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      // Channel for Instant Chat Messages
      await Notifications.setNotificationChannelAsync('chat-messages', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38bdf8',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      // Channel for Incoming Voice & Video Calls (High priority, custom vibration, bypass DND)
      await Notifications.setNotificationChannelAsync('incoming-calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500, 500, 500],
        lightColor: '#10b981',
        sound: 'default',
        bypassDnd: true,
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      // Notification Category with direct Accept / Decline interactive buttons
      await Notifications.setNotificationCategoryAsync('call-incoming', [
        {
          identifier: 'ACCEPT_CALL',
          buttonTitle: 'Accept 📞',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'DECLINE_CALL',
          buttonTitle: 'Decline ❌',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    }

    // 2. Check physical device
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device.');
    }

    // 3. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permissions not granted.');
      return null;
    }

    // 4. Fetch Expo Push Token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      '83b25875-f165-4983-95ce-91e5b1e9fc86';

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = tokenResponse.data;

    // 5. Store token in Supabase for user
    if (token && (userEmail || userId)) {
      const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : null;
      const deviceType = Platform.OS;
      const deviceName = Device.modelName || Device.deviceName || 'Mobile Device';

      await (supabase as any).from('user_push_tokens').upsert(
        {
          user_id: userId || null,
          user_email: cleanEmail || '',
          expo_push_token: token,
          device_type: deviceType,
          device_name: deviceName,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' }
      );
    }

    return token;
  } catch (error) {
    console.warn('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Send real-time Expo Push Notification for Emails & General Notifications
 */
export async function sendExpoPushNotification(params: {
  recipientEmails: string[];
  senderName?: string;
  senderEmail?: string;
  subject: string;
  bodyPreview: string;
  notificationId?: string | number;
  notificationUuid?: string;
}): Promise<boolean> {
  try {
    const {
      recipientEmails,
      senderName,
      senderEmail,
      subject,
      bodyPreview,
      notificationId,
      notificationUuid,
    } = params;

    if (!recipientEmails || recipientEmails.length === 0) return false;

    // 1. Sanitize recipient emails
    const cleanEmails = recipientEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));

    if (cleanEmails.length === 0) return false;

    // 2. Fetch push tokens for recipients from Supabase
    const { data: tokenRecords, error: tokenError } = await (supabase as any)
      .from('user_push_tokens')
      .select('expo_push_token, user_email')
      .in('user_email', cleanEmails)
      .eq('is_active', true);

    if (tokenError || !tokenRecords || tokenRecords.length === 0) {
      return false;
    }

    const senderDisplay = senderName || senderEmail || 'New Notification';
    const cleanSubject = subject.trim() || '(No Subject)';
    const cleanBody = bodyPreview ? bodyPreview.substring(0, 120) : '';

    // 3. Build Expo push messages payload
    const messages = tokenRecords
      .filter((rec) => Boolean(rec.expo_push_token && typeof rec.expo_push_token === 'string'))
      .map((rec) => ({
        to: rec.expo_push_token,
        sound: 'default',
        title: `📧 ${senderDisplay}`,
        subtitle: cleanSubject,
        body: `${cleanSubject}\n${cleanBody}`,
        data: {
          type: 'app_notification',
          notification_id: notificationId,
          notification_uuid: notificationUuid,
          sender_email: senderEmail,
          to_email: rec.user_email,
        },
        channelId: 'email-notifications',
        priority: 'high',
        badge: 1,
      }));

    if (messages.length === 0) return false;

    // 4. Send push request to Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const resJson = await response.json();
    return Boolean(resJson?.data);
  } catch (error) {
    console.warn('Error sending Expo push notification:', error);
    return false;
  }
}

/**
 * Send real-time Expo Push Notification for Chat Messages (1-on-1 & Group Chats)
 */
export async function sendChatPushNotification(params: {
  recipientUserIds?: string[];
  recipientEmails?: string[];
  senderName: string;
  senderId?: string;
  messageText?: string;
  messageType?: string;
  fileName?: string;
  conversationId?: string;
  isGroup?: boolean;
  groupName?: string;
}): Promise<boolean> {
  try {
    const {
      recipientUserIds = [],
      recipientEmails = [],
      senderName,
      senderId,
      messageText = '',
      messageType = 'text',
      fileName,
      conversationId,
      isGroup = false,
      groupName,
    } = params;

    const queryParts: string[] = [];
    if (recipientUserIds.length > 0) {
      queryParts.push(`user_id.in.(${recipientUserIds.map((id) => `"${id}"`).join(',')})`);
    }
    const cleanEmails = recipientEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    if (cleanEmails.length > 0) {
      queryParts.push(`user_email.in.(${cleanEmails.map((e) => `"${e}"`).join(',')})`);
    }

    if (queryParts.length === 0) return false;

    // Query tokens
    const { data: tokenRecords, error: tokenError } = await (supabase as any)
      .from('user_push_tokens')
      .select('expo_push_token, user_id, user_email')
      .or(queryParts.join(','))
      .eq('is_active', true);

    if (tokenError || !tokenRecords || tokenRecords.length === 0) {
      return false;
    }

    // Deduplicate tokens
    const uniqueTokens = new Map<string, any>();
    tokenRecords.forEach((rec: any) => {
      if (rec.expo_push_token && !uniqueTokens.has(rec.expo_push_token)) {
        // Avoid sending to sender's own device if senderId/senderEmail matches
        if (senderId && rec.user_id === senderId) return;
        uniqueTokens.set(rec.expo_push_token, rec);
      }
    });

    if (uniqueTokens.size === 0) return false;

    // Construct preview text based on message type
    let preview = messageText;
    if (messageType === 'image') {
      preview = '📷 Photo';
    } else if (messageType === 'audio') {
      preview = '🎤 Voice message';
    } else if (messageType === 'video') {
      preview = '🎥 Video';
    } else if (messageType === 'file' || messageType === 'document') {
      preview = `📎 ${fileName || 'Document'}`;
    } else if (messageType === 'location') {
      preview = '📍 Location';
    } else if (!preview) {
      preview = 'New message';
    }

    if (preview.length > 150) {
      preview = preview.substring(0, 147) + '...';
    }

    const title = isGroup && groupName ? `👥 ${groupName}` : `💬 ${senderName}`;
    const body = isGroup ? `${senderName}: ${preview}` : preview;

    const messages = Array.from(uniqueTokens.values()).map((rec: any) => ({
      to: rec.expo_push_token,
      sound: 'default',
      title,
      subtitle: senderName,
      body,
      data: {
        type: 'chat_message',
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        is_group: isGroup,
        group_name: groupName,
      },
      channelId: 'chat-messages',
      priority: 'high',
      badge: 1,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const resJson = await response.json();
    return Boolean(resJson?.data);
  } catch (error) {
    console.warn('Error sending chat push notification:', error);
    return false;
  }
}

/**
 * Send real-time Expo Push Notification for Incoming Voice & Video Calls
 */
export async function sendCallPushNotification(params: {
  recipientUserIds?: string[];
  recipientEmails?: string[];
  callerName: string;
  callerId?: string;
  callType: 'audio' | 'video';
  sessionId: string;
  isGroupCall?: boolean;
  groupName?: string;
}): Promise<boolean> {
  try {
    const {
      recipientUserIds = [],
      recipientEmails = [],
      callerName,
      callerId,
      callType,
      sessionId,
      isGroupCall = false,
      groupName,
    } = params;

    const queryParts: string[] = [];
    if (recipientUserIds.length > 0) {
      queryParts.push(`user_id.in.(${recipientUserIds.map((id) => `"${id}"`).join(',')})`);
    }
    const cleanEmails = recipientEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    if (cleanEmails.length > 0) {
      queryParts.push(`user_email.in.(${cleanEmails.map((e) => `"${e}"`).join(',')})`);
    }

    if (queryParts.length === 0) return false;

    // Query tokens
    const { data: tokenRecords, error: tokenError } = await (supabase as any)
      .from('user_push_tokens')
      .select('expo_push_token, user_id, user_email')
      .or(queryParts.join(','))
      .eq('is_active', true);

    if (tokenError || !tokenRecords || tokenRecords.length === 0) {
      return false;
    }

    // Deduplicate tokens
    const uniqueTokens = new Map<string, any>();
    tokenRecords.forEach((rec) => {
      if (rec.expo_push_token && !uniqueTokens.has(rec.expo_push_token)) {
        if (callerId && rec.user_id === callerId) return;
        uniqueTokens.set(rec.expo_push_token, rec);
      }
    });

    if (uniqueTokens.size === 0) return false;

    const callIcon = callType === 'video' ? '🎥' : '📞';
    const callLabel = callType === 'video' ? 'Video Call' : 'Voice Call';

    const title = isGroupCall
      ? `${callIcon} Incoming Group ${callLabel}`
      : `${callIcon} Incoming ${callLabel}`;

    const subtitle = isGroupCall
      ? `${callerName} in ${groupName || 'Group'}`
      : callerName;

    const body = isGroupCall
      ? `Incoming ${callLabel} from ${callerName} in ${groupName || 'Group'}. Tap to join!`
      : `Incoming ${callLabel} from ${callerName}. Tap to answer!`;

    const messages = Array.from(uniqueTokens.values()).map((rec) => ({
      to: rec.expo_push_token,
      sound: 'default',
      title,
      subtitle,
      body,
      data: {
        type: 'incoming_call',
        session_id: sessionId,
        caller_id: callerId,
        caller_name: callerName,
        call_type: callType,
        is_group_call: isGroupCall,
        group_name: groupName,
      },
      channelId: 'incoming-calls',
      categoryIdentifier: 'call-incoming',
      priority: 'high',
      badge: 1,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const resJson = await response.json();
    return Boolean(resJson?.data);
  } catch (error) {
    console.warn('Error sending call push notification:', error);
    return false;
  }
}
