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

      await supabase.from('user_push_tokens').upsert(
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
 * Send real-time Expo Push Notification to recipients
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
    const { data: tokenRecords, error: tokenError } = await supabase
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
