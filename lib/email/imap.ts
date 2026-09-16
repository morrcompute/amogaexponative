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
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  });
}
