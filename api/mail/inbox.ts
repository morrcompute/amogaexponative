import { getInboxEmails } from '../../lib/email/mail-service';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-mail-config'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const page = parseInt((req.query?.page as string) || '1', 10);
    const limit = parseInt((req.query?.limit as string) || '20', 10);

    const result = await getInboxEmails({ page, limit });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('API Inbox Error:', error);
    return res.status(200).json({
      success: false,
      message: `API Error: ${error.message || error}`,
      emails: [],
    });
  }
}
