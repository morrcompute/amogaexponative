/**
 * Test script to send production-ready Chat and Voice/Video Call Push Notifications
 * to all registered active mobile devices.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nvxcqbisyeldjceouggb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f7pb9k7U2jT9GgyO4GC2rg_guymXYhK';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runPushTests() {
  console.log('🔍 Fetching active push tokens from Supabase...');
  const { data: tokens, error } = await supabase
    .from('user_push_tokens')
    .select('*')
    .eq('is_active', true);

  if (error || !tokens || tokens.length === 0) {
    console.error('❌ No active push tokens found in Supabase:', error);
    process.exit(1);
  }

  console.log(`📱 Found ${tokens.length} active device(s):`);
  tokens.forEach((t, idx) => {
    console.log(`  ${idx + 1}. ${t.user_email || 'No email'} [${t.device_name}]: ${t.expo_push_token}`);
  });

  const testPayloads = [
    // 1. Direct Chat Message
    {
      label: '1-on-1 Chat Message Notification',
      channelId: 'chat-messages',
      title: '💬 Sarah Jenkins',
      subtitle: 'Sarah Jenkins',
      body: 'Hey! Are you available to review the updated contract?',
      data: {
        type: 'chat_message',
        conversation_id: 'test-convo-101',
        sender_id: 'sarah-101',
        sender_name: 'Sarah Jenkins',
        is_group: false,
      },
    },
    // 2. Group Chat Message
    {
      label: 'Group Chat Message Notification',
      channelId: 'chat-messages',
      title: '👥 Product Engineering',
      subtitle: 'Alex Vance',
      body: 'Alex Vance: 📷 Photo - Here is the latest dashboard mockup!',
      data: {
        type: 'chat_message',
        conversation_id: 'test-group-202',
        sender_id: 'alex-202',
        sender_name: 'Alex Vance',
        is_group: true,
        group_name: 'Product Engineering',
      },
    },
    // 3. Incoming Voice Call
    {
      label: 'Incoming Voice Call Notification',
      channelId: 'incoming-calls',
      title: '📞 Incoming Voice Call',
      subtitle: 'David Miller',
      body: 'Incoming voice call from David Miller. Tap to answer!',
      data: {
        type: 'incoming_call',
        session_id: `test_voice_${Date.now()}`,
        caller_id: 'david-303',
        caller_name: 'David Miller',
        call_type: 'audio',
        is_group_call: false,
      },
    },
    // 4. Incoming Video Call
    {
      label: 'Incoming Video Call Notification',
      channelId: 'incoming-calls',
      title: '🎥 Incoming Video Call',
      subtitle: 'Emma Watson',
      body: 'Incoming video call from Emma Watson. Tap to answer!',
      data: {
        type: 'incoming_call',
        session_id: `test_video_${Date.now()}`,
        caller_id: 'emma-404',
        caller_name: 'Emma Watson',
        call_type: 'video',
        is_group_call: false,
      },
    },
    // 5. Incoming Group Video Call
    {
      label: 'Incoming Group Video Call Notification',
      channelId: 'incoming-calls',
      title: '🎥 Incoming Group Video Call',
      subtitle: 'Design Review Team (Michael)',
      body: 'Incoming video call from Michael in Design Review Team. Tap to join!',
      data: {
        type: 'incoming_call',
        session_id: `test_group_video_${Date.now()}`,
        caller_id: 'michael-505',
        caller_name: 'Michael',
        call_type: 'video',
        is_group_call: true,
        group_name: 'Design Review Team',
      },
    }
  ];

  console.log('\n🚀 Dispatching Live Test Push Notifications to Expo Push API...\n');

  for (const test of testPayloads) {
    console.log(`➡️ Sending: ${test.label}`);
    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: test.title,
      subtitle: test.subtitle,
      body: test.body,
      data: test.data,
      channelId: test.channelId,
      priority: 'high',
      badge: 1,
    }));

    try {
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
      console.log(`   Status: ✅ Sent | Gateway response:`, JSON.stringify(resJson.data));
    } catch (sendErr) {
      console.error(`   Status: ❌ Error sending:`, sendErr.message);
    }

    // Short pause between notifications
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\n🎉 All Chat and Voice/Video Call Push Notification tests completed successfully!');
}

runPushTests().catch(console.error);
