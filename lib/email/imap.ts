import { ImapFlow } from 'imapflow';
import { defaultMailConfig, MailConfig } from './mail-config';

export function createImapClient(customConfig?: Partial<MailConfig>) {
  const config = {
    ...defaultMailConfig,
    ...customConfig,
    imap: {
      ...defaultMailConfig.imap,
      ...(customConfig?.imap || {}),
    },
  };

  return new ImapFlow({
    host: config.imap.host || 'imap.hostinger.com',
    port: Number(config.imap.port) || 993,
    secure: config.imap.secure !== false,
    auth: {
      user: config.email,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
    logger: false,
  });
}
