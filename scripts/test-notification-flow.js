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

async function testPushNotification() {
  console.log('[Test] 1. Checking active push tokens in user_push_tokens...');
  const { data: tokens, error: tokenError } = await supabase
    .from('user_push_tokens')
    .select('*')
    .eq('is_active', true);

  if (tokenError) {
    console.error('[Test] Error querying user_push_tokens:', tokenError);
    return;
  }

  console.log(`[Test] Found ${tokens?.length || 0} registered push token(s):`);
  tokens?.forEach((t, i) => {
    console.log(`  ${i + 1}. User: ${t.user_email || t.user_id}, Device: ${t.device_name} (${t.device_type}), Token: ${t.expo_push_token?.substring(0, 25)}...`);
  });

  if (tokens && tokens.length > 0) {
    const targetToken = tokens[0].expo_push_token;
    console.log(`\n[Test] 2. Sending test push notification to token: ${targetToken}...`);

    const message = {
      to: targetToken,
      sound: 'default',
      title: '📧 Test Notification',
      subtitle: 'Notification System Test',
      body: 'Your real-time Expo push notification is working perfectly on Android APK!',
      data: {
        type: 'app_notification',
        timestamp: new Date().toISOString(),
      },
      channelId: 'email-notifications',
      priority: 'high',
      badge: 1,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([message]),
    });

    const resJson = await response.json();
    console.log('[Test] Expo Push API Response:', JSON.stringify(resJson, null, 2));
  } else {
    console.log('[Test] No registered tokens found in database yet. Once the app opens on mobile, it will register automatically.');
  }
}

testPushNotification().catch(console.error);
