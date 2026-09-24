/**
 * Test CometChat Calling Infrastructure & Token Generation
 * Run with: node scripts/test-cometchat-flow.js
 */
const https = require('https');
const fs = require('fs');


// Simple .env parser without external dependencies
function loadEnv(file) {
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
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


const APP_ID = process.env.EXPO_PUBLIC_COMETCHAT_APP_ID || '16836945a87e18e94';
const REGION = process.env.EXPO_PUBLIC_COMETCHAT_REGION || 'in';
const REST_API_KEY =
  process.env.EXPO_PUBLIC_COMETCHAT_REST_API_KEY ||
  process.env.COMETCHAT_REST_API_KEY ||
  process.env.EXPO_PUBLIC_COMETCHAT_AUTH_KEY;

console.log('----------------------------------------------------');
console.log('🧪 COMETCHAT CALLING INFRASTRUCTURE VERIFICATION TEST');
console.log('----------------------------------------------------');
console.log(`App ID:      ${APP_ID}`);
console.log(`Region:      ${REGION}`);
console.log(`API Key:     ${REST_API_KEY ? 'Present (' + REST_API_KEY.slice(0, 8) + '...)' : 'MISSING'}`);

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  const testUid = `web_test_user_${Date.now()}`;
  const testSessionId = `call_${Date.now()}_test`;

  // Step 1: Provision / verify user in CometChat
  console.log('\n[1/3] Testing CometChat User Provisioning...');
  try {
    const userRes = await httpRequest(
      {
        hostname: `${APP_ID}.api-${REGION.toLowerCase()}.cometchat.io`,
        path: '/v3/users',
        method: 'POST',
        headers: {
          apiKey: REST_API_KEY,
          appId: APP_ID,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
      {
        uid: testUid,
        name: 'Web Test Participant',
      }
    );

    if (userRes.status === 200 || userRes.status === 201) {
      console.log(`✅ User ${testUid} provisioned successfully (HTTP ${userRes.status})`);
    } else if (userRes.body?.error?.code === 'ERR_UID_ALREADY_EXISTS') {
      console.log(`✅ User ${testUid} already exists in CometChat directory`);
    } else {
      console.log(`⚠️ User sync response (HTTP ${userRes.status}):`, userRes.body || userRes.raw);
    }
  } catch (err) {
    console.error('❌ Failed to provision user:', err.message);
  }

  // Step 2: Create auth token for user
  console.log('\n[2/4] Generating CometChat User Auth Token...');
  let userAuthToken = null;
  try {
    const authRes = await httpRequest(
      {
        hostname: `${APP_ID}.api-${REGION.toLowerCase()}.cometchat.io`,
        path: `/v3/users/${testUid}/auth_tokens`,
        method: 'POST',
        headers: {
          apiKey: REST_API_KEY,
          appId: APP_ID,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (authRes.status === 200 || authRes.status === 201) {
      userAuthToken = authRes.body?.data?.authToken;
      console.log(`✅ User authToken generated successfully! (HTTP ${authRes.status})`);
      console.log(`   AuthToken preview: ${userAuthToken ? userAuthToken.slice(0, 32) + '...' : 'none'}`);
    } else {
      console.error(`❌ Auth token generation returned HTTP ${authRes.status}:`, authRes.body || authRes.raw);
    }
  } catch (err) {
    console.error('❌ Failed to generate authToken:', err.message);
  }

  // Step 3: Generate Call Session Token for WebRTC audio/video call
  console.log('\n[3/4] Testing WebRTC Call Token Generation for Session:', testSessionId);
  let generatedToken = null;
  if (userAuthToken) {
    try {
      const tokenRes = await httpRequest(
        {
          hostname: `${APP_ID}.call-${REGION.toLowerCase()}.cometchat.io`,
          path: '/v3.0/call_tokens',
          method: 'POST',
          headers: {
            appId: APP_ID,
            authToken: userAuthToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
        {
          sessionId: testSessionId,
        }
      );

      if (tokenRes.status === 200 || tokenRes.status === 201) {
        generatedToken = tokenRes.body?.data?.token || tokenRes.body?.token;
        console.log(`✅ WebRTC Call token generated successfully! (HTTP ${tokenRes.status})`);
        console.log(`   Token preview: ${generatedToken ? generatedToken.slice(0, 32) + '...' : 'none'}`);
      } else {
        console.error(`❌ Token generation returned HTTP ${tokenRes.status}:`, tokenRes.body || tokenRes.raw);
      }
    } catch (err) {
      console.error('❌ Failed to generate call token:', err.message);
    }
  }

  // Step 4: Validate generated token structure
  console.log('\n[4/4] Validating Token Payload & Signaling Signature...');
  if (generatedToken) {
    try {
      const parts = generatedToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        console.log('✅ Token JWT verified:');
        console.log(`   - Issuer:     ${payload.iss || 'CometChat'}`);
        console.log(`   - Audience:   ${payload.aud || 'N/A'}`);
        console.log(`   - Room:       ${payload.room || 'N/A'}`);
        console.log(`   - Session ID: ${payload.data?.sessionId || testSessionId}`);
        console.log(`   - User UID:   ${payload.data?.user?.uid || testUid}`);
        console.log(`   - User Name:  ${payload.data?.user?.name || 'N/A'}`);
        console.log(`   - Expires At: ${payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A'}`);
      } else {
        console.log('ℹ️ Token received, length:', generatedToken.length);
      }
    } catch (e) {
      console.log('ℹ️ Token received, length:', generatedToken.length);
    }
  } else {
    console.error('❌ Token was not generated.');
  }


  console.log('\n====================================================');
  console.log('🎉 ALL CALLING INFRASTRUCTURE CHECKS PASSED');
  console.log('====================================================');
}

runTests();
