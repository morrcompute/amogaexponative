const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nvxcqbisyeldjceouggb.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_f7pb9k7U2jT9GgyO4GC2rg_guymXYhK';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function simulateIncomingMailNotification({ fromEmail, fromName, toEmail, subject, body }) {
  console.log(`\n📨 Simulating incoming mail notification:`);
  console.log(`   From: ${fromName} <${fromEmail}>`);
  console.log(`   To: ${toEmail}`);
  console.log(`   Subject: ${subject}`);

  // 1. Insert into app_notification table in Supabase
  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from('app_notification')
    .insert({
      status: 'sent',
      subject: subject,
      sender_email: fromEmail,
      from_email: fromEmail,
      sender_name: fromName,
      full_name: fromName,
      from_user_name: fromName,
      from_fullname: fromName,
      to_email: toEmail,
      to_user_email: toEmail,
      body: body,
      is_read: false,
      is_starred: false,
      is_important: false,
      is_draft: false,
      is_deleted: false,
      folder_name: 'INBOX',
      created_datetime: nowIso,
      received_datetime: nowIso,
      updated_datetime: nowIso,
    })
    .select();

  if (insertError) {
    console.error('❌ Error inserting notification:', insertError);
    return;
  }

  console.log('✅ Notification stored in database with UUID:', inserted?.[0]?.app_notification_uuid);

  // 2. Fetch push tokens for recipient
  const cleanEmail = toEmail.trim().toLowerCase();
  const { data: tokenRecords, error: tokenError } = await supabase
    .from('user_push_tokens')
    .select('expo_push_token, user_email, device_name')
    .eq('user_email', cleanEmail)
    .eq('is_active', true);

  if (tokenError || !tokenRecords || tokenRecords.length === 0) {
    console.log(`⚠️ No active push tokens found for recipient ${cleanEmail}`);
    return;
  }

  console.log(`📱 Found ${tokenRecords.length} registered device(s) for ${cleanEmail}:`);
  tokenRecords.forEach((r) => console.log(`   - ${r.device_name}: ${r.expo_push_token}`));

  // 3. Send real-time push notification via Expo Push API
  const messages = tokenRecords.map((rec) => ({
    to: rec.expo_push_token,
    sound: 'default',
    title: `📧 ${fromName}`,
    subtitle: subject,
    body: `${subject}\n${body.substring(0, 100)}`,
    data: {
      type: 'app_notification',
      notification_uuid: inserted?.[0]?.app_notification_uuid,
      sender_email: fromEmail,
      to_email: toEmail,
    },
    channelId: 'email-notifications',
    priority: 'high',
    badge: 1,
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const resJson = await res.json();
  console.log('🚀 Push Notification Delivered to Phone:', JSON.stringify(resJson, null, 2));
}

async function main() {
  // Test sending to Aman
  await simulateIncomingMailNotification({
    fromEmail: 'mohdsameer200yahoo@gmail.com',
    fromName: 'Sameer',
    toEmail: 'itsaman00786@gmail.com',
    subject: 'Client Meeting Scheduled for 4 PM',
    body: 'Hi Aman, please review the attached agenda for the client presentation today.',
  });

  // Test sending to Sameer
  await simulateIncomingMailNotification({
    fromEmail: 'itsaman00786@gmail.com',
    fromName: 'Aman',
    toEmail: 'mohdsameer200yahoo@gmail.com',
    subject: 'APK Build & Notifications Live!',
    body: 'Hey Sameer, the new mobile notifications system is working seamlessly.',
  });
}

main().catch(console.error);
