const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nvxcqbisyeldjceouggb.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_f7pb9k7U2jT9GgyO4GC2rg_guymXYhK';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendTestNotification(token, email) {
  console.log(`\n🚀 Sending Live Push Notification to ${email} (${token})...`);

  const payload = [
    {
      to: token,
      sound: 'default',
      title: '📧 Notification Test Successful!',
      subtitle: 'Amoga Mobile App',
      body: 'Your real-time Firebase FCM push notification system is working perfectly on Android APK!',
      data: {
        type: 'app_notification',
        timestamp: new Date().toISOString(),
      },
      channelId: 'email-notifications',
      priority: 'high',
      badge: 1,
    },
  ];

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json();
    console.log('✅ Expo Push API Gateway Response:', JSON.stringify(resJson, null, 2));
  } catch (err) {
    console.error('❌ Error dispatching notification:', err);
  }
}

async function run() {
  console.log('====================================================');
  console.log('  AMOGA NOTIFICATION TEST & LIVE TOKEN MONITOR');
  console.log('====================================================');

  const { data: tokens, error } = await supabase
    .from('user_push_tokens')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error querying user_push_tokens:', error);
    return;
  }

  if (tokens && tokens.length > 0) {
    console.log(`Found ${tokens.length} active registered device(s):`);
    for (const t of tokens) {
      console.log(` - ${t.user_email || 'User'} [${t.device_name || t.device_type}]: ${t.expo_push_token}`);
      await sendTestNotification(t.expo_push_token, t.user_email);
    }
  } else {
    console.log('No registered devices found in user_push_tokens yet.');
    console.log('👉 As soon as you install and launch the new APK on your device, it will automatically register.');
  }
}

run().catch(console.error);
