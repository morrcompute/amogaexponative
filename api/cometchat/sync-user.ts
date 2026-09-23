export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { uid, name, avatar } = req.body || {};

  if (!uid) {
    return res.status(400).json({ success: false, message: 'UID is required' });
  }

  const appId = process.env.COMETCHAT_APP_ID || process.env.EXPO_PUBLIC_COMETCHAT_APP_ID;
  const region = (process.env.COMETCHAT_REGION || process.env.EXPO_PUBLIC_COMETCHAT_REGION || 'in').toLowerCase();
  const apiKey = process.env.COMETCHAT_REST_API_KEY || process.env.EXPO_PUBLIC_COMETCHAT_REST_API_KEY || process.env.EXPO_PUBLIC_COMETCHAT_AUTH_KEY;

  if (!appId || !apiKey) {
    return res.status(500).json({ success: false, message: 'CometChat API configuration is missing.' });
  }

  try {
    const url = `https://${appId}.api-${region}.cometchat.io/v3/users`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'appId': appId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        uid: uid,
        name: name || `User ${uid.slice(0, 6)}`,
        avatar: avatar || undefined,
      }),
    });

    const data: any = await response.json();

    // If user already exists (ERR_UID_ALREADY_EXISTS) or created successfully, return success
    if (response.ok || data?.error?.code === 'ERR_UID_ALREADY_EXISTS') {
      return res.status(200).json({ success: true, user: data?.data || { uid, name } });
    }

    // If API key doesn't have create permission, return details
    return res.status(200).json({
      success: false,
      error: data?.error?.message || 'Failed to sync user to CometChat',
      details: data?.error,
    });
  } catch (error: any) {
    console.error('[CometChat Sync API] Error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal error' });
  }
}
