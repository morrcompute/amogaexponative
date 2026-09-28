const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env / .env.local
function loadEnv(file) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[match[1]] = val;
      }
    }
  }
}
loadEnv('.env');
loadEnv('.env.local');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

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
